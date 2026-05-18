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
        $currentUser = $this->currentUser();

        if ($currentUser !== null && $this->isGuest($currentUser)) {
            $this->convertGuestToRegistered((int) $currentUser['id'], $mobileNormalized, $displayName, $passwordHash, $now);
            $user = $this->requireUserById((int) $currentUser['id']);
            $this->replaceSessionsForUser((int) $user['id']);

            return [
                'user' => $this->serializeUser($user),
            ];
        }

        try {
            $statement = $this->pdo->prepare(
                'INSERT INTO users (kind, mobile_normalized, display_name, password_hash, created_at, updated_at)
                 VALUES (:kind, :mobile_normalized, :display_name, :password_hash, :created_at, :updated_at)'
            );
            $statement->execute([
                'kind' => 'registered',
                'mobile_normalized' => $mobileNormalized,
                'display_name' => $displayName,
                'password_hash' => $passwordHash,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        } catch (Throwable $throwable) {
            throw new ApiException('این شماره موبایل قبلا ثبت شده است.', 409, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }

        $user = $this->requireUserById((int) $this->pdo->lastInsertId());
        $this->replaceSessionsForUser((int) $user['id']);

        return [
            'user' => $this->serializeUser($user),
        ];
    }

    public function requestRegisterOtp(string $mobileInput, string $displayName, string $password): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $displayName = $this->sanitizeDisplayName($displayName);
        $passwordHash = password_hash($this->sanitizePassword($password), PASSWORD_DEFAULT);

        if ($this->findUserByMobile($mobileNormalized) !== null) {
            throw new ApiException('این شماره موبایل قبلاً ثبت شده است.', 409);
        }

        return OtpService::make()->requestOtp($mobileNormalized, 'register', [
            'displayName' => $displayName,
            'passwordHash' => $passwordHash,
        ]);
    }

    public function confirmRegisterOtp(string $mobileInput, string $code): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);

        if ($this->findUserByMobile($mobileNormalized) !== null) {
            throw new ApiException('این شماره موبایل قبلاً ثبت شده است.', 409);
        }

        $otp = OtpService::make();
        $record = $otp->verifyOtp($mobileNormalized, 'register', $code);
        $meta = $otp->decodeMeta($record);
        $displayName = trim((string) ($meta['displayName'] ?? ''));
        $passwordHash = (string) ($meta['passwordHash'] ?? '');

        if ($displayName === '' || $passwordHash === '') {
            throw new ApiException('اطلاعات ثبت‌نام این کد کامل نیست.', 422);
        }

        $now = $this->now();

        try {
            $statement = $this->pdo->prepare(
                'INSERT INTO users (kind, mobile_normalized, display_name, password_hash, created_at, updated_at)
                 VALUES (:kind, :mobile_normalized, :display_name, :password_hash, :created_at, :updated_at)'
            );
            $statement->execute([
                'kind' => 'registered',
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
        $otp->consumeRecord((int) $record['id']);
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

        if (
            $user === false
            || !$this->isRegistered($user)
            || !is_string($user['password_hash'])
            || !password_verify($password, (string) $user['password_hash'])
        ) {
            throw new ApiException('شماره موبایل یا رمز نادرست است.', 401);
        }

        $currentUser = $this->currentUser();

        if ($currentUser !== null && $this->isGuest($currentUser) && (int) $currentUser['id'] !== (int) $user['id']) {
            $this->mergeGuestIntoUser((int) $currentUser['id'], (int) $user['id']);
            $user = $this->requireUserById((int) $user['id']);
        }

        $this->createSession((int) $user['id']);

        return [
            'user' => $this->serializeUser($user),
        ];
    }

    public function requestLoginOtp(string $mobileInput): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);

        return OtpService::make()->requestOtp($mobileNormalized, 'login');
    }

    public function verifyLoginOtp(string $mobileInput, string $code): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $otp = OtpService::make();
        $record = $otp->verifyOtp($mobileNormalized, 'login', $code);
        $user = $this->findUserByMobile($mobileNormalized);

        if ($user !== null) {
            if (!$this->isRegistered($user)) {
                throw new ApiException('این شماره برای حساب مهمان قابل استفاده نیست.', 403);
            }

            $otp->consumeRecord((int) $record['id']);
            $this->createSession((int) $user['id']);

            return [
                'needsProfile' => false,
                'user' => $this->serializeUser($user),
            ];
        }

        return [
            'needsProfile' => true,
            'mobileDisplay' => MobileNumber::toDisplay($mobileNormalized),
        ];
    }

    public function completeLoginOtpProfile(string $mobileInput, string $displayName): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $displayName = $this->sanitizeDisplayName($displayName);

        if ($this->findUserByMobile($mobileNormalized) !== null) {
            throw new ApiException('این شماره موبایل قبلاً ثبت شده است.', 409);
        }

        $otp = OtpService::make();
        $record = $otp->requireVerifiedRecord($mobileNormalized, 'login');
        $meta = $otp->decodeMeta($record);

        if (($meta['profileCreated'] ?? false) === true) {
            throw new ApiException('این حساب قبلاً تکمیل شده است.', 409);
        }

        $now = $this->now();
        $statement = $this->pdo->prepare(
            'INSERT INTO users (kind, mobile_normalized, display_name, password_hash, created_at, updated_at)
             VALUES (:kind, :mobile_normalized, :display_name, NULL, :created_at, :updated_at)'
        );
        $statement->execute([
            'kind' => 'registered',
            'mobile_normalized' => $mobileNormalized,
            'display_name' => $displayName,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $user = $this->requireUserById((int) $this->pdo->lastInsertId());
        $otp->markProfileCompleted((int) $record['id'], [
            'profileCreated' => true,
            'displayName' => $displayName,
        ]);
        $this->replaceSessionsForUser((int) $user['id']);

        return [
            'user' => $this->serializeUser($user),
        ];
    }

    public function requestPasswordResetOtp(string $mobileInput): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $user = $this->findRegisteredUserByMobile($mobileNormalized);

        if ($user === null) {
            throw new ApiException('حسابی با این شماره موبایل پیدا نشد.', 404);
        }

        if (!is_string($user['password_hash']) || trim((string) $user['password_hash']) === '') {
            throw new ApiException('برای این حساب هنوز رمزی تعریف نشده است.', 422);
        }

        return OtpService::make()->requestOtp($mobileNormalized, 'password_reset');
    }

    public function resetPasswordWithOtp(string $mobileInput, string $code, string $newPassword): array
    {
        $mobileNormalized = MobileNumber::normalize($mobileInput);
        $user = $this->findRegisteredUserByMobile($mobileNormalized);

        if ($user === null) {
            throw new ApiException('حسابی با این شماره موبایل پیدا نشد.', 404);
        }

        $passwordHash = password_hash($this->sanitizePassword($newPassword), PASSWORD_DEFAULT);
        $otp = OtpService::make();
        $record = $otp->verifyOtp($mobileNormalized, 'password_reset', $code);
        $statement = $this->pdo->prepare(
            'UPDATE users
             SET password_hash = :password_hash,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'password_hash' => $passwordHash,
            'updated_at' => $this->now(),
            'id' => (int) $user['id'],
        ]);

        $otp->consumeRecord((int) $record['id']);
        $this->replaceSessionsForUser((int) $user['id']);

        return [
            'passwordReset' => true,
            'user' => $this->serializeUser($this->requireUserById((int) $user['id'])),
        ];
    }

    public function createGuest(string $displayName): array
    {
        $displayName = $this->sanitizeDisplayName($displayName);
        $now = $this->now();
        $statement = $this->pdo->prepare(
            'INSERT INTO users (kind, mobile_normalized, display_name, password_hash, created_at, updated_at)
             VALUES (:kind, NULL, :display_name, NULL, :created_at, :updated_at)'
        );
        $statement->execute([
            'kind' => 'guest',
            'display_name' => $displayName,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $user = $this->requireUserById((int) $this->pdo->lastInsertId());
        $this->replaceSessionsForUser((int) $user['id']);

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

    public function requireRegisteredUser(): array
    {
        $user = $this->requireAuthenticatedUser();

        if (!$this->isRegistered($user)) {
            throw new ApiException('این بخش فقط برای کاربران ثبت نام شده است.', 403);
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
             WHERE id = :id
               AND kind = :kind'
        );
        $statement->execute([
            'display_name' => $displayName,
            'updated_at' => $this->now(),
            'id' => $userId,
            'kind' => 'registered',
        ]);

        return [
            'user' => $this->serializeUser($this->requireUserById($userId)),
        ];
    }

    public function updatePassword(int $userId, string $currentPassword, string $newPassword): array
    {
        $user = $this->requireUserById($userId);

        if (!$this->isRegistered($user) || !is_string($user['password_hash']) || !password_verify($currentPassword, (string) $user['password_hash'])) {
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

    public function searchUsers(string $query, int $viewerUserId): array
    {
        $query = trim(preg_replace('/\s+/u', ' ', $query) ?? '');

        if (mb_strlen($query) < 2) {
            return ['contacts' => []];
        }

        $digits = preg_replace('/\D+/', '', $query) ?? '';
        $nameLike = '%' . $this->escapeLike($query) . '%';
        $mobileLike = $digits !== '' ? '%' . $this->escapeLike($digits) . '%' : '__NO_MOBILE_MATCH__';

        $statement = $this->pdo->prepare(
            "SELECT id, mobile_normalized, display_name
             FROM users
             WHERE id <> :viewer_user_id
               AND kind = 'registered'
               AND (
                    display_name LIKE :name_like ESCAPE '\\\\'
                    OR REPLACE(REPLACE(mobile_normalized, '+98', '0'), '+', '') LIKE :mobile_like_display ESCAPE '\\\\'
                    OR REPLACE(mobile_normalized, '+', '') LIKE :mobile_like_normalized ESCAPE '\\\\'
               )
             ORDER BY display_name ASC, id ASC
             LIMIT 8"
        );
        $statement->execute([
            'viewer_user_id' => $viewerUserId,
            'name_like' => $nameLike,
            'mobile_like_display' => $mobileLike,
            'mobile_like_normalized' => $mobileLike,
        ]);

        return [
            'contacts' => array_map(fn (array $user): array => [
                'id' => (int) $user['id'],
                'displayName' => (string) $user['display_name'],
                'mobileDisplay' => MobileNumber::toDisplay((string) $user['mobile_normalized']),
            ], $statement->fetchAll()),
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

    private function convertGuestToRegistered(int $guestUserId, string $mobileNormalized, string $displayName, string $passwordHash, string $now): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE users
             SET kind = :kind,
                 mobile_normalized = :mobile_normalized,
                 display_name = :display_name,
                 password_hash = :password_hash,
                 updated_at = :updated_at
             WHERE id = :id
               AND kind = :guest_kind'
        );

        try {
            $statement->execute([
                'kind' => 'registered',
                'mobile_normalized' => $mobileNormalized,
                'display_name' => $displayName,
                'password_hash' => $passwordHash,
                'updated_at' => $now,
                'id' => $guestUserId,
                'guest_kind' => 'guest',
            ]);
        } catch (Throwable $throwable) {
            throw new ApiException('این شماره موبایل قبلا ثبت شده است. برای انتقال مهمان، وارد حساب شوید.', 409, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }

        if ($statement->rowCount() === 0) {
            throw new ApiException('نشست مهمان معتبر نیست.', 409);
        }

        $participantStatement = $this->pdo->prepare(
            'UPDATE participants
             SET display_name = :display_name,
                 mobile_display = :mobile_display
             WHERE user_id = :user_id'
        );
        $participantStatement->execute([
            'display_name' => $displayName,
            'mobile_display' => MobileNumber::toDisplay($mobileNormalized),
            'user_id' => $guestUserId,
        ]);
    }

    private function mergeGuestIntoUser(int $guestUserId, int $targetUserId): void
    {
        $targetUser = $this->requireUserById($targetUserId);
        $targetMobileDisplay = MobileNumber::toDisplay((string) $targetUser['mobile_normalized']);
        $now = $this->now();

        try {
            $this->pdo->beginTransaction();

            $roomStatement = $this->pdo->prepare('UPDATE rooms SET creator_user_id = :target_user_id WHERE creator_user_id = :guest_user_id');
            $roomStatement->execute([
                'target_user_id' => $targetUserId,
                'guest_user_id' => $guestUserId,
            ]);

            $messageStatement = $this->pdo->prepare('UPDATE messages SET user_id = :target_user_id WHERE user_id = :guest_user_id');
            $messageStatement->execute([
                'target_user_id' => $targetUserId,
                'guest_user_id' => $guestUserId,
            ]);

            $participantsStatement = $this->pdo->prepare(
                'SELECT id, room_id, joined_at, last_seen_at
                 FROM participants
                 WHERE user_id = :guest_user_id
                 ORDER BY id ASC'
            );
            $participantsStatement->execute(['guest_user_id' => $guestUserId]);

            foreach ($participantsStatement->fetchAll() as $participant) {
                $existingStatement = $this->pdo->prepare(
                    'SELECT id, joined_at, last_seen_at
                     FROM participants
                     WHERE room_id = :room_id
                       AND user_id = :target_user_id
                     LIMIT 1'
                );
                $existingStatement->execute([
                    'room_id' => (int) $participant['room_id'],
                    'target_user_id' => $targetUserId,
                ]);
                $existing = $existingStatement->fetch();

                if ($existing !== false) {
                    $joinedAt = min((string) $existing['joined_at'], (string) $participant['joined_at']);
                    $lastSeenAt = max((string) $existing['last_seen_at'], (string) $participant['last_seen_at'], $now);
                    $updateExisting = $this->pdo->prepare(
                        'UPDATE participants
                         SET display_name = :display_name,
                             mobile_display = :mobile_display,
                             joined_at = :joined_at,
                             last_seen_at = :last_seen_at
                         WHERE id = :id'
                    );
                    $updateExisting->execute([
                        'display_name' => (string) $targetUser['display_name'],
                        'mobile_display' => $targetMobileDisplay,
                        'joined_at' => $joinedAt,
                        'last_seen_at' => $lastSeenAt,
                        'id' => (int) $existing['id'],
                    ]);

                    $deleteGuestParticipant = $this->pdo->prepare('DELETE FROM participants WHERE id = :id');
                    $deleteGuestParticipant->execute(['id' => (int) $participant['id']]);
                    continue;
                }

                $moveParticipant = $this->pdo->prepare(
                    'UPDATE participants
                     SET user_id = :target_user_id,
                         display_name = :display_name,
                         mobile_display = :mobile_display
                     WHERE id = :id'
                );
                $moveParticipant->execute([
                    'target_user_id' => $targetUserId,
                    'display_name' => (string) $targetUser['display_name'],
                    'mobile_display' => $targetMobileDisplay,
                    'id' => (int) $participant['id'],
                ]);
            }

            $sessionStatement = $this->pdo->prepare('DELETE FROM auth_sessions WHERE user_id = :guest_user_id');
            $sessionStatement->execute(['guest_user_id' => $guestUserId]);

            $deleteStatement = $this->pdo->prepare('DELETE FROM users WHERE id = :guest_user_id AND kind = :kind');
            $deleteStatement->execute([
                'guest_user_id' => $guestUserId,
                'kind' => 'guest',
            ]);

            $this->pdo->commit();
        } catch (Throwable $throwable) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw new ApiException('انتقال داده های مهمان انجام نشد.', 500, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }
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

    private function findUserByMobile(string $mobileNormalized): ?array
    {
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

        return $user === false ? null : $user;
    }

    private function findRegisteredUserByMobile(string $mobileNormalized): ?array
    {
        $user = $this->findUserByMobile($mobileNormalized);

        if ($user === null || !$this->isRegistered($user)) {
            return null;
        }

        return $user;
    }

    private function serializeUserOrNull(?array $user): ?array
    {
        return $user === null ? null : $this->serializeUser($user);
    }

    private function serializeUser(array $user): array
    {
        $mobileNormalized = $user['mobile_normalized'] ?? null;

        return [
            'id' => (int) $user['id'],
            'displayName' => (string) $user['display_name'],
            'mobileDisplay' => is_string($mobileNormalized) ? MobileNumber::toDisplay($mobileNormalized) : null,
            'mobileNormalized' => is_string($mobileNormalized) ? $mobileNormalized : null,
            'isGuest' => $this->isGuest($user),
        ];
    }

    private function isGuest(array $user): bool
    {
        return ($user['kind'] ?? 'registered') === 'guest';
    }

    private function isRegistered(array $user): bool
    {
        return !$this->isGuest($user);
    }

    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    private function sanitizeDisplayName(string $displayName): string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', $displayName) ?? '');
        $maxLength = (int) app_config('app.max_display_name_length', 40);

        if ($normalized === '') {
            throw new ApiException('نام را وارد کنید.', 422);
        }

        if (mb_strlen($normalized) > $maxLength) {
            throw new ApiException("نام نمی تواند بیشتر از {$maxLength} کاراکتر باشد.", 422);
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
