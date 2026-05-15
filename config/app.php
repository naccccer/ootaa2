<?php

declare(strict_types=1);

$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$basePath = $scriptName === '' ? '' : rtrim(str_replace('\\', '/', dirname($scriptName)), '/.');

return [
    'app' => [
        'name' => 'اوتا',
        'debug' => filter_var(getenv('APP_DEBUG') ?: 'false', FILTER_VALIDATE_BOOL),
        'base_path' => $basePath,
        'room_expiry_seconds' => 60 * 60 * 24 * 3,
        'max_display_name_length' => 40,
        'max_message_length' => 4000,
        'recent_messages_limit' => 60,
        'cookie_name' => getenv('APP_BROWSER_COOKIE') ?: 'ootaa_browser',
        'cookie_ttl_days' => 180,
        'upload_dir' => storage_path('uploads'),
    ],
    'db' => [
        'host' => getenv('DB_HOST') ?: '127.0.0.1',
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'database' => getenv('DB_DATABASE') ?: 'ootaa2',
        'username' => getenv('DB_USERNAME') ?: 'root',
        'password' => getenv('DB_PASSWORD') ?: '',
        'charset' => 'utf8mb4',
    ],
];

