<?php

declare(strict_types=1);

namespace App\Support;

use DateTimeImmutable;
use PDO;

class OtpService
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly SmsIrService $sms
    ) {
    }

    public static function make(): self
    {
        return new self(Database::connection(), new SmsIrService());
    }

    public function requestOtp(string $mobileNormalized, string $purpose, array $meta = []): array
    {
        $latest = $this->findLatestRecord($mobileNormalized, $purpose);
        $now = $this->now();
        $cooldownSeconds = (int) app_config('otp.resend_cooldown_seconds', 60);
        $ttlSeconds = (int) app_config('otp.ttl_seconds', 120);
        $maxAttempts = (int) app_config('otp.max_attempts', 3);

        if ($latest !== null && $latest['consumed_at'] === null) {
            $resendAt = $this->parseDate((string) $latest['resend_available_at']);

            if ($resendAt !== null && $resendAt > new DateTimeImmutable('now')) {
                $seconds = max(1, $resendAt->getTimestamp() - time());
                throw new ApiException("ارسال مجدد تا {$seconds} ثانیه دیگر ممکن است.", 429, [
                    'cooldownSeconds' => $seconds,
                ]);
            }
        }

        $code = $this->generateCode();
        $metaToStore = $meta;

        if ((bool) app_config('sms.fake', false)) {
            $metaToStore['_debugCode'] = $code;
        }

        $this->sms->sendVerify($mobileNormalized, $code);
        $this->invalidateActiveRecords($mobileNormalized, $purpose, $now);

        $statement = $this->pdo->prepare(
            'INSERT INTO otp_verifications (
                mobile_normalized, purpose, code_hash, attempt_count, max_attempts, expires_at, resend_available_at,
                verified_at, consumed_at, profile_completed_at, meta_json, created_at, updated_at
             ) VALUES (
                :mobile_normalized, :purpose, :code_hash, :attempt_count, :max_attempts, :expires_at, :resend_available_at,
                NULL, NULL, NULL, :meta_json, :created_at, :updated_at
             )'
        );
        $statement->execute([
            'mobile_normalized' => $mobileNormalized,
            'purpose' => $purpose,
            'code_hash' => hash('sha256', $code),
            'attempt_count' => 0,
            'max_attempts' => $maxAttempts,
            'expires_at' => date('Y-m-d H:i:s.u', time() + $ttlSeconds),
            'resend_available_at' => date('Y-m-d H:i:s.u', time() + $cooldownSeconds),
            'meta_json' => $metaToStore === [] ? null : json_encode($metaToStore, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return [
            'cooldownSeconds' => $cooldownSeconds,
            'expiresInSeconds' => $ttlSeconds,
        ];
    }

    public function verifyOtp(string $mobileNormalized, string $purpose, string $code): array
    {
        $record = $this->requirePendingRecord($mobileNormalized, $purpose);

        if ((int) $record['attempt_count'] >= (int) $record['max_attempts']) {
            throw new ApiException('تعداد تلاش‌های وارد کردن کد بیش از حد مجاز است.', 429);
        }

        if (!hash_equals((string) $record['code_hash'], hash('sha256', trim($code)))) {
            $nextAttemptCount = (int) $record['attempt_count'] + 1;
            $statement = $this->pdo->prepare(
                'UPDATE otp_verifications
                 SET attempt_count = :attempt_count,
                     updated_at = :updated_at
                 WHERE id = :id'
            );
            $statement->execute([
                'attempt_count' => $nextAttemptCount,
                'updated_at' => $this->now(),
                'id' => (int) $record['id'],
            ]);

            if ($nextAttemptCount >= (int) $record['max_attempts']) {
                throw new ApiException('تعداد تلاش‌های وارد کردن کد بیش از حد مجاز است.', 429);
            }

            throw new ApiException('کد واردشده درست نیست.', 422);
        }

        $verifiedAt = $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE otp_verifications
             SET verified_at = :verified_at,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'verified_at' => $verifiedAt,
            'updated_at' => $verifiedAt,
            'id' => (int) $record['id'],
        ]);

        $record['verified_at'] = $verifiedAt;

        return $record;
    }

    public function requireVerifiedRecord(string $mobileNormalized, string $purpose): array
    {
        $record = $this->requirePendingRecord($mobileNormalized, $purpose);

        if (!is_string($record['verified_at']) || $record['verified_at'] === '') {
            throw new ApiException('ابتدا کد تایید را وارد کنید.', 422);
        }

        return $record;
    }

    public function consumeRecord(int $recordId, array $meta = []): void
    {
        $record = $this->requireRecordById($recordId);
        $mergedMeta = array_merge($this->decodeMeta($record), $meta);
        $now = $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE otp_verifications
             SET consumed_at = :consumed_at,
                 meta_json = :meta_json,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'consumed_at' => $now,
            'meta_json' => $mergedMeta === [] ? null : json_encode($mergedMeta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => $now,
            'id' => $recordId,
        ]);
    }

    public function markProfileCompleted(int $recordId, array $meta = []): void
    {
        $record = $this->requireRecordById($recordId);
        $mergedMeta = array_merge($this->decodeMeta($record), $meta);
        $now = $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE otp_verifications
             SET profile_completed_at = :profile_completed_at,
                 consumed_at = :consumed_at,
                 meta_json = :meta_json,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'profile_completed_at' => $now,
            'consumed_at' => $now,
            'meta_json' => $mergedMeta === [] ? null : json_encode($mergedMeta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => $now,
            'id' => $recordId,
        ]);
    }

    public function decodeMeta(array $record): array
    {
        $decoded = json_decode((string) ($record['meta_json'] ?? ''), true);

        return is_array($decoded) ? $decoded : [];
    }

    public function findLatestRecord(string $mobileNormalized, string $purpose): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT *
             FROM otp_verifications
             WHERE mobile_normalized = :mobile_normalized
               AND purpose = :purpose
             ORDER BY id DESC
             LIMIT 1'
        );
        $statement->execute([
            'mobile_normalized' => $mobileNormalized,
            'purpose' => $purpose,
        ]);
        $record = $statement->fetch();

        return $record === false ? null : $record;
    }

    private function requirePendingRecord(string $mobileNormalized, string $purpose): array
    {
        $record = $this->findLatestRecord($mobileNormalized, $purpose);

        if ($record === null || $record['consumed_at'] !== null) {
            throw new ApiException('برای این شماره کد فعالی پیدا نشد.', 404);
        }

        $expiresAt = $this->parseDate((string) $record['expires_at']);

        if ($expiresAt === null || $expiresAt <= new DateTimeImmutable('now')) {
            throw new ApiException('کد تایید منقضی شده است.', 422);
        }

        return $record;
    }

    private function requireRecordById(int $recordId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM otp_verifications WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $recordId]);
        $record = $statement->fetch();

        if ($record === false) {
            throw new ApiException('رکورد کد تایید پیدا نشد.', 404);
        }

        return $record;
    }

    private function invalidateActiveRecords(string $mobileNormalized, string $purpose, string $now): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE otp_verifications
             SET consumed_at = :consumed_at,
                 updated_at = :updated_at
             WHERE mobile_normalized = :mobile_normalized
               AND purpose = :purpose
               AND consumed_at IS NULL'
        );
        $statement->execute([
            'consumed_at' => $now,
            'updated_at' => $now,
            'mobile_normalized' => $mobileNormalized,
            'purpose' => $purpose,
        ]);
    }

    private function generateCode(): string
    {
        $length = max(4, (int) app_config('otp.length', 5));
        $min = (int) (10 ** ($length - 1));
        $max = (int) ((10 ** $length) - 1);

        return (string) random_int($min, $max);
    }

    private function parseDate(string $value): ?DateTimeImmutable
    {
        try {
            return new DateTimeImmutable($value);
        } catch (\Throwable) {
            return null;
        }
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.u');
    }
}
