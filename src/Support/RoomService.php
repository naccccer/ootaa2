<?php

declare(strict_types=1);

namespace App\Support;

use DateInterval;
use DateTimeImmutable;
use PDO;
use Throwable;

class RoomService
{
    public function __construct(private readonly PDO $pdo)
    {
    }

    public static function make(): self
    {
        return new self(Database::connection());
    }

    public function health(): array
    {
        $this->pdo->query('SELECT 1')->fetchColumn();

        return [
            'app' => app_config('app.name'),
            'time' => $this->now(),
        ];
    }

    public function enterRoom(string $displayName, ?string $roomCode, string $browserId): array
    {
        $this->purgeExpiredRooms();
        $displayName = $this->sanitizeDisplayName($displayName);
        $roomCode = $this->sanitizeRoomCode($roomCode, true);

        if ($roomCode === null) {
            $room = $this->createRoom();
        } else {
            $room = $this->findRoomByCode($roomCode);

            if ($room === null) {
                throw new ApiException('اتاقی با این کد پیدا نشد یا منقضی شده است.', 404);
            }
        }

        $participant = $this->upsertParticipant((int) $room['id'], $browserId, $displayName);
        $this->touchRoom((int) $room['id']);
        $room = $this->requireRoomById((int) $room['id']);

        return [
            'room' => $this->serializeRoom($room),
            'participant' => $participant,
            'presence' => $this->presenceForRoom((int) $room['id']),
        ];
    }

    public function bootstrapRoom(string $roomCode, string $browserId): array
    {
        $membership = $this->requireMembership($roomCode, $browserId);
        $room = $membership['room'];
        $messages = $this->loadMessages((int) $room['id'], null, $browserId);

        return [
            'room' => $this->serializeRoom($room),
            'participant' => $membership['participant'],
            'messages' => $messages,
            'syncCursor' => $this->resolveSyncCursor($messages),
            'presence' => $this->presenceForRoom((int) $room['id']),
        ];
    }

    public function fetchMessages(string $roomCode, string $browserId, ?string $since): array
    {
        $membership = $this->requireMembership($roomCode, $browserId);
        $roomId = (int) $membership['room']['id'];
        $since = $this->sanitizeCursor($since);
        $messages = $this->loadMessages($roomId, $since, $browserId);

        return [
            'messages' => $messages,
            'syncCursor' => $this->resolveSyncCursor($messages, $since),
            'presence' => $this->presenceForRoom($roomId),
        ];
    }

    public function sendMessage(string $roomCode, string $browserId, ?string $bodyText, array $files): array
    {
        $membership = $this->requireMembership($roomCode, $browserId);
        $participant = $membership['participant'];
        $room = $membership['room'];

        $bodyText = $this->sanitizeMessageText($bodyText);
        $files = $this->filterUploadEntries($files);

        if ($bodyText === null && $files === []) {
            throw new ApiException('برای ارسال پیام باید متن یا فایل داشته باشید.', 422);
        }

        $storedPaths = [];

        try {
            $this->pdo->beginTransaction();

            $now = $this->now();
            $statement = $this->pdo->prepare(
                'INSERT INTO messages (room_id, participant_id, browser_id, sender_display_name, body_text, created_at, updated_at)
                 VALUES (:room_id, :participant_id, :browser_id, :sender_display_name, :body_text, :created_at, :updated_at)'
            );
            $statement->execute([
                'room_id' => (int) $room['id'],
                'participant_id' => (int) $participant['id'],
                'browser_id' => $browserId,
                'sender_display_name' => $participant['displayName'],
                'body_text' => $bodyText,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $messageId = (int) $this->pdo->lastInsertId();

            foreach ($files as $file) {
                $attachment = $this->storeAttachment((int) $room['id'], $room['code'], $messageId, $file, $now);
                $storedPaths[] = $attachment['stored_path'];
            }

            $this->touchRoom((int) $room['id'], $now);
            $this->pdo->commit();

            return [
                'message' => $this->loadMessageById($messageId, $browserId),
                'room' => $this->serializeRoom($this->requireRoomById((int) $room['id'])),
                'presence' => $this->presenceForRoom((int) $room['id']),
            ];
        } catch (Throwable $throwable) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            foreach ($storedPaths as $storedPath) {
                $this->deletePhysicalFile($storedPath);
            }

            if ($throwable instanceof ApiException) {
                throw $throwable;
            }

            throw new ApiException('ارسال پیام انجام نشد. دوباره تلاش کنید.', 500, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }
    }

    public function editMessage(int $messageId, string $browserId, ?string $bodyText): array
    {
        $bodyText = $this->sanitizeMessageText($bodyText);
        $message = $this->requireOwnedMessage($messageId, $browserId);
        $this->touchParticipant((int) $message['room_id'], $browserId);

        if ($bodyText === null && (int) $message['attachment_count'] === 0) {
            throw new ApiException('پیامی که فایل ندارد نمی‌تواند کاملا خالی شود.', 422);
        }

        $now = $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE messages
             SET body_text = :body_text, updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'body_text' => $bodyText,
            'updated_at' => $now,
            'id' => $messageId,
        ]);

        return [
            'message' => $this->loadMessageById($messageId, $browserId),
            'presence' => $this->presenceForRoom((int) $message['room_id']),
        ];
    }

