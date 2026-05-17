SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS attachments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS participants;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS auth_sessions;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    mobile_normalized VARCHAR(16) NOT NULL,
    display_name VARCHAR(40) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    UNIQUE KEY users_mobile_unique (mobile_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token_hash CHAR(64) NOT NULL,
    created_at DATETIME(6) NOT NULL,
    last_seen_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    UNIQUE KEY auth_sessions_token_unique (token_hash),
    KEY auth_sessions_user_expires_index (user_id, expires_at),
    CONSTRAINT auth_sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE rooms (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code CHAR(4) NOT NULL,
    name VARCHAR(80) NULL,
    creator_user_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    last_activity_at DATETIME(6) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    UNIQUE KEY rooms_code_unique (code),
    KEY rooms_expires_at_index (expires_at),
    KEY rooms_creator_user_index (creator_user_id),
    CONSTRAINT rooms_creator_user_fk
        FOREIGN KEY (creator_user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE participants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    display_name VARCHAR(40) NOT NULL,
    mobile_display VARCHAR(11) NOT NULL,
    joined_at DATETIME(6) NOT NULL,
    last_seen_at DATETIME(6) NOT NULL,
    UNIQUE KEY participants_room_user_unique (room_id, user_id),
    KEY participants_room_seen_index (room_id, last_seen_at),
    CONSTRAINT participants_room_fk
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE,
    CONSTRAINT participants_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    room_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    sender_display_name VARCHAR(40) NOT NULL,
    sender_mobile_display VARCHAR(11) NOT NULL,
    body_text TEXT NULL,
    parent_message_id BIGINT UNSIGNED NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    deleted_at DATETIME(6) NULL,
    KEY messages_room_updated_index (room_id, updated_at),
    KEY messages_user_index (user_id),
    KEY messages_parent_message_index (parent_message_id),
    CONSTRAINT messages_room_fk
        FOREIGN KEY (room_id) REFERENCES rooms (id)
        ON DELETE CASCADE,
    CONSTRAINT messages_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE attachments (
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
