<?php

declare(strict_types=1);

namespace App\Support;

class BrowserSession
{
    public static function ensureBrowserId(): string
    {
        $cookieName = (string) app_config('app.cookie_name');
        $existing = $_COOKIE[$cookieName] ?? null;

        if (is_string($existing) && preg_match('/^[a-f0-9]{64}$/', $existing) === 1) {
            return $existing;
        }

        $browserId = bin2hex(random_bytes(32));
        $ttlDays = (int) app_config('app.cookie_ttl_days', 180);
        $expiresAt = time() + ($ttlDays * 86400);
        $path = app_base_path();
        $cookiePath = $path === '' ? '/' : $path . '/';

        setcookie($cookieName, $browserId, [
            'expires' => $expiresAt,
            'path' => $cookiePath,
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        $_COOKIE[$cookieName] = $browserId;

        return $browserId;
    }
}