    public function deleteMessage(int $messageId, string $browserId): array
    {
        $this->purgeExpiredRooms();
        $message = $this->requireOwnedMessage($messageId, $browserId);
        $this->touchParticipant((int) $message['room_id'], $browserId);
        $attachments = $this->loadAttachmentsForMessageIds([$messageId]);
        $now = $this->now();

        try {
            $this->pdo->beginTransaction();

            $statement = $this->pdo->prepare(
                'UPDATE messages
                 SET body_text = NULL, deleted_at = :deleted_at, updated_at = :updated_at
                 WHERE id = :id'
            );
            $statement->execute([
                'deleted_at' => $now,
                'updated_at' => $now,
                'id' => $messageId,
            ]);

            $attachmentStatement = $this->pdo->prepare(
                'UPDATE attachments
                 SET deleted_at = :deleted_at
                 WHERE message_id = :message_id AND deleted_at IS NULL'
            );
            $attachmentStatement->execute([
                'deleted_at' => $now,
                'message_id' => $messageId,
            ]);

            $this->pdo->commit();
        } catch (Throwable $throwable) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }

            throw new ApiException('حذف پیام انجام نشد.', 500, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }

        foreach ($attachments[$messageId] ?? [] as $attachment) {
            $this->deletePhysicalFile($attachment['stored_path']);
        }

