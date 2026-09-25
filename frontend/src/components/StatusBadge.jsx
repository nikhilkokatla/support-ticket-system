function StatusBadge({ status }) {
  return <span className={`status-tag ${status}`}>{status.replace('_', ' ')}</span>
}

export default StatusBadge
