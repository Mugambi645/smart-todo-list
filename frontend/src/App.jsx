import { useEffect, useMemo, useState } from 'react';
import TaskForm from './components/TaskForm.jsx';
import TaskList from './components/TaskList.jsx';
import { api } from './api.js';

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loadTasks() {
    try {
      const params = filterCategory ? { category: filterCategory } : {};
      const data = await api.list(params);
      setTasks(data);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    api.categories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCategory]);

  async function handleCreate(task) {
    setBusy(true);
    setError(null);
    try {
      const created = await api.create(task);
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(task) {
    const updated = await api.update(task.id, { completed: !task.completed });
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
  }

  async function handleDelete(id) {
    await api.remove(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  const stats = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.completed).length;
    return { total, done };
  }, [tasks]);

  return (
    <div className="app">
      <header>
        <h1>Smart To-Do</h1>
        <p className="subtitle">AI automatically categorizes and prioritizes each task.</p>
      </header>

      <TaskForm onCreate={handleCreate} busy={busy} />

      {error && <div className="error-banner">{error}</div>}

      <div className="filter-row">
        <label htmlFor="category-filter">Filter:</label>
        <select
          id="category-filter"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="stats">
          {stats.done}/{stats.total} done
        </span>
      </div>

      <TaskList tasks={tasks} onToggle={handleToggle} onDelete={handleDelete} />
    </div>
  );
}
