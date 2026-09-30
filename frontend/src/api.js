const BASE = '/api/tasks';

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetch(`${BASE}${qs ? `?${qs}` : ''}`).then(handle);
  },
  create: (task) =>
    fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    }).then(handle),
  update: (id, patch) =>
    fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(handle),
  remove: (id) => fetch(`${BASE}/${id}`, { method: 'DELETE' }).then(handle),
  categories: () => fetch(`${BASE}/meta/categories`).then(handle),
};
