import { useState } from 'react';

export default function TaskForm({ onCreate, busy }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await onCreate({ title, description });
    setTitle('');
    setDescription('');
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="What needs doing? (e.g. 'Pay M-Pesa bill today')"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={busy}
      />
      <input
        type="text"
        placeholder="Optional details"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={busy}
      />
      <button type="submit" disabled={busy || !title.trim()}>
        {busy ? 'Categorizing…' : 'Add Task'}
      </button>
    </form>
  );
}
