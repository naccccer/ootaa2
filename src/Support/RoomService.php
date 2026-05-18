<?php

declare(strict_types=1);

namespace App\Support;

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

    public function enterRoom(mixed $roomCode, array $user): array
    {
        $this->purgeExpiredRooms();
        $normalizedRoomCode = $this->sanitizeRoomCode($roomCode, true);
        $userId = (int) $user['id'];

        if ($normalizedRoomCode === null) {
            $room = $this->createRoom($userId);
        } else {
            $room = $this->findRoomByCode($normalizedRoomCode);

            if ($room === null) {
                throw new ApiException('اتاقی با این کد پیدا نشد یا منقضی شده است.', 404);
            }
        }

        $participant = $this->upsertParticipant((int) $room['id'], $user);
        $this->touchRoom((int) $room['id']);
        $room = $this->requireRoomById((int) $room['id']);

        return [
            'room' => $this->serializeRoom($room, $userId),
            'participant' => $participant,
            'presence' => $this->presenceForRoom((int) $room['id']),
        ];
    }

    public function bootstrapRoom(string $roomCode, array $user): array
    {
        $membership = $this->requireMembership($roomCode, (int) $user['id']);
        $room = $membership['room'];
        $messages = $this->loadMessages((int) $room['id'], null, (int) $user['id']);

        return [
            'room' => $this->serializeRoom($room, (int) $user['id']),
            'participant' => $membership['participant'],
            'messages' => $messages,
            'syncCursor' => $this->resolveSyncCursor($messages),
            'presence' => $this->presenceForRoom((int) $room['id']),
        ];
    }

    public function updateRoomName(string $roomCode, array $user, string $roomName): array
    {
        $membership = $this->requireMembership($roomCode, (int) $user['id']);
        $room = $membership['room'];

        if ((int) $room['creator_user_id'] !== (int) $user['id']) {
            throw new ApiException('فقط سازنده اتاق می‌تواند نام اتاق را تغییر دهد.', 403);
        }

        $roomName = $this->sanitizeRoomName($roomName);
        $now = $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE rooms
             SET name = :name,
                 updated_at = :updated_at,
                 last_activity_at = :last_activity_at,
                 expires_at = :expires_at
             WHERE id = :id'
        );
        $statement->execute([
            'name' => $roomName,
            'updated_at' => $now,
            'last_activity_at' => $now,
            'expires_at' => $this->expiryFrom($now),
            'id' => (int) $room['id'],
        ]);

        return [
            'room' => $this->serializeRoom($this->requireRoomById((int) $room['id']), (int) $user['id']),
            'participant' => $membership['participant'],
            'presence' => $this->presenceForRoom((int) $room['id']),
        ];
    }

    public function fetchMessages(string $roomCode, array $user, ?string $since): array
    {
        $membership = $this->requireMembership($roomCode, (int) $user['id']);
        $roomId = (int) $membership['room']['id'];
        $cursor = $this->sanitizeCursor($since);
        $messages = $this->loadMessages($roomId, $cursor, (int) $user['id']);

        return [
            'room' => $this->serializeRoom($membership['room'], (int) $user['id']),
            'messages' => $messages,
            'syncCursor' => $this->resolveSyncCursor($messages, $cursor),
            'presence' => $this->presenceForRoom($roomId),
        ];
    }

    public function sendMessage(string $roomCode, array $user, ?string $bodyText, array $files, mixed $replyToMessageId = null): array
    {
        $membership = $this->requireMembership($roomCode, (int) $user['id']);
        $room = $membership['room'];
        $bodyText = $this->sanitizeMessageText($bodyText);
        $files = $this->filterUploadEntries($files);
        $replyToId = $this->sanitizeReplyToMessageId($replyToMessageId, (int) $room['id']);

        if ($bodyText === null && $files === []) {
            throw new ApiException('برای ارسال پیام باید متن یا فایل داشته باشید.', 422);
        }

        $storedPaths = [];

        try {
            $this->pdo->beginTransaction();
            $now = $this->now();
            $statement = $this->pdo->prepare(
                'INSERT INTO messages (
                    room_id,
                    user_id,
                    sender_display_name,
                    sender_mobile_display,
                    body_text,
                    parent_message_id,
                    created_at,
                    updated_at
                 ) VALUES (
                    :room_id,
                    :user_id,
                    :sender_display_name,
                    :sender_mobile_display,
                    :body_text,
                    :parent_message_id,
                    :created_at,
                    :updated_at
                 )'
            );
            $statement->execute([
                'room_id' => (int) $room['id'],
                'user_id' => (int) $user['id'],
                'sender_display_name' => (string) $user['display_name'],
                'sender_mobile_display' => MobileNumber::toDisplay((string) $user['mobile_normalized']),
                'body_text' => $bodyText,
                'parent_message_id' => $replyToId,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $messageId = (int) $this->pdo->lastInsertId();

            foreach ($files as $file) {
                $attachment = $this->storeAttachment((int) $room['id'], (string) $room['code'], $messageId, $file, $now);
                $storedPaths[] = $attachment['stored_path'];
            }

            $this->touchRoom((int) $room['id'], $now);
            $this->pdo->commit();
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

            throw new ApiException('ارسال پیام انجام نشد.', 500, [
                'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
            ]);
        }

        return [
            'message' => $this->loadMessageById($messageId, (int) $user['id']),
            'room' => $this->serializeRoom($this->requireRoomById((int) $room['id']), (int) $user['id']),
            'presence' => $this->presenceForRoom((int) $room['id']),
        ];
    }

    public function editMessage(int $messageId, array $user, ?string $bodyText): array
    {
        $bodyText = $this->sanitizeMessageText($bodyText);
        $message = $this->requireOwnedMessage($messageId, (int) $user['id']);
        $this->touchParticipant((int) $message['room_id'], (int) $user['id']);

        if ($bodyText === null && (int) $message['attachment_count'] === 0) {
            throw new ApiException('پیامی که فایل ندارد نمی‌تواند کاملاً خالی شود.', 422);
        }

        $statement = $this->pdo->prepare(
            'UPDATE messages
             SET body_text = :body_text,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $statement->execute([
            'body_text' => $bodyText,
            'updated_at' => $this->now(),
            'id' => $messageId,
        ]);

        return [
            'message' => $this->loadMessageById($messageId, (int) $user['id']),
            'room' => $this->serializeRoom($this->requireRoomById((int) $message['room_id']), (int) $user['id']),
            'presence' => $this->presenceForRoom((int) $message['room_id']),
        ];
    }

    public function deleteMessage(int $messageId, array $user): array
    {
        $this->purgeExpiredRooms();
        $message = $this->requireOwnedMessage($messageId, (int) $user['id']);
        $this->touchParticipant((int) $message['room_id'], (int) $user['id']);
        $attachments = $this->loadAttachmentsForMessageIds([$messageId]);
        $now = $this->now();

        try {
            $this->pdo->beginTransaction();

            $statement = $this->pdo->prepare(
                'UPDATE messages
                 SET body_text = NULL,
                     deleted_at = :deleted_at,
                     updated_at = :updated_at
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
            $this->deletePhysicalFile((string) $attachment['stored_path']);
        }

        return [
            'message' => $this->loadMessageById($messageId, (int) $user['id']),
            'room' => $this->serializeRoom($this->requireRoomById((int) $message['room_id']), (int) $user['id']),
            'presence' => $this->presenceForRoom((int) $message['room_id']),
        ];
    }

    public function attachmentForDownload(string $attachmentId, int $userId): array
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
               AND participants.user_id = :user_id
             LIMIT 1'
        );
        $statement->execute([
            'attachment_id' => $attachmentId,
            'user_id' => $userId,
        ]);
        $attachment = $statement->fetch();

        if ($attachment === false) {
            throw new ApiException('به این فایل دسترسی ندارید.', 403);
        }

        if ($attachment['deleted_at'] !== null || strtotime((string) $attachment['expires_at']) <= time()) {
            throw new ApiException('این فایل دیگر در دسترس نیست.', 404);
        }

        return [
            'id' => (string) $attachment['id'],
            'name' => (string) $attachment['original_name'],
            'path' => (string) $attachment['stored_path'],
            'mimeType' => (string) $attachment['mime_type'],
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
        $storedPaths = [];

        foreach ($rows as $row) {
            $roomIds[(int) $row['id']] = true;

            if (!empty($row['stored_path'])) {
                $storedPaths[] = (string) $row['stored_path'];
            }
        }

        foreach ($storedPaths as $storedPath) {
            $this->deletePhysicalFile($storedPath);
        }

        $placeholders = implode(',', array_fill(0, count($roomIds), '?'));
        $deleteStatement = $this->pdo->prepare("DELETE FROM rooms WHERE id IN ($placeholders)");
        $deleteStatement->execute(array_keys($roomIds));

        return count($roomIds);
    }

    private function createRoom(int $creatorUserId): array
    {
        $activeCount = (int) $this->pdo->query('SELECT COUNT(*) FROM rooms')->fetchColumn();

        if ($activeCount >= 9000) {
            throw new ApiException('فعلاً کد آزادی برای ساخت اتاق جدید باقی نمانده است.', 409);
        }

        $now = $this->now();
        $expiry = $this->expiryFrom($now);

        for ($attempt = 0; $attempt < 30; $attempt++) {
            $code = (string) random_int(1000, 9999);

            try {
                $statement = $this->pdo->prepare(
                    'INSERT INTO rooms (
                        code,
                        name,
                        creator_user_id,
                        created_at,
                        updated_at,
                        last_activity_at,
                        expires_at
                     ) VALUES (
                        :code,
                        :name,
                        :creator_user_id,
                        :created_at,
                        :updated_at,
                        :last_activity_at,
                        :expires_at
                     )'
                );
                $statement->execute([
                    'code' => $code,
                    'name' => null,
                    'creator_user_id' => $creatorUserId,
                    'created_at' => $now,
                    'updated_at' => $now,
                    'last_activity_at' => $now,
                    'expires_at' => $expiry,
                ]);

                return $this->requireRoomById((int) $this->pdo->lastInsertId());
            } catch (Throwable) {
                continue;
            }
        }

        throw new ApiException('فعلاً ساخت اتاق جدید ممکن نشد. دوباره تلاش کنید.', 409);
    }

    private function requireMembership(string $roomCode, int $userId): array
    {
        $this->purgeExpiredRooms();
        $normalizedRoomCode = (string) $this->sanitizeRoomCode($roomCode, false);
        $room = $this->findRoomByCode($normalizedRoomCode);

        if ($room === null) {
            throw new ApiException('این اتاق پیدا نشد یا منقضی شده است.', 404);
        }

        $statement = $this->pdo->prepare(
            'SELECT id, room_id, user_id, display_name, mobile_display, joined_at, last_seen_at
             FROM participants
             WHERE room_id = :room_id
               AND user_id = :user_id
             LIMIT 1'
        );
        $statement->execute([
            'room_id' => (int) $room['id'],
            'user_id' => $userId,
        ]);
        $participant = $statement->fetch();

        if ($participant === false) {
            throw new ApiException('ابتدا باید وارد این اتاق شوید.', 403);
        }

        $now = $this->now();
        $this->touchParticipant((int) $room['id'], $userId, $now);

        return [
            'room' => $room,
            'participant' => [
                'id' => (int) $participant['id'],
                'displayName' => (string) $participant['display_name'],
                'mobileDisplay' => (string) $participant['mobile_display'],
                'joinedAt' => (string) $participant['joined_at'],
                'lastSeenAt' => $now,
            ],
        ];
    }

    private function upsertParticipant(int $roomId, array $user): array
    {
        $now = $this->now();
        $displayName = (string) $user['display_name'];
        $mobileDisplay = MobileNumber::toDisplay((string) $user['mobile_normalized']);
        $statement = $this->pdo->prepare(
            'INSERT INTO participants (room_id, user_id, display_name, mobile_display, joined_at, last_seen_at)
             VALUES (:room_id, :user_id, :display_name, :mobile_display, :joined_at, :last_seen_at)
             ON DUPLICATE KEY UPDATE
                display_name = VALUES(display_name),
                mobile_display = VALUES(mobile_display),
                last_seen_at = VALUES(last_seen_at)'
        );
        $statement->execute([
            'room_id' => $roomId,
            'user_id' => (int) $user['id'],
            'display_name' => $displayName,
            'mobile_display' => $mobileDisplay,
            'joined_at' => $now,
            'last_seen_at' => $now,
        ]);

        $fetchStatement = $this->pdo->prepare(
            'SELECT id, display_name, mobile_display, joined_at, last_seen_at
             FROM participants
             WHERE room_id = :room_id
               AND user_id = :user_id
             LIMIT 1'
        );
        $fetchStatement->execute([
            'room_id' => $roomId,
            'user_id' => (int) $user['id'],
        ]);
        $participant = $fetchStatement->fetch();

        return [
            'id' => (int) $participant['id'],
            'displayName' => (string) $participant['display_name'],
            'mobileDisplay' => (string) $participant['mobile_display'],
            'joinedAt' => (string) $participant['joined_at'],
            'lastSeenAt' => (string) $participant['last_seen_at'],
        ];
    }

    private function touchParticipant(int $roomId, int $userId, ?string $now = null): void
    {
        $statement = $this->pdo->prepare(
            'UPDATE participants
             SET last_seen_at = :last_seen_at
             WHERE room_id = :room_id
               AND user_id = :user_id'
        );
        $statement->execute([
            'last_seen_at' => $now ?? $this->now(),
            'room_id' => $roomId,
            'user_id' => $userId,
        ]);
    }

    private function presenceForRoom(int $roomId): array
    {
        $cutoff = date('Y-m-d H:i:s.u', time() - (int) app_config('app.presence_window_seconds', 120));
        $countStatement = $this->pdo->prepare(
            'SELECT COUNT(*) AS participant_count
             FROM participants
             WHERE room_id = :room_id'
        );
        $countStatement->execute([
            'room_id' => $roomId,
        ]);
        $participantCount = (int) $countStatement->fetchColumn();

        $statement = $this->pdo->prepare(
            'SELECT display_name, mobile_display, last_seen_at
             FROM participants
             WHERE room_id = :room_id
               AND last_seen_at >= :cutoff
             ORDER BY display_name ASC'
        );
        $statement->execute([
            'room_id' => $roomId,
            'cutoff' => $cutoff,
        ]);
        $participants = $statement->fetchAll();

        return [
            'onlineCount' => count($participants),
            'totalCount' => $participantCount,
            'participants' => array_map(static function (array $participant): array {
                return [
                    'displayName' => (string) $participant['display_name'],
                    'mobileDisplay' => (string) $participant['mobile_display'],
                    'lastSeenAt' => (string) $participant['last_seen_at'],
                ];
            }, $participants),
        ];
    }

    private function sanitizeRoomCode(mixed $roomCode, bool $allowNull): ?string
    {
        $trimmed = trim((string) ($roomCode ?? ''));

        if ($trimmed === '') {
            if ($allowNull) {
                return null;
            }

            throw new ApiException('کد اتاق را وارد کنید.', 422);
        }

        if (preg_match('/^\d{4}$/', $trimmed) !== 1) {
            throw new ApiException('کد اتاق باید 4 رقم باشد.', 422);
        }

        return $trimmed;
    }

    private function sanitizeRoomName(string $roomName): string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', $roomName) ?? '');
        $maxLength = (int) app_config('app.max_room_name_length', 80);

        if ($normalized === '') {
            throw new ApiException('نام اتاق را وارد کنید.', 422);
        }

        if (mb_strlen($normalized) > $maxLength) {
            throw new ApiException("نام اتاق نمی‌تواند بیشتر از {$maxLength} کاراکتر باشد.", 422);
        }

        return $normalized;
    }

    private function sanitizeMessageText(?string $bodyText): ?string
    {
        if ($bodyText === null) {
            return null;
        }

        $normalized = trim($bodyText);

        if ($normalized === '') {
            return null;
        }

        $maxLength = (int) app_config('app.max_message_length', 4000);

        if (mb_strlen($normalized) > $maxLength) {
            throw new ApiException("متن پیام نمی‌تواند بیشتر از {$maxLength} کاراکتر باشد.", 422);
        }

        return $normalized;
    }

    private function sanitizeCursor(?string $cursor): ?string
    {
        $trimmed = trim((string) $cursor);

        return $trimmed === '' ? null : $trimmed;
    }

    private function sanitizeReplyToMessageId(mixed $value, int $roomId): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (!is_scalar($value) || preg_match('/^\d+$/', (string) $value) !== 1) {
            throw new ApiException('پیام مرجع معتبر نیست.', 422);
        }

        $messageId = (int) $value;
        $statement = $this->pdo->prepare(
            'SELECT id
             FROM messages
             WHERE id = :id
               AND room_id = :room_id'
        );
        $statement->execute([
            'id' => $messageId,
            'room_id' => $roomId,
        ]);

        if ($statement->fetchColumn() === false) {
            throw new ApiException('پیام مرجع پیدا نشد.', 404);
        }

        return $messageId;
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

    private function loadMessages(int $roomId, ?string $since = null, ?int $viewerUserId = null): array
    {
        $limit = (int) app_config('app.recent_messages_limit', 60);

        if ($since !== null) {
            $statement = $this->pdo->prepare(
                'SELECT *
                 FROM messages
                 WHERE room_id = :room_id
                   AND updated_at > :since
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

        $replyTargets = $this->loadReplyTargets($messages);
        $messageIds = array_map(static fn (array $message): int => (int) $message['id'], $messages);
        $attachments = $this->loadAttachmentsForMessageIds($messageIds);

        return array_map(function (array $message) use ($replyTargets, $attachments, $viewerUserId): array {
            $messageId = (int) $message['id'];

            return [
                'id' => $messageId,
                'roomId' => (int) $message['room_id'],
                'senderName' => (string) $message['sender_display_name'],
                'senderMobile' => (string) $message['sender_mobile_display'],
                'bodyText' => $message['body_text'],
                'createdAt' => (string) $message['created_at'],
                'updatedAt' => (string) $message['updated_at'],
                'isEdited' => $message['updated_at'] !== $message['created_at'] && $message['deleted_at'] === null,
                'isDeleted' => $message['deleted_at'] !== null,
                'isOwn' => $viewerUserId !== null && (int) $message['user_id'] === $viewerUserId,
                'replyTo' => isset($replyTargets[$messageId]) ? $this->serializeReplyTarget($replyTargets[$messageId]) : null,
                'attachments' => array_map(fn (array $attachment): array => $this->serializeAttachment($attachment), $attachments[$messageId] ?? []),
            ];
        }, $messages);
    }

    private function loadMessageById(int $messageId, ?int $viewerUserId = null): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM messages WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $messageId]);
        $message = $statement->fetch();

        if ($message === false) {
            throw new ApiException('پیام پیدا نشد.', 404);
        }

        $replyTargets = $this->loadReplyTargets([$message]);
        $attachments = $this->loadAttachmentsForMessageIds([$messageId]);

        return [
            'id' => (int) $message['id'],
            'roomId' => (int) $message['room_id'],
            'senderName' => (string) $message['sender_display_name'],
            'senderMobile' => (string) $message['sender_mobile_display'],
            'bodyText' => $message['body_text'],
            'createdAt' => (string) $message['created_at'],
            'updatedAt' => (string) $message['updated_at'],
            'isEdited' => $message['updated_at'] !== $message['created_at'] && $message['deleted_at'] === null,
            'isDeleted' => $message['deleted_at'] !== null,
            'isOwn' => $viewerUserId !== null && (int) $message['user_id'] === $viewerUserId,
            'replyTo' => isset($replyTargets[$messageId]) ? $this->serializeReplyTarget($replyTargets[$messageId]) : null,
            'attachments' => array_map(fn (array $attachment): array => $this->serializeAttachment($attachment), $attachments[$messageId] ?? []),
        ];
    }

    private function loadReplyTargets(array $messages): array
    {
        $parentMap = [];
        $parentIds = [];

        foreach ($messages as $message) {
            $messageId = (int) ($message['id'] ?? 0);
            $parentId = isset($message['parent_message_id']) ? (int) $message['parent_message_id'] : 0;

            if ($messageId > 0 && $parentId > 0) {
                $parentMap[$messageId] = $parentId;
                $parentIds[] = $parentId;
            }
        }

        if ($parentIds === []) {
            return [];
        }

        $uniqueParentIds = array_values(array_unique($parentIds));
        $placeholders = implode(',', array_fill(0, count($uniqueParentIds), '?'));
        $statement = $this->pdo->prepare(
            "SELECT id, sender_display_name, sender_mobile_display, body_text, deleted_at
             FROM messages
             WHERE id IN ($placeholders)"
        );
        $statement->execute($uniqueParentIds);
        $parents = [];

        foreach ($statement->fetchAll() as $row) {
            $parents[(int) $row['id']] = $row;
        }

        $resolved = [];

        foreach ($parentMap as $messageId => $parentId) {
            if (isset($parents[$parentId])) {
                $resolved[$messageId] = $parents[$parentId];
            }
        }

        return $resolved;
    }

    private function serializeReplyTarget(array $message): array
    {
        return [
            'id' => (int) $message['id'],
            'senderName' => (string) $message['sender_display_name'],
            'senderMobile' => (string) $message['sender_mobile_display'],
            'bodyText' => $message['body_text'],
            'isDeleted' => $message['deleted_at'] !== null,
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
             WHERE message_id IN ($placeholders)
               AND deleted_at IS NULL
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
            'id' => (string) $attachment['id'],
            'name' => (string) $attachment['original_name'],
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

    private function requireOwnedMessage(int $messageId, int $userId): array
    {
        $statement = $this->pdo->prepare(
            'SELECT messages.*, (
                SELECT COUNT(*)
                FROM attachments
                WHERE attachments.message_id = messages.id
                  AND attachments.deleted_at IS NULL
             ) AS attachment_count
             FROM messages
             INNER JOIN rooms ON rooms.id = messages.room_id
             WHERE messages.id = :id
               AND messages.user_id = :user_id
               AND messages.deleted_at IS NULL
               AND rooms.expires_at > :now
             LIMIT 1'
        );
        $statement->execute([
            'id' => $messageId,
            'user_id' => $userId,
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
            'SELECT *
             FROM rooms
             WHERE code = :code
               AND expires_at > :now
             LIMIT 1'
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
        $effectiveNow = $now ?? $this->now();
        $statement = $this->pdo->prepare(
            'UPDATE rooms
             SET updated_at = :updated_at,
                 last_activity_at = :last_activity_at,
                 expires_at = :expires_at
             WHERE id = :id'
        );
        $statement->execute([
            'updated_at' => $effectiveNow,
            'last_activity_at' => $effectiveNow,
            'expires_at' => $this->expiryFrom($effectiveNow),
            'id' => $roomId,
        ]);
    }

    private function resolveSyncCursor(array $messages, ?string $fallback = null): ?string
    {
        if ($messages === []) {
            return $fallback;
        }

        $lastMessage = end($messages);

        return is_array($lastMessage) ? ($lastMessage['updatedAt'] ?? $fallback) : $fallback;
    }

    private function serializeRoom(array $room, ?int $viewerUserId = null): array
    {
        $name = trim((string) ($room['name'] ?? ''));

        return [
            'id' => (int) $room['id'],
            'code' => (string) $room['code'],
            'name' => $name === '' ? null : $name,
            'isCreator' => $viewerUserId !== null && (int) $room['creator_user_id'] === $viewerUserId,
            'lastActivityAt' => (string) $room['last_activity_at'],
            'expiresAt' => (string) $room['expires_at'],
        ];
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.u');
    }

    private function expiryFrom(string $from): string
    {
        return date('Y-m-d H:i:s.u', strtotime($from) + (int) app_config('app.room_expiry_seconds', 60 * 60 * 24 * 7));
    }

    private function deletePhysicalFile(string $relativePath): void
    {
        $absolutePath = storage_path('uploads/' . ltrim($relativePath, '/'));

        if (is_file($absolutePath)) {
            @unlink($absolutePath);
        }
    }
}