        return [
            'message' => $this->loadMessageById($messageId, $browserId),
            'presence' => $this->presenceForRoom((int) $message['room_id']),
        ];
    }

    public function attachmentForDownload(string $attachmentId, string $browserId): array
    {
        $this->purgeExpiredRooms();

        $statement = $this->pdo->prepare(
            'SELECT
                attachments.id,
                attachments.original_name,
                attachments.stored_path,
                attachments.mime_type,
                attachments.size_bytes,
                attachments.deleted_at,
                rooms.expires_at
             FROM attachments
             INNER JOIN rooms ON rooms.id = attachments.room_id
             INNER JOIN participants ON participants.room_id = rooms.id
             WHERE attachments.id = :attachment_id
               AND participants.browser_id = :browser_id
             LIMIT 1'
        );
        $statement->execute([
            'attachment_id' => $attachmentId,
            'browser_id' => $browserId,
        ]);
        $attachment = $statement->fetch();

        if ($attachment === false) {
            throw new ApiException('به این فایل دسترسی ندارید.', 403);
        }

        if ($attachment['deleted_at'] !== null || strtotime((string) $attachment['expires_at']) <= time()) {
            throw new ApiException('این فایل دیگر در دسترس نیست.', 404);
        }

        return [
            'id' => $attachment['id'],
            'name' => $attachment['original_name'],
            'path' => $attachment['stored_path'],
            'mimeType' => $attachment['mime_type'],
            'sizeBytes' => (int) $attachment['size_bytes'],
            'previewKind' => $this->previewKind((string) $attachment['mime_type']),
        ];
    }

    public function purgeExpiredRooms(): int
    {
        $statement = $this->pdo->prepare(
            'SELECT DISTINCT rooms.id, attachments.stored_path
             FROM rooms
             LEFT JOIN attachments ON attachments.room_id = rooms.id
             WHERE rooms.expires_at <= :now'
        );
        $statement->execute(['now' => $this->now()]);
        $rows = $statement->fetchAll();

        if ($rows === []) {
            return 0;
        }

        $roomIds = [];
        $filePaths = [];

        foreach ($rows as $row) {
            $roomIds[(int) $row['id']] = true;

            if (!empty($row['stored_path'])) {
                $filePaths[] = (string) $row['stored_path'];
            }
        }

        foreach ($filePaths as $filePath) {
            $this->deletePhysicalFile($filePath);
        }

        $placeholders = implode(',', array_fill(0, count($roomIds), '?'));
        $deleteStatement = $this->pdo->prepare("DELETE FROM rooms WHERE id IN ($placeholders)");
        $deleteStatement->execute(array_keys($roomIds));

        return count($roomIds);
    }

    private function createRoom(): array
    {
        $activeCount = (int) $this->pdo->query('SELECT COUNT(*) FROM rooms')->fetchColumn();

        if ($activeCount >= 9000) {
            throw new ApiException('در حال حاضر هیچ کد آزادی برای ساخت اتاق جدید باقی نمانده است. کمی بعد دوباره تلاش کنید.', 409);
        }

        $attempts = 30;
        $now = $this->now();
        $expiry = $this->expiryFrom($now);

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            $code = (string) random_int(1000, 9999);

            try {
                $statement = $this->pdo->prepare(
                    'INSERT INTO rooms (code, created_at, updated_at, last_activity_at, expires_at)
                     VALUES (:code, :created_at, :updated_at, :last_activity_at, :expires_at)'
                );
                $statement->execute([
                    'code' => $code,
                    'created_at' => $now,
                    'updated_at' => $now,
                    'last_activity_at' => $now,
                    'expires_at' => $expiry,
                ]);

                return $this->requireRoomById((int) $this->pdo->lastInsertId());
            } catch (Throwable) {
                if ($attempt === $attempts) {
                    throw new ApiException('فعلا ساخت اتاق جدید ممکن نشد. لطفا چند لحظه بعد دوباره امتحان کنید.', 409);
                }
            }
        }

        throw new ApiException('فعلا ساخت اتاق جدید ممکن نشد. لطفا چند لحظه بعد دوباره امتحان کنید.', 409);
    }

    private function requireMembership(string $roomCode, string $browserId): array
    {
        $this->purgeExpiredRooms();
        $roomCode = (string) $this->sanitizeRoomCode($roomCode, false);
        $room = $this->findRoomByCode($roomCode);

        if ($room === null) {
            throw new ApiException('این اتاق پیدا نشد یا منقضی شده است.', 404);
        }

        $statement = $this->pdo->prepare(
            'SELECT id, room_id, browser_id, display_name, joined_at, last_seen_at
             FROM participants
             WHERE room_id = :room_id AND browser_id = :browser_id
             LIMIT 1'
        );
        $statement->execute([
            'room_id' => (int) $room['id'],
            'browser_id' => $browserId,
        ]);
        $participant = $statement->fetch();

        if ($participant === false) {
            throw new ApiException('ابتدا باید وارد اتاق شوید.', 403);
        }

        $now = $this->now();
        $this->touchParticipant((int) $room['id'], $browserId, $now);

        return [
            'room' => $room,
            'participant' => [
                'id' => (int) $participant['id'],
                'displayName' => $participant['display_name'],
                'joinedAt' => $participant['joined_at'],
                'lastSeenAt' => $now,
            ],
        ];
    }

    private function upsertParticipant(int $roomId, string $browserId, string $displayName): array
    {
        $now = $this->now();
        $statement = $this->pdo->prepare(
            'INSERT INTO participants (room_id, browser_id, display_name, joined_at, last_seen_at)
             VALUES (:room_id, :browser_id, :display_name, :joined_at, :last_seen_at)
             ON DUPLICATE KEY UPDATE
                display_name = VALUES(display_name),
                last_seen_at = VALUES(last_seen_at)'
        );
        $statement->execute([
            'room_id' => $roomId,
            'browser_id' => $browserId,
            'display_name' => $displayName,
            'joined_at' => $now,
            'last_seen_at' => $now,
        ]);

        $fetchStatement = $this->pdo->prepare(
            'SELECT id, display_name, joined_at, last_seen_at
             FROM participants
             WHERE room_id = :room_id AND browser_id = :browser_id
             LIMIT 1'
        );
        $fetchStatement->execute([
            'room_id' => $roomId,
            'browser_id' => $browserId,
        ]);
        $participant = $fetchStatement->fetch();

        return [
            'id' => (int) $participant['id'],
            'displayName' => $participant['display_name'],
            'joinedAt' => $participant['joined_at'],
            'lastSeenAt' => $participant['last_seen_at'],
        ];
    }

    private function touchParticipant(int $roomId, string $browserId, ?string $now = null): void
    {
        $now ??= $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE participants
             SET last_seen_at = :last_seen_at
             WHERE room_id = :room_id AND browser_id = :browser_id'
        );
        $statement->execute([
            'last_seen_at' => $now,
            'room_id' => $roomId,
            'browser_id' => $browserId,
        ]);
    }

    private function presenceForRoom(int $roomId): array
    {
        $threshold = (new DateTimeImmutable('now'))
            ->sub(new DateInterval('PT45S'))
            ->format('Y-m-d H:i:s.u');

        $statement = $this->pdo->prepare(
            'SELECT display_name
             FROM participants
             WHERE room_id = :room_id AND last_seen_at >= :threshold
             ORDER BY last_seen_at DESC, id ASC'
        );
        $statement->execute([
            'room_id' => $roomId,
            'threshold' => $threshold,
        ]);
        $rows = $statement->fetchAll();

        return [
            'onlineCount' => count($rows),
            'participants' => array_map(
                static fn (array $row): string => (string) $row['display_name'],
                array_slice($rows, 0, 2)
            ),
        ];
    }

    private function sanitizeDisplayName(string $displayName): string
    {
        $trimmed = trim(preg_replace('/\s+/u', ' ', $displayName) ?? '');

        if ($trimmed === '') {
            throw new ApiException('لطفا یک نام نمایشی وارد کنید.', 422);
        }

        $maxLength = (int) app_config('app.max_display_name_length', 40);

        if (mb_strlen($trimmed) > $maxLength) {
            throw new ApiException("نام نمایشی باید حداکثر {$maxLength} کاراکتر باشد.", 422);
        }

        return $trimmed;
    }

    private function sanitizeRoomCode(?string $roomCode, bool $allowNull): ?string
    {
        $trimmed = trim((string) $roomCode);

        if ($trimmed === '') {
            if ($allowNull) {
                return null;
            }

            throw new ApiException('کد اتاق باید ۴ رقم باشد.', 422);
        }

        if (preg_match('/^\d{4}$/', $trimmed) !== 1) {
            throw new ApiException('کد اتاق باید دقیقا ۴ رقم باشد.', 422);
        }

        return $trimmed;
    }

    private function sanitizeMessageText(?string $bodyText): ?string
    {
        $trimmed = trim((string) $bodyText);

        if ($trimmed === '') {
            return null;
        }

        $maxLength = (int) app_config('app.max_message_length', 4000);

        if (mb_strlen($trimmed) > $maxLength) {
            throw new ApiException("متن پیام باید حداکثر {$maxLength} کاراکتر باشد.", 422);
        }

        return $trimmed;
    }

    private function sanitizeCursor(?string $cursor): ?string
    {
        $cursor = trim((string) $cursor);

        if ($cursor === '') {
            return null;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,6})?$/', $cursor) !== 1) {
            throw new ApiException('نشانگر همگام‌سازی معتبر نیست.', 422);
        }

        return $cursor;
    }

    private function filterUploadEntries(array $files): array
    {
        return array_values(array_filter($files, static function (array $file): bool {
            return ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE;
        }));
    }

    private function storeAttachment(int $roomId, string $roomCode, int $messageId, array $file, string $now): array
    {
        $errorCode = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);

        if ($errorCode !== UPLOAD_ERR_OK) {
            throw new ApiException($this->uploadErrorMessage($errorCode), 422);
        }

        $originalName = trim((string) ($file['name'] ?? ''));

        if ($originalName === '') {
            throw new ApiException('نام فایل معتبر نیست.', 422);
        }

        $tmpName = (string) ($file['tmp_name'] ?? '');

        if ($tmpName === '' || !is_uploaded_file($tmpName)) {
            throw new ApiException('فایل ارسالی معتبر نیست.', 422);
        }

        $size = (int) ($file['size'] ?? 0);
        $extension = pathinfo($originalName, PATHINFO_EXTENSION);
        $attachmentId = bin2hex(random_bytes(12));
        $relativeDirectory = implode('/', [$roomCode, date('Y'), date('m')]);
        $relativeName = $attachmentId . ($extension === '' ? '' : '.' . strtolower($extension));
        $relativePath = $relativeDirectory . '/' . $relativeName;
        $absoluteDirectory = storage_path('uploads/' . $relativeDirectory);

        if (!is_dir($absoluteDirectory) && !mkdir($absoluteDirectory, 0775, true) && !is_dir($absoluteDirectory)) {
            throw new ApiException('پوشه ذخیره فایل ساخته نشد.', 500);
        }

        $absolutePath = storage_path('uploads/' . $relativePath);

        if (!move_uploaded_file($tmpName, $absolutePath)) {
            throw new ApiException('ذخیره فایل انجام نشد.', 500);
        }

        $mimeType = (string) mime_content_type($absolutePath);
        $statement = $this->pdo->prepare(
            'INSERT INTO attachments (id, room_id, message_id, original_name, stored_path, mime_type, size_bytes, created_at)
             VALUES (:id, :room_id, :message_id, :original_name, :stored_path, :mime_type, :size_bytes, :created_at)'
        );
        $statement->execute([
            'id' => $attachmentId,
            'room_id' => $roomId,
            'message_id' => $messageId,
            'original_name' => $originalName,
            'stored_path' => $relativePath,
            'mime_type' => $mimeType,
            'size_bytes' => $size,
            'created_at' => $now,
        ]);

        return [
            'id' => $attachmentId,
            'stored_path' => $relativePath,
        ];
    }

    private function uploadErrorMessage(int $errorCode): string
    {
        return match ($errorCode) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'حجم فایل بیشتر از حد مجاز است.',
            UPLOAD_ERR_PARTIAL => 'بارگذاری فایل کامل نشد.',
            UPLOAD_ERR_NO_TMP_DIR => 'پوشه موقت فایل پیدا نشد.',
            UPLOAD_ERR_CANT_WRITE => 'نوشتن فایل روی سرور انجام نشد.',
            UPLOAD_ERR_EXTENSION => 'یک افزونه PHP بارگذاری فایل را متوقف کرد.',
            default => 'بارگذاری فایل انجام نشد.',
        };
    }

    private function loadMessages(int $roomId, ?string $since = null, ?string $browserId = null): array
    {
        $limit = (int) app_config('app.recent_messages_limit', 60);

        if ($since !== null) {
            $statement = $this->pdo->prepare(
                'SELECT *
                 FROM messages
                 WHERE room_id = :room_id AND updated_at > :since
                 ORDER BY id ASC'
            );
            $statement->execute([
                'room_id' => $roomId,
                'since' => $since,
            ]);
        } else {
            $statement = $this->pdo->prepare(
                'SELECT *
                 FROM (
                    SELECT *
                    FROM messages
                    WHERE room_id = :room_id
                    ORDER BY id DESC
                    LIMIT :message_limit
                 ) AS recent_messages
                 ORDER BY id ASC'
            );
            $statement->bindValue('room_id', $roomId, PDO::PARAM_INT);
            $statement->bindValue('message_limit', $limit, PDO::PARAM_INT);
            $statement->execute();
        }

        $messages = $statement->fetchAll();

        if ($messages === []) {
            return [];
        }

        $messageIds = array_map(static fn (array $message): int => (int) $message['id'], $messages);
        $attachments = $this->loadAttachmentsForMessageIds($messageIds);

        return array_map(function (array $message) use ($attachments, $browserId): array {
            $messageId = (int) $message['id'];

            return [
                'id' => $messageId,
                'roomId' => (int) $message['room_id'],
                'senderName' => $message['sender_display_name'],
                'bodyText' => $message['body_text'],
                'createdAt' => $message['created_at'],
                'updatedAt' => $message['updated_at'],
                'isEdited' => $message['updated_at'] !== $message['created_at'] && $message['deleted_at'] === null,
                'isDeleted' => $message['deleted_at'] !== null,
                'isOwn' => $browserId !== null && hash_equals($message['browser_id'], $browserId),
                'attachments' => array_map(fn (array $attachment): array => $this->serializeAttachment($attachment), $attachments[$messageId] ?? []),
            ];
        }, $messages);
    }

    private function loadMessageById(int $messageId, ?string $browserId = null): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM messages WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $messageId]);
        $message = $statement->fetch();

        if ($message === false) {
            throw new ApiException('پیام پیدا نشد.', 404);
        }

        $attachments = $this->loadAttachmentsForMessageIds([$messageId]);

        return [
            'id' => (int) $message['id'],
            'roomId' => (int) $message['room_id'],
            'senderName' => $message['sender_display_name'],
            'bodyText' => $message['body_text'],
            'createdAt' => $message['created_at'],
            'updatedAt' => $message['updated_at'],
            'isEdited' => $message['updated_at'] !== $message['created_at'] && $message['deleted_at'] === null,
            'isDeleted' => $message['deleted_at'] !== null,
            'isOwn' => $browserId !== null && hash_equals($message['browser_id'], $browserId),
            'attachments' => array_map(fn (array $attachment): array => $this->serializeAttachment($attachment), $attachments[$messageId] ?? []),
        ];
    }

    private function loadAttachmentsForMessageIds(array $messageIds): array
    {
        if ($messageIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($messageIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id, room_id, message_id, original_name, stored_path, mime_type, size_bytes, created_at
             FROM attachments
             WHERE message_id IN ($placeholders) AND deleted_at IS NULL
             ORDER BY id ASC"
        );
        $statement->execute($messageIds);
        $rows = $statement->fetchAll();

        $grouped = [];

        foreach ($rows as $row) {
            $grouped[(int) $row['message_id']][] = $row;
        }

        return $grouped;
    }

    private function serializeAttachment(array $attachment): array
    {
        $mimeType = (string) $attachment['mime_type'];

        return [
            'id' => $attachment['id'],
            'name' => $attachment['original_name'],
            'mimeType' => $mimeType,
            'sizeBytes' => (int) $attachment['size_bytes'],
            'previewKind' => $this->previewKind($mimeType),
            'url' => app_url('file/' . $attachment['id']),
        ];
    }

    private function previewKind(string $mimeType): string
    {
        if (str_starts_with($mimeType, 'image/')) {
            return 'image';
        }

        if (str_starts_with($mimeType, 'audio/')) {
            return 'audio';
        }

        if (str_starts_with($mimeType, 'video/')) {
            return 'video';
        }

        return 'download';
    }

    private function requireOwnedMessage(int $messageId, string $browserId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT messages.*, (
                SELECT COUNT(*) FROM attachments
                WHERE attachments.message_id = messages.id
                  AND attachments.deleted_at IS NULL
             ) AS attachment_count
             FROM messages
             INNER JOIN rooms ON rooms.id = messages.room_id
             WHERE messages.id = :id
               AND messages.browser_id = :browser_id
               AND messages.deleted_at IS NULL
               AND rooms.expires_at > :now
             LIMIT 1'
        );
        $statement->execute([
            'id' => $messageId,
            'browser_id' => $browserId,
            'now' => $this->now(),
        ]);

        $message = $statement->fetch();

        if ($message === false) {
            throw new ApiException('فقط پیام‌های خودتان را می‌توانید تغییر دهید.', 403);
        }

        return $message;
    }

    private function findRoomByCode(string $roomCode): ?array
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM rooms WHERE code = :code AND expires_at > :now LIMIT 1'
        );
        $statement->execute([
            'code' => $roomCode,
            'now' => $this->now(),
        ]);
        $room = $statement->fetch();

        return $room === false ? null : $room;
    }

    private function requireRoomById(int $roomId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM rooms WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $roomId]);
        $room = $statement->fetch();

        if ($room === false) {
            throw new ApiException('اتاق پیدا نشد.', 404);
        }

        return $room;
    }

    private function touchRoom(int $roomId, ?string $now = null): void
    {
        $now ??= $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE rooms
             SET updated_at = :updated_at,
                 last_activity_at = :last_activity_at,
                 expires_at = :expires_at
             WHERE id = :id'
        );
        $statement->execute([
            'updated_at' => $now,
            'last_activity_at' => $now,
            'expires_at' => $this->expiryFrom($now),
            'id' => $roomId,
        ]);
    }

    private function resolveSyncCursor(array $messages, ?string $fallback = null): ?string
    {
        if ($messages === []) {
            return $fallback;
        }

        $lastMessage = end($messages);

        return $lastMessage['updatedAt'];
    }

    private function serializeRoom(array $room): array
    {
        return [
            'id' => (int) $room['id'],
            'code' => $room['code'],
            'lastActivityAt' => $room['last_activity_at'],
            'expiresAt' => $room['expires_at'],
        ];
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.u');
    }

    private function expiryFrom(string $from): string
    {
        return (new DateTimeImmutable($from))
            ->add(new DateInterval('P3D'))
            ->format('Y-m-d H:i:s.u');
    }

    private function deletePhysicalFile(string $relativePath): void
    {
        $absolutePath = storage_path('uploads/' . ltrim($relativePath, '/'));

        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }
}
