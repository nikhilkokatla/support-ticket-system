CREATE TABLE IF NOT EXISTS tickets (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    subject VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    priority ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    category ENUM('account', 'billing', 'technical', 'general') NOT NULL DEFAULT 'general',
    status ENUM('open', 'in_progress', 'completed', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    user_id INT NOT NULL,
    assigned_to INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tickets_user_id (user_id),
    KEY idx_tickets_user_status_updated (user_id, status, updated_at),
    KEY idx_tickets_assigned_to (assigned_to),
    KEY idx_tickets_status (status),
    KEY idx_tickets_priority (priority),
    KEY idx_tickets_category (category),
    KEY idx_tickets_subject (subject),
    KEY idx_tickets_updated_at (updated_at),
    CONSTRAINT fk_tickets_user_id FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_tickets_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ticket_comments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id INT UNSIGNED NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ticket_comments_ticket_created (ticket_id, created_at),
    KEY idx_ticket_comments_user_id (user_id),
    CONSTRAINT fk_ticket_comments_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    CONSTRAINT fk_ticket_comments_user FOREIGN KEY (user_id) REFERENCES users(id)
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
