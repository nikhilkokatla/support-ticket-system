-- Replace the intermediate `completed` status with `resolved`.
-- Existing completed tickets are preserved as resolved tickets.
UPDATE tickets SET status = 'resolved' WHERE status = 'completed';

ALTER TABLE tickets
    MODIFY COLUMN status ENUM('open', 'in_progress', 'resolved', 'closed')
        NOT NULL DEFAULT 'open';
