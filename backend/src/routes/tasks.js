const express = require('express');
const pool = require('../db/pool');
const { classifyTask, DEFAULT_CATEGORIES } = require('../services/classifier');

const router = express.Router();

// GET /api/tasks?category=Work&completed=false
router.get('/', async (req, res) => {
  const { category, completed } = req.query;
  const clauses = [];
  const values = [];

  if (category) {
    values.push(category);
    clauses.push(`category = $${values.length}`);
  }
  if (completed !== undefined) {
    values.push(completed === 'true');
    clauses.push(`completed = $${values.length}`);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT * FROM tasks ${where} ORDER BY
       CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
       created_at DESC`,
    values,
  );
  res.json(rows);
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Task not found' });
  res.json(rows[0]);
});

// POST /api/tasks  { title, description? }
// Automatically categorizes and prioritizes the task via the AI service.
router.post('/', async (req, res) => {
  const { title, description = '' } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const classification = await classifyTask(`${title}. ${description}`.trim());

  const { rows } = await pool.query(
    `INSERT INTO tasks (title, description, category, priority, ai_confidence)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [title.trim(), description, classification.category, classification.priority, classification.confidence],
  );

  res.status(201).json({ ...rows[0], ai_source: classification.source });
});

// PUT /api/tasks/:id  { title?, description?, completed?, category?, priority? }
// Re-runs classification only if title/description changed and category/priority weren't explicitly set.
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const existing = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  if (!existing.rows.length) return res.status(404).json({ error: 'Task not found' });
  const current = existing.rows[0];

  const {
    title = current.title,
    description = current.description,
    completed = current.completed,
    category,
    priority,
  } = req.body;

  let finalCategory = category ?? current.category;
  let finalPriority = priority ?? current.priority;
  let confidence = current.ai_confidence;

  const textChanged = title !== current.title || description !== current.description;
  const userOverrode = category !== undefined || priority !== undefined;

  if (textChanged && !userOverrode) {
    const classification = await classifyTask(`${title}. ${description}`.trim());
    finalCategory = classification.category;
    finalPriority = classification.priority;
    confidence = classification.confidence;
  }

  const { rows } = await pool.query(
    `UPDATE tasks SET title=$1, description=$2, completed=$3, category=$4,
       priority=$5, ai_confidence=$6, updated_at=NOW()
     WHERE id=$7 RETURNING *`,
    [title, description, completed, finalCategory, finalPriority, confidence, id],
  );

  res.json(rows[0]);
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req, res) => {
  const { rows } = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Task not found' });
  res.status(204).send();
});

// GET /api/tasks/meta/categories — list of categories the classifier can assign
router.get('/meta/categories', (_req, res) => {
  res.json(DEFAULT_CATEGORIES);
});

module.exports = router;
