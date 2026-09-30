const PRIORITY_COLORS = {
  high: '#e5484d',
  medium: '#f5a623',
  low: '#30a46c',
};

export default function TaskItem({ task, onToggle, onDelete }) {
  return (
    <li className={`task-item ${task.completed ? 'completed' : ''}`}>
      <div className="task-main">
        <input
          type="checkbox"
          checked={task.completed}
          onChange={() => onToggle(task)}
        />
        <div>
          <div className="task-title">{task.title}</div>
          {task.description && <div className="task-desc">{task.description}</div>}
        </div>
      </div>
      <div className="task-meta">
        <span className="badge category">{task.category || 'Uncategorized'}</span>
        <span
          className="badge priority"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority] || '#888' }}
        >
          {task.priority}
        </span>
        <button className="delete-btn" onClick={() => onDelete(task.id)} aria-label="Delete task">
          ✕
        </button>
      </div>
    </li>
  );
}
