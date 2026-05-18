<?php

declare(strict_types=1);

$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$basePath = $scriptName === '' ? '' : rtrim(str_replace('\\', '/', dirname($scriptName)), '/.');
$httpHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$serverName = strtolower((string) ($_SERVER['SERVER_NAME'] ?? ''));
$appEnv = strtolower((string) (getenv('APP_ENV') ?: ''));
$projectPath = strtolower(str_replace('/', '\\', dirname(__DIR__)));
$isLocalHost = in_array($httpHost, ['localhost', '127.0.0.1'], true)
    || str_contains($httpHost, 'localhost:')
    || str_contains($httpHost, '127.0.0.1:')
    || in_array($serverName, ['localhost', '127.0.0.1'], true);
$isLocalEnvironment = in_array($appEnv, ['local', 'development', 'dev'], true)
    || $isLocalHost
    || str_contains($projectPath, '\\xampp\\htdocs\\');

return [
    'app' => [
        'name' => 'اوتا',
        'debug' => filter_var(getenv('APP_DEBUG') ?: 'false', FILTER_VALIDATE_BOOL),
        'base_path' => $basePath,
        'room_expiry_seconds' => 60 * 60 * 24 * 7,
        'presence_window_seconds' => 120,
        'max_display_name_length' => 40,
        'max_room_name_length' => 80,
        'max_message_length' => 4000,
        'recent_messages_limit' => 60,
        'upload_dir' => storage_path('uploads'),
    ],
    'auth' => [
        'cookie_name' => getenv('APP_AUTH_COOKIE') ?: 'ootaa_auth',
        'session_ttl_seconds' => 60 * 60 * 24 * 30,
    ],
    'otp' => [
        'length' => (int) (getenv('OTP_LENGTH') ?: 5),
        'ttl_seconds' => (int) (getenv('OTP_TTL_SECONDS') ?: 120),
        'max_attempts' => (int) (getenv('OTP_MAX_ATTEMPTS') ?: 3),
        'resend_cooldown_seconds' => (int) (getenv('OTP_RESEND_COOLDOWN_SECONDS') ?: 60),
    ],
    'sms' => [
        'api_key' => getenv('SMSIR_API_KEY') ?: '',
        'verify_url' => getenv('SMSIR_VERIFY_URL') ?: 'https://api.sms.ir/v1/send/verify',
        'template_id' => (int) (getenv('SMSIR_TEMPLATE_ID') ?: 123456),
        'fake' => filter_var(getenv('SMSIR_FAKE') ?: ($isLocalEnvironment ? 'true' : 'false'), FILTER_VALIDATE_BOOL),
    ],
    'db' => [
        'host' => getenv('DB_HOST') ?: ($isLocalEnvironment ? '127.0.0.1' : 'localhost'),
        'port' => (int) (getenv('DB_PORT') ?: 3306),
        'database' => getenv('DB_DATABASE') ?: ($isLocalEnvironment ? 'ootaa2' : 'naserz_ootaadb'),
        'username' => getenv('DB_USERNAME') ?: ($isLocalEnvironment ? 'root' : 'naserz_ootaadb_user'),
        'password' => getenv('DB_PASSWORD') ?: ($isLocalEnvironment ? '' : 'N@199137r'),
        'charset' => 'utf8mb4',
    ],
];
