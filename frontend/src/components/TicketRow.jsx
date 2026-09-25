import PriorityBadge from './PriorityBadge'
import StatusBadge from './StatusBadge'

function TicketRow({ ticket, selected, isStaff, onSelect }) {
  return (
    <button
      type="button"
      className={`ticket-row ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(ticket)}
    >
      <div className="ticket-row-top">
        <strong>{ticket.subject}</strong>
        <StatusBadge status={ticket.status} />
      </div>
      <div className="ticket-row-bottom">
        <span>#{ticket.id} · {ticket.category}</span>
        <PriorityBadge priority={ticket.priority} />
        <time>{new Date(ticket.updated_at).toLocaleDateString()}</time>
      </div>
      {isStaff && (
        <div className="ticket-requester">
          From {ticket.creator_name}{ticket.assignee_name ? ` · Assigned to ${ticket.assignee_name}` : ' · Unassigned'}
        </div>
      )}
    </button>
  )
}

export default TicketRow
