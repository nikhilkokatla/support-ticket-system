-- Example query requested by the assessment: open tickets with customer name and email.
SELECT t.id, t.subject, t.description, t.priority, t.status, t.assigned_to,
       u.name AS customer_name, u.email AS customer_email, t.created_at, t.updated_at
FROM tickets AS t
JOIN users AS u ON u.id = t.user_id
WHERE t.status = 'open'
ORDER BY t.created_at DESC;

-- Agent dashboard counts by status.
SELECT status, COUNT(*) AS ticket_count
FROM tickets
GROUP BY status;
