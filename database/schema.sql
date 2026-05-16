CREATE TABLE IF NOT EXISTS rooms (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code CHAR(4) NOT NULL,
    name VARCHAR(80) NULL,
    creator_browser_id CHAR(64) NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    last_activity_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    UNIQUE KEY rooms_code_unique (code),
    KEY rooms_expires_at_index (expires_at),
    KEY rooms_creator_browser_index (creator_browser_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS participants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    browser_id CHAR(64) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    joined_at DATETIME(6) NOT NULL,
    last_seen_at DATETIME(6) NOT NULL,
    UNIQUE KEY participants_room_browser_unique (room_id, browser_id),
    KEY participants_room_seen_index (room_id, last_seen_at),
    CONSTRAINT participants_room_fk
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    participant_id BIGINT UNSIGNED NOT NULL,
    browser_id CHAR(64) NOT NULL,
    sender_display_name VARCHAR(50) NOT NULL,
    body_text TEXT NULL,
    parent_message_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    KEY messages_room_updated_index (room_id, updated_at),
    KEY messages_browser_index (browser_id),
    KEY messages_parent_message_index (parent_message_id),
    CONSTRAINT messages_room_fk
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE,
    CONSTRAINT messages_participant_fk
        FOREIGN KEY (participant_id) REFERENCES participants (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attachments (
    id CHAR(24) NOT NULL PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    stored_path VARCHAR(500) NOT NULL,
    mime_type VARCHAR(190) NOT NULL,
    size_bytes BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    KEY attachments_room_index (room_id),
    KEY attachments_message_deleted_index (message_id, deleted_at),
    CONSTRAINT attachments_room_fk
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE,
    CONSTRAINT attachments_message_fk
        FOREIGN KEY (message_id) REFERENCES messages (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

