import { useCallback, useEffect, useState } from 'react'
import './App.css'
import FormField from './components/FormField'
import PriorityBadge from './components/PriorityBadge'
import StatusBadge from './components/StatusBadge'
import TicketRow from './components/TicketRow'

const API_URL = import.meta.env.VITE_API_URL || ''
const priorities = ['low', 'medium', 'high', 'urgent']
const categories = ['account', 'billing', 'technical', 'general']
const statuses = ['open', 'in_progress', 'resolved', 'closed']

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'The request could not be completed.')
  return data
}

function App() {
  const [mode, setMode] = useState('login')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [authError, setAuthError] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [tickets, setTickets] = useState([])
  const [comments, setComments] = useState([])
  const [commentMessage, setCommentMessage] = useState('')
  const [stats, setStats] = useState({ total: 0, unassigned: 0, byStatus: [] })
  const [ticketLoading, setTicketLoading] = useState(false)
  const [ticketMessage, setTicketMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [sort, setSort] = useState('updated')
  const [order, setOrder] = useState('desc')
  const [search, setSearch] = useState('')
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [users, setUsers] = useState([])
  const [staff, setStaff] = useState([])
  const [activeView, setActiveView] = useState('tickets')
  const isStaff = user && ['support', 'admin'].includes(user.role)

  useEffect(() => {
    api('/api/auth/me').then((data) => setUser(data.user)).catch(() => {}).finally(() => setAuthLoading(false))
  }, [])

  const loadTickets = useCallback(async () => {
    if (!user) return
    setTicketLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterPriority) params.set('priority', filterPriority)
      if (filterCategory) params.set('category', filterCategory)
      if (sort) params.set('sort', sort)
      params.set('order', order)
      if (search.trim()) params.set('search', search.trim())
      const data = await api(`/api/tickets?${params}`)
      setTickets(data.tickets)
      setTicketMessage('')
    } catch (error) {
      setTicketMessage(error.message)
    } finally {
      setTicketLoading(false)
    }
  }, [user, filterStatus, filterPriority, filterCategory, search, sort, order])

  useEffect(() => {
    const timer = window.setTimeout(() => { loadTickets() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadTickets])

  useEffect(() => {
    if (!isStaff) return
    Promise.all([api('/api/staff/options'), api('/api/users'), api('/api/dashboard/stats')])
      .then(([options, userData, dashboardStats]) => { setStaff(options.staff); setUsers(userData.users); setStats(dashboardStats) })
      .catch((error) => setTicketMessage(error.message))
  }, [isStaff])

  const handleAuth = async (event) => {
    event.preventDefault()
    setAuthBusy(true)
    setAuthMessage('')
    setAuthError(false)
    try {
      const registering = mode === 'register'
      const data = await api(registering ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(registering ? { name, email, password } : { email, password }),
      })
      if (registering) {
        setAuthMessage('Account created. You can now sign in.')
        setMode('login')
        setPassword('')
      } else {
        setUser(data.user)
        setAuthMessage('')
        setPassword('')
      }
    } catch (error) {
      setAuthError(true)
      setAuthMessage(error.message)
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }) } catch (error) { setTicketMessage(error.message) }
    setUser(null)
    setTickets([])
    setSelectedTicket(null)
  }

  const openTicket = async (ticket) => {
    try {
      const [data, commentData] = await Promise.all([api(`/api/tickets/${ticket.id}`), api(`/api/tickets/${ticket.id}/comments`)])
      setSelectedTicket(data.ticket)
      setComments(commentData.comments)
    } catch (error) { setTicketMessage(error.message) }
  }

  const createTicket = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    try {
      await api('/api/tickets', { method: 'POST', body: JSON.stringify({
        subject: form.get('subject'), description: form.get('description'), category: form.get('category'), priority: form.get('priority'),
      }) })
      setShowCreate(false)
      setTicketMessage('Your ticket has been created.')
      await loadTickets()
    } catch (error) { setTicketMessage(error.message) }
  }

  const editTicket = async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const updated = await updateTicket(selectedTicket.id, {
      subject: form.get('subject'), description: form.get('description'),
      category: form.get('category'), priority: form.get('priority'),
    })
    if (updated) setShowEdit(false)
  }

  const addComment = async (event) => {
    event.preventDefault()
    const commentForm = event.currentTarget
    const form = new FormData(commentForm)
    const comment = String(form.get('comment') || '').trim()
    if (!selectedTicket || !comment) return
    setCommentMessage('')
    try {
      await api(`/api/tickets/${selectedTicket.id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) })
      const data = await api(`/api/tickets/${selectedTicket.id}/comments`)
      setComments(data.comments)
      commentForm.reset()
    } catch (error) { setCommentMessage(error.message) }
  }

  const updateTicket = async (ticketId, changes) => {
    try {
      await api(`/api/tickets/${ticketId}`, { method: 'PUT', body: JSON.stringify(changes) })
      const data = await api(`/api/tickets/${ticketId}`)
      setSelectedTicket(data.ticket)
      await loadTickets()
      setTicketMessage('Ticket updated.')
      return true
    } catch (error) { setTicketMessage(error.message); return false }
  }

  const deleteTicket = async (ticketId) => {
    if (!window.confirm('Delete this ticket? This action cannot be undone.')) return
    try {
      await api(`/api/tickets/${ticketId}`, { method: 'DELETE' })
      setSelectedTicket(null)
      await loadTickets()
      setTicketMessage('Ticket deleted.')
    } catch (error) { setTicketMessage(error.message) }
  }

  if (authLoading) return <main className="loading-page">Loading your support space…</main>

  if (!user) {
    const registering = mode === 'register'
    return (
      <main className="page-shell auth-layout">
        <section className="intro-panel">
          <a className="brand" href="/">Relay<span>Desk</span></a>
          <div className="intro-copy"><div className="eyebrow">SUPPORT, MADE SIMPLE</div><h1>A little help goes a long way.</h1><p>Keep your support conversations and requests in one place.</p></div>
          <div className="intro-footer"><span className="status-dot" /> A clearer way to get support</div>
        </section>
        <section className="form-panel"><div className="form-wrap">
          <div className="eyebrow">YOUR SUPPORT SPACE</div><h2>{registering ? 'Create your account' : 'Welcome back'}</h2>
          <p className="form-subtitle">{registering ? 'Get started with your support account.' : 'Enter your details to sign in to your account.'}</p>
          <form onSubmit={handleAuth}>
            {registering && <FormField label="Name"><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required /></FormField>}
            <FormField label="Email address"><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></FormField>
            <FormField label="Password"><input type="password" autoComplete={registering ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></FormField>
            <button className="submit-button" type="submit" disabled={authBusy}>{authBusy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}<span aria-hidden="true">→</span></button>
          </form>
          {authMessage && <p className={`form-message ${authError ? 'is-error' : ''}`} role="status">{authMessage}</p>}
          <p className="switch-mode">{registering ? 'Already have an account?' : 'New to RelayDesk?'}{' '}
            <button className="inline-button" onClick={() => { setMode(registering ? 'login' : 'register'); setAuthMessage(''); setAuthError(false) }}>{registering ? 'Sign in' : 'Create an account'}</button>
          </p>
        </div><footer className="form-footer">Secure access to your support account</footer></section>
      </main>
    )
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/">Relay<span>Desk</span></a><div className="sidebar-label">WORKSPACE</div>
        <button className={`nav-item ${activeView === 'tickets' ? 'active' : ''}`} onClick={() => setActiveView('tickets')}><span>▤</span>{isStaff ? 'Ticket queue' : 'My tickets'}</button>
        {isStaff && <button className={`nav-item ${activeView === 'users' ? 'active' : ''}`} onClick={() => setActiveView('users')}><span>♙</span>Users</button>}
        <div className="sidebar-bottom"><div className="avatar">{user.name?.[0]?.toUpperCase()}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span><span>{user.role}</span></div><button className="logout-icon" title="Log out" onClick={handleLogout}>↪</button></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header"><div><div className="eyebrow">{user.role.toUpperCase()} WORKSPACE</div><h1>{activeView === 'users' ? 'People' : isStaff ? 'Ticket queue' : 'My tickets'}</h1></div>
          {activeView === 'tickets' && <button className="primary-button" onClick={() => setShowCreate(true)}>＋ New ticket</button>}</header>
        {ticketMessage && <div className="notice" role="status"><span>{ticketMessage}</span><button onClick={() => setTicketMessage('')} aria-label="Dismiss">×</button></div>}
        {isStaff && activeView === 'tickets' && <section className="stats-grid" aria-label="Ticket statistics">
          <div className="stat-card"><span>Total tickets</span><strong>{stats.total}</strong></div>
          <div className="stat-card"><span>Unassigned active</span><strong>{stats.unassigned}</strong></div>
          {statuses.slice(0, 3).map((status) => <div className="stat-card" key={status}><span>{status.replace('_', ' ')}</span><strong>{stats.byStatus.find((item) => item.status === status)?.total || 0}</strong></div>)}
        </section>}

        {activeView === 'users' ? <section className="content-card"><div className="card-heading"><div><h2>Users</h2><p>Accounts in your support workspace</p></div><span className="count-pill">{users.length}</span></div>
          <div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead><tbody>{users.map((person) => <tr key={person.id}><td>{person.name}</td><td>{person.email}</td><td><span className={`role-tag ${person.role}`}>{person.role}</span></td><td>{new Date(person.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div>
        </section> : <div className="ticket-layout">
          <section className="content-card ticket-list-card"><div className="card-heading"><div><h2>{isStaff ? 'All tickets' : 'Your requests'}</h2><p>{isStaff ? 'Review and manage incoming requests' : 'Track your open and resolved requests'}</p></div><span className="count-pill">{tickets.length}</span></div>
            <div className="filter-row"><input className="search-input" aria-label="Search tickets" placeholder="Search tickets…" value={search} onChange={(event) => setSearch(event.target.value)} />
              <select aria-label="Filter by status" value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
              <select aria-label="Filter by priority" value={filterPriority} onChange={(event) => setFilterPriority(event.target.value)}><option value="">All priorities</option>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select>
              <select aria-label="Filter by category" value={filterCategory} onChange={(event) => setFilterCategory(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select>
              <select aria-label="Sort tickets" value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">Recently updated</option><option value="created">Date created</option><option value="priority">Priority</option><option value="status">Status</option></select>
              <select aria-label="Sort order" value={order} onChange={(event) => setOrder(event.target.value)}><option value="desc">Descending</option><option value="asc">Ascending</option></select></div>
            {ticketLoading ? <div className="empty-state">Loading tickets…</div> : tickets.length === 0 ? <div className="empty-state"><div className="empty-icon">▤</div><strong>No tickets found</strong><span>{search || filterStatus || filterPriority ? 'Try adjusting your filters.' : 'Create a ticket when you need a hand.'}</span></div> :
              <div className="ticket-list">{tickets.map((ticket) => <TicketRow
                key={ticket.id}
                ticket={ticket}
                selected={selectedTicket?.id === ticket.id}
                isStaff={isStaff}
                onSelect={openTicket}
              />)}</div>}
          </section>

          <section className="content-card detail-card">{selectedTicket ? <>
            <div className="detail-top"><span className="eyebrow">TICKET #{selectedTicket.id}</span><button className="close-detail" onClick={() => setSelectedTicket(null)} aria-label="Close ticket details">×</button></div>
            <h2>{selectedTicket.subject}</h2><div className="detail-tags"><StatusBadge status={selectedTicket.status} /><PriorityBadge priority={selectedTicket.priority} suffix=" priority" /></div>
            <p className="detail-description">{selectedTicket.description}</p>
            <section className="comments-section"><div className="comments-heading"><h3>Conversation</h3><span>{comments.length}</span></div>
              {comments.length === 0 ? <p className="no-comments">No comments yet. Add a response to start the conversation.</p> : <div className="comment-list">{comments.map((entry) => <article className="comment-item" key={entry.id}><div className="comment-author"><strong>{entry.author_name}</strong><span>{entry.author_role}</span><time>{new Date(entry.created_at).toLocaleString()}</time></div><p>{entry.comment}</p></article>)}</div>}
              <form className="comment-form" onSubmit={addComment}><label htmlFor="ticket-comment">Add a comment</label><textarea id="ticket-comment" name="comment" rows="3" maxLength="4000" placeholder="Write a reply…" required /><button className="secondary-button" type="submit">Send reply</button>{commentMessage && <span className="comment-error">{commentMessage}</span>}</form>
            </section>
            <dl className="detail-meta"><div><dt>Category</dt><dd>{selectedTicket.category}</dd></div><div><dt>Created by</dt><dd>{selectedTicket.creator_name}</dd></div><div><dt>Created</dt><dd>{new Date(selectedTicket.created_at).toLocaleString()}</dd></div><div><dt>Updated</dt><dd>{new Date(selectedTicket.updated_at).toLocaleString()}</dd></div></dl>
            {isStaff && <div className="staff-controls"><label>Status<select value={selectedTicket.status} onChange={(event) => updateTicket(selectedTicket.id, { status: event.target.value })}>{statuses.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></label><label>Priority<select value={selectedTicket.priority} onChange={(event) => updateTicket(selectedTicket.id, { priority: event.target.value })}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label><label>Assign to<select value={selectedTicket.assigned_to || ''} onChange={(event) => updateTicket(selectedTicket.id, { assigned_to: event.target.value || null })}><option value="">Unassigned</option>{staff.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}</select></label></div>}
            {(isStaff || (selectedTicket.created_by === user.id && selectedTicket.status === 'open')) && <button className="secondary-button" onClick={() => setShowEdit(true)}>Edit ticket</button>}
            {(user.role === 'admin' || (selectedTicket.created_by === user.id && selectedTicket.status === 'open')) && <button className="danger-button" onClick={() => deleteTicket(selectedTicket.id)}>Delete ticket</button>}
          </> : <div className="detail-empty"><div className="detail-empty-icon">↖</div><strong>Select a ticket</strong><span>Choose a request to view its details.</span></div>}</section>
        </div>}
      </section>

      {showCreate && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowCreate(false) }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className="modal-title"><div><div className="eyebrow">NEW REQUEST</div><h2 id="create-title">How can we help?</h2></div><button className="close-detail" onClick={() => setShowCreate(false)} aria-label="Close">×</button></div>
        <form onSubmit={createTicket}><label>Subject<input name="subject" minLength="3" maxLength="150" placeholder="Briefly describe the issue" required /></label><label>Description<textarea name="description" minLength="10" maxLength="5000" rows="5" placeholder="Share details that will help us resolve your request" required /></label>
          <div className="form-columns"><label>Category<select name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Priority<select name="priority">{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label></div><button className="primary-button" type="submit">Submit ticket <span>→</span></button>
        </form>
      </section></div>}

      {showEdit && selectedTicket && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShowEdit(false) }}><section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className="modal-title"><div><div className="eyebrow">TICKET #{selectedTicket.id}</div><h2 id="edit-title">Edit ticket</h2></div><button className="close-detail" onClick={() => setShowEdit(false)} aria-label="Close">×</button></div>
        <form onSubmit={editTicket}><label>Subject<input name="subject" minLength="3" maxLength="150" defaultValue={selectedTicket.subject} required /></label><label>Description<textarea name="description" minLength="10" maxLength="5000" rows="5" defaultValue={selectedTicket.description} required /></label>
          <div className="form-columns"><label>Category<select name="category" defaultValue={selectedTicket.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Priority<select name="priority" defaultValue={selectedTicket.priority}>{priorities.map((priority) => <option key={priority}>{priority}</option>)}</select></label></div><button className="primary-button" type="submit">Save changes <span>→</span></button>
        </form>
      </section></div>}
    </main>
  )
}

export default App
