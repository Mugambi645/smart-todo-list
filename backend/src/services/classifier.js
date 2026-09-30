const fetch = require('node-fetch');

const HF_URL = (model) => `https://api-inference.huggingface.co/models/${model}`;

const DEFAULT_CATEGORIES = (process.env.TASK_CATEGORIES ||
  'Work,Personal,Shopping,Health,Finance,Learning,Errands,Urgent')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

const URGENT_WORDS = ['urgent', 'asap', 'immediately', 'today', 'now', 'overdue', 'critical', 'emergency'];
const HIGH_WORDS = ['tomorrow', 'deadline', 'important', 'due', 'meeting', 'interview'];

/**
 * Local, dependency-free fallback classifier.
 * Used when USE_LOCAL_FALLBACK=true or when the HF call fails,
 * so the app is always demoable (e.g. in CI, or without an API token).
 */
function localFallbackClassify(text) {
  const lower = text.toLowerCase();

  let priority = 'medium';
  if (URGENT_WORDS.some((w) => lower.includes(w))) {
    priority = 'high';
  } else if (HIGH_WORDS.some((w) => lower.includes(w))) {
    priority = 'high';
  } else if (lower.split(' ').length <= 3) {
    priority = 'low';
  }

  const keywordMap = {
    Shopping: ['buy', 'purchase', 'shop', 'grocery', 'groceries', 'store', 'order'],
    Health: ['doctor', 'gym', 'workout', 'medicine', 'appointment', 'hospital', 'clinic', 'exercise'],
    Finance: ['pay', 'invoice', 'bill', 'bank', 'budget', 'tax', 'salary', 'mpesa', 'm-pesa'],
    Learning: ['study', 'read', 'course', 'learn', 'tutorial', 'exam', 'homework'],
    Work: ['project', 'meeting', 'client', 'report', 'deploy', 'code', 'email', 'presentation'],
    Errands: ['pick up', 'drop off', 'clean', 'laundry', 'repair', 'fix'],
    Urgent: URGENT_WORDS,
  };

  let category = 'Personal';
  let bestScore = 0;
  for (const [cat, words] of Object.entries(keywordMap)) {
    const score = words.reduce((acc, w) => (lower.includes(w) ? acc + 1 : acc), 0);
    if (score > bestScore) {
      bestScore = score;
      category = cat;
    }
  }

  return { category, priority, confidence: bestScore > 0 ? 0.6 : 0.3, source: 'local-fallback' };
}

function priorityFromCategory(topCategory, topScore, text) {
  const lower = text.toLowerCase();
  if (topCategory === 'Urgent' || URGENT_WORDS.some((w) => lower.includes(w))) return 'high';
  if (HIGH_WORDS.some((w) => lower.includes(w))) return 'high';
  if (topScore < 0.4) return 'low';
  return 'medium';
}

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 2; // total attempts = MAX_RETRIES + 1
const BASE_DELAY_MS = 800;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callHuggingFace(text, model, token) {
  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response;
    try {
      response = await fetch(HF_URL(model), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          parameters: { candidate_labels: DEFAULT_CATEGORIES, multi_label: false },
        }),
      });
    } catch (networkErr) {
      // DNS/connection-level failure — retry same as a 5xx
      lastErr = networkErr;
      if (attempt < MAX_RETRIES) {
        await sleep(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      throw lastErr;
    }

    if (response.ok) {
      return response.json();
    }

    // 503 from HF often means the model is loading; body includes estimated_time
    if (response.status === 503) {
      const body = await response.json().catch(() => ({}));
      const wait = Math.min(Math.ceil((body.estimated_time || 5) * 1000), 15000);
      if (attempt < MAX_RETRIES) {
        // eslint-disable-next-line no-console
        console.warn(`HF model loading, retrying in ${wait}ms (attempt ${attempt + 1})`);
        await sleep(wait);
        continue;
      }
    }

    if (RETRYABLE_STATUS.has(response.status) && attempt < MAX_RETRIES) {
      // eslint-disable-next-line no-console
      console.warn(`HF API ${response.status}, retrying (attempt ${attempt + 1})`);
      await sleep(BASE_DELAY_MS * 2 ** attempt);
      continue;
    }

    const bodyText = await response.text().catch(() => '');
    throw new Error(`HF API responded with ${response.status}: ${bodyText.slice(0, 200)}`);
  }

  throw lastErr || new Error('HF API call failed after retries');
}

/**
 * Classify a task's text into a category + priority using a Hugging Face
 * zero-shot-classification model (e.g. facebook/bart-large-mnli).
 */
async function classifyTask(text) {
  const useLocal = String(process.env.USE_LOCAL_FALLBACK).toLowerCase() === 'true';
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const model = process.env.HF_MODEL || 'facebook/bart-large-mnli';

  if (useLocal || !token) {
    return localFallbackClassify(text);
  }

  try {
    const data = await callHuggingFace(text, model, token);
    if (!data.labels || !data.labels.length) {
      throw new Error('Unexpected HF response shape');
    }

    const topCategory = data.labels[0];
    const topScore = data.scores[0];
    const priority = priorityFromCategory(topCategory, topScore, text);

    return {
      category: topCategory,
      priority,
      confidence: Number(topScore.toFixed(4)),
      source: 'huggingface',
    };
  } catch (err) {
    // Graceful degradation: never let a flaky AI call break task creation.
    // eslint-disable-next-line no-console
    console.warn('HF classification failed, using local fallback:', err.message);
    return localFallbackClassify(text);
  }
}

module.exports = { classifyTask, DEFAULT_CATEGORIES };
