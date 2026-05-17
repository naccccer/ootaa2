<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeImmutable;
use PDO;
use Throwable;

class AuthService
{
    private static ?array $resolvedUser = null;
    private static bool $userResolved = false;
    private static ?string $resolvedToken = null;
    private static bool $tokenResolved = false;

    public function __construct(private readonly PDO $pdo)
    {
    }

    public static function make(): self
    {
        return new self(Database::connection());
    }

    public function register(string $mobileInput, string $displayName, string $password): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $displayName = $this->sanitizeDisplayName($displayName);
        $passwordHash = password_hash($this->sanitizePassword($password), PASSWORD_DEFAULT);
        $now = $this->now();

        try {
            $statement = $this->pdo->prepare(
                'INSERT INTO users (mobile_normalized, display_name, password_hash, created_at, updated_at)
                 VALUES (:mobile_normalized, :display_name, :password_hash, :created_at, :updated_at)'
            );
            $statement->execute([
                'mobile_normalized' => $mobileNormalized,
                'display_name' => $displayName,
                'password_hash' => $passwordHash,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (Throwable $throwable) {
            throw new ApiException('این شماره موبایل قبلاً ثبت شده است.', 409, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }

        $user = $this->requireUserById((int) $this->pdo->lastInsertId());
        $this->replaceSessionsForUser((int) $user['id']);

        return [
            'user' => $this->serializeUser($user),
        ];
    }

    public function login(string $mobileInput, string $password): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $statement = $this->pdo->prepare(
            'SELECT *
             FROM users
             WHERE mobile_normalized = :mobile_normalized
             LIMIT 1'
        );
        $statement->execute([
            'mobile_normalized' => $mobileNormalized,
        ]);
        $user = $statement->fetch();

        if ($user === false || !password_verify($password, (string) $user['password_hash'])) {
            throw new ApiException('شماره موبایل یا رمز نادرست است.', 401);
        }

        $this->createSession((int) $user['id']);

        return [
            'user' => $this->serializeUser($user),
        ];
    }

    public function logout(): array
    {
        $tokenHash = $this->currentTokenHash();

        if ($tokenHash !== null) {
            $statement = $this->pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = :token_hash');
            $statement->execute(['token_hash' => $tokenHash]);
        }

        $this->clearSessionCookie();

        return ['loggedOut' => true];
    }

    public function me(): array
    {
        return [
            'user' => $this->serializeUserOrNull($this->currentUser()),
        ];
    }

    public function currentUser(): ?array
    {
        if (self::$userResolved) {
            return self::$resolvedUser;
        }

        self::$userResolved = true;
        self::$resolvedUser = null;

        $tokenHash = $this->currentTokenHash();

        if ($tokenHash === null) {
            return null;
        }

        $statement = $this->pdo->prepare(
            'SELECT users.*
             FROM auth_sessions
             INNER JOIN users ON users.id = auth_sessions.user_id
             WHERE auth_sessions.token_hash = :token_hash
               AND auth_sessions.expires_at > :now
             LIMIT 1'
        );
        $statement->execute([
            'token_hash' => $tokenHash,
            'now' => $this->now(),
        ]);
        $user = $statement->fetch();

        if ($user === false) {
            $this->clearSessionCookie();
            return null;
        }

        $touch = $this->pdo->prepare(
            'UPDATE auth_sessions
             SET last_seen_at = :last_seen_at
             WHERE token_hash = :token_hash'
        );
        $touch->execute([
            'last_seen_at' => $this->now(),
            'token_hash' => $tokenHash,
        ]);

        self::$resolvedUser = $user;

        return self::$resolvedUser;
    }

    public function requireAuthenticatedUser(): array
    {
        $user = $this->currentUser();

        if ($user === null) {
            throw new ApiException('ابتدا وارد حساب خود شوید.', 401);
        }

        return $user;
    }

    public function updateProfile(int $userId, string $displayName): array
    {
        $displayName = $this->sanitizeDisplayName($displayName);
        $statement = $this->pdo->prepare(
            'UPDATE users
             SET display_name = :display_name,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'display_name' => $displayName,
            'updated_at' => $this->now(),
            'id' => $userId,
        ]);

        return [
            'user' => $this->serializeUser($this->requireUserById($userId)),
        ];
    }

    public function updatePassword(int $userId, string $currentPassword, string $newPassword): array
    {
        $user = $this->requireUserById($userId);

        if (!password_verify($currentPassword, (string) $user['password_hash'])) {
            throw new ApiException('رمز فعلی درست نیست.', 422);
        }

        $statement = $this->pdo->prepare(
            'UPDATE users
             SET password_hash = :password_hash,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'password_hash' => password_hash($this->sanitizePassword($newPassword), PASSWORD_DEFAULT),
            'updated_at' => $this->now(),
            'id' => $userId,
        ]);

        $this->replaceSessionsForUser($userId);

        return [
            'user' => $this->serializeUser($this->requireUserById($userId)),
        ];
    }

