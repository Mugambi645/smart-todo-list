import TaskItem from './TaskItem.jsx';

export default function TaskList({ tasks, onToggle, onDelete }) {
  if (!tasks.length) {
    return <p className="empty-state">No tasks yet — add one above and let AI sort it for you.</p>;
  }

  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </ul>
  );
}
