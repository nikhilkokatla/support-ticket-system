function PriorityBadge({ priority, suffix = '' }) {
  return <span className={`priority-dot ${priority}`}>{priority}{suffix}</span>
}

export default PriorityBadge