    private function replaceSessionsForUser(int $userId): void
    {
        $statement = $this->pdo->prepare('DELETE FROM auth_sessions WHERE user_id = :user_id');
        $statement->execute(['user_id' => $userId]);
        $this->createSession($userId);
    }

    private function createSession(int $userId): void
    {
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $now = $this->now();
        $ttlSeconds = (int) app_config('auth.session_ttl_seconds', 60 * 60 * 24 * 30);
        $expiresAt = date('Y-m-d H:i:s.u', time() + $ttlSeconds);

        $statement = $this->pdo->prepare(
            'INSERT INTO auth_sessions (user_id, token_hash, created_at, last_seen_at, expires_at)
             VALUES (:user_id, :token_hash, :created_at, :last_seen_at, :expires_at)'
        );
        $statement->execute([
            'user_id' => $userId,
            'token_hash' => $tokenHash,
            'created_at' => $now,
            'last_seen_at' => $now,
            'expires_at' => $expiresAt,
        ]);

        $this->writeSessionCookie($token);
        self::$userResolved = false;
        self::$resolvedUser = null;
    }

    private function currentTokenHash(): ?string
    {
        $token = $this->currentToken();

        return $token === null ? null : hash('sha256', $token);
    }

    private function currentToken(): ?string
    {
        if (self::$tokenResolved) {
            return self::$resolvedToken;
        }

        self::$tokenResolved = true;
        $cookieName = (string) app_config('auth.cookie_name');
        $token = $_COOKIE[$cookieName] ?? null;

        if (!is_string($token) || preg_match('/^[a-f0-9]{64}$/', $token) !== 1) {
            self::$resolvedToken = null;
            return null;
        }

        self::$resolvedToken = $token;

        return self::$resolvedToken;
    }

    private function writeSessionCookie(string $token): void
    {
        $path = app_base_path();
        $cookiePath = $path === '' ? '/' : $path . '/';
        $cookieName = (string) app_config('auth.cookie_name');
        $ttlSeconds = (int) app_config('auth.session_ttl_seconds', 60 * 60 * 24 * 30);

        setcookie($cookieName, $token, [
            'expires' => time() + $ttlSeconds,
            'path' => $cookiePath,
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        $_COOKIE[$cookieName] = $token;
        self::$tokenResolved = true;
        self::$resolvedToken = $token;
    }

    private function clearSessionCookie(): void
    {
        $path = app_base_path();
        $cookiePath = $path === '' ? '/' : $path . '/';
        $cookieName = (string) app_config('auth.cookie_name');

        setcookie($cookieName, '', [
            'expires' => time() - 3600,
            'path' => $cookiePath,
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);

        unset($_COOKIE[$cookieName]);
        self::$tokenResolved = true;
        self::$resolvedToken = null;
        self::$userResolved = true;
        self::$resolvedUser = null;
    }

    private function requireUserById(int $userId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM users WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $userId]);
        $user = $statement->fetch();

        if ($user === false) {
            throw new ApiException('کاربر پیدا نشد.', 404);
        }

        return $user;
    }

    private function serializeUserOrNull(?array $user): ?array
    {
        return $user === null ? null : $this->serializeUser($user);
    }

    private function serializeUser(array $user): array
    {
        return [
            'id' => (int) $user['id'],
            'displayName' => (string) $user['display_name'],
            'mobileDisplay' => MobileNumber::toDisplay((string) $user['mobile_normalized']),
            'mobileNormalized' => (string) $user['mobile_normalized'],
        ];
    }

    private function sanitizeDisplayName(string $displayName): string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', $displayName) ?? '');
        $maxLength = (int) app_config('app.max_display_name_length', 40);

        if ($normalized === '') {
            throw new ApiException('نام را وارد کنید.', 422);
        }

        if (mb_strlen($normalized) > $maxLength) {
            throw new ApiException("نام نمی‌تواند بیشتر از {$maxLength} کاراکتر باشد.", 422);
        }

        return $normalized;
    }

    private function sanitizePassword(string $password): string
    {
        $trimmed = trim($password);

        if (strlen($trimmed) < 8) {
            throw new ApiException('رمز باید حداقل 8 کاراکتر باشد.', 422);
        }

        return $trimmed;
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.u');
    }
}
