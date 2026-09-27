-- One-time upgrade for databases created by the original support-ticket app.
-- This migration keeps the existing signed INT keys and preserves all rows.
-- It expects tickets and ticket_comments to exist with the original schema.
-- Do not run this file against a fresh schema or run it more than once.

ALTER TABLE tickets
    MODIFY COLUMN status ENUM('open', 'in_progress', 'completed', 'resolved', 'closed')
        NOT NULL DEFAULT 'open',
    MODIFY COLUMN priority ENUM('low', 'medium', 'high', 'urgent')
        NOT NULL DEFAULT 'medium',
    ADD COLUMN category ENUM('account', 'billing', 'technical', 'general')
        NOT NULL DEFAULT 'general' AFTER priority,
    ADD COLUMN assigned_to INT NULL AFTER user_id,
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP AFTER created_at,
    ADD KEY idx_tickets_user_status_updated (user_id, status, updated_at),
    ADD KEY idx_tickets_assigned_status_updated (assigned_to, status, updated_at),
    ADD KEY idx_tickets_status (status),
    ADD KEY idx_tickets_priority (priority),
    ADD KEY idx_tickets_category (category),
    ADD CONSTRAINT fk_tickets_assigned_to
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Deleting a ticket through the API also removes its conversation.
ALTER TABLE ticket_comments
    DROP FOREIGN KEY ticket_comments_ibfk_1,
    ADD KEY idx_ticket_comments_ticket_created (ticket_id, created_at, id),
    ADD CONSTRAINT fk_ticket_comments_ticket
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE;
