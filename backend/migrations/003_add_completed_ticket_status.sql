-- Add the explicit completed state while retaining the legacy resolved/closed states.
-- Run once against databases that already have the tickets table.

ALTER TABLE tickets
    MODIFY COLUMN status ENUM('open', 'in_progress', 'completed', 'resolved', 'closed')
        NOT NULL DEFAULT 'open';
