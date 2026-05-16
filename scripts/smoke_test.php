<?php

declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

use App\Support\Database;
use App\Support\RoomService;

$baseUrl = rtrim($argv[1] ?? 'http://localhost/ootaa2', '/');
$cookieOne = tempnam(sys_get_temp_dir(), 'ootaa2-cookie-1-');
$cookieTwo = tempnam(sys_get_temp_dir(), 'ootaa2-cookie-2-');
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ootaa2-smoke-' . bin2hex(random_bytes(4));

if ($cookieOne === false || $cookieTwo === false) {
    fwrite(STDERR, "Could not create temporary cookie files.\n");
    exit(1);
}

if (!mkdir($tempDir, 0775, true) && !is_dir($tempDir)) {
    fwrite(STDERR, "Could not create temporary files directory.\n");
    exit(1);
}

function request(string $method, string $url, ?string $cookieFile = null, array $options = []): array
{
    $handle = curl_init($url);

    if ($handle === false) {
        throw new RuntimeException('Could not initialize cURL.');
    }

    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => $options['headers'] ?? [],
    ]);

    if ($cookieFile !== null) {
        curl_setopt($handle, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($handle, CURLOPT_COOKIEFILE, $cookieFile);
    }

    if (array_key_exists('json', $options)) {
        $json = json_encode($options['json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        curl_setopt($handle, CURLOPT_POSTFIELDS, $json);
        curl_setopt($handle, CURLOPT_HTTPHEADER, array_merge($options['headers'] ?? [], [
            'Content-Type: application/json',
            'Accept: application/json',
        ]));
    }

    if (array_key_exists('multipart', $options)) {
        curl_setopt($handle, CURLOPT_POSTFIELDS, $options['multipart']);
        curl_setopt($handle, CURLOPT_HTTPHEADER, array_merge($options['headers'] ?? [], [
            'Accept: application/json',
        ]));
    }

    $response = curl_exec($handle);

    if ($response === false) {
        $message = curl_error($handle);
        curl_close($handle);
        throw new RuntimeException('HTTP request failed: ' . $message);
    }

    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($handle, CURLINFO_HEADER_SIZE);
    $headers = substr($response, 0, $headerSize);
    $body = substr($response, $headerSize);

    curl_close($handle);

    return [
        'status' => $status,
        'headers' => $headers,
        'body' => $body,
    ];
}

function requestJson(string $method, string $url, ?string $cookieFile = null, array $options = []): array
{
    $response = request($method, $url, $cookieFile, $options);
    $decoded = json_decode($response['body'], true);

    if (!is_array($decoded)) {
        throw new RuntimeException('Expected JSON response, got: ' . $response['body']);
    }

    if ($response['status'] >= 400 || !($decoded['ok'] ?? false)) {
        $message = $decoded['error']['message'] ?? 'Unknown API error';
        throw new RuntimeException("API error {$response['status']}: {$message}");
    }

    return $decoded['data'];
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function writePng(string $path): void
{
    $base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9pNaGNsAAAAASUVORK5CYII=';
    file_put_contents($path, base64_decode($base64, true));
}

function absoluteUrl(string $baseUrl, string $path): string
{
    if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
        return $path;
    }

    if (str_starts_with($path, '/')) {
        $parts = parse_url($baseUrl);
        $scheme = $parts['scheme'] ?? 'http';
        $host = $parts['host'] ?? 'localhost';
        $port = isset($parts['port']) ? ':' . $parts['port'] : '';

        return "{$scheme}://{$host}{$port}{$path}";
    }

    return $baseUrl . '/' . ltrim($path, '/');
}

try {
    $enterOne = requestJson('POST', $baseUrl . '/api/room/enter', $cookieOne, [
        'json' => [
            'displayName' => 'Ali',
            'roomCode' => '',
        ],
    ]);
    $roomCode = $enterOne['room']['code'];

    $enterTwo = requestJson('POST', $baseUrl . '/api/room/enter', $cookieTwo, [
        'json' => [
            'displayName' => 'Mina',
            'roomCode' => $roomCode,
        ],
    ]);
    assert_true(($enterTwo['presence']['onlineCount'] ?? 0) >= 2, 'Presence should include both participants after join.');
    assert_true(($enterTwo['room']['name'] ?? null) === 'Mina', 'Room name should default to the first participant after the creator.');

    $bootstrap = requestJson('GET', $baseUrl . '/api/room/bootstrap?code=' . urlencode($roomCode), $cookieOne);
    assert_true($bootstrap['room']['code'] === $roomCode, 'Bootstrap returned the wrong room.');
    assert_true(($bootstrap['room']['name'] ?? null) === 'Mina', 'Bootstrap should return the derived room name.');
    assert_true(($bootstrap['presence']['onlineCount'] ?? 0) >= 2, 'Bootstrap should return presence data.');

    $renameRoom = requestJson('PATCH', $baseUrl . '/api/room/name', $cookieOne, [
        'json' => [
            'roomCode' => $roomCode,
            'name' => 'اتاق پروژه',
        ],
    ]);
    assert_true(($renameRoom['room']['name'] ?? null) === 'اتاق پروژه', 'Creator should be able to rename the room.');

    $renameForbidden = request('PATCH', $baseUrl . '/api/room/name', $cookieTwo, [
        'json' => [
            'roomCode' => $roomCode,
            'name' => 'نام غیرمجاز',
        ],
    ]);
    assert_true($renameForbidden['status'] === 403, 'A non-creator should not be able to rename the room.');

    $pngPath = $tempDir . DIRECTORY_SEPARATOR . 'smoke.png';
    $textPath = $tempDir . DIRECTORY_SEPARATOR . 'smoke.txt';
    writePng($pngPath);
    file_put_contents($textPath, 'private file test');

    $send = requestJson('POST', $baseUrl . '/api/room/messages', $cookieOne, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'hello files',
            'files[0]' => new \CURLFile($pngPath, 'image/png', 'smoke.png'),
            'files[1]' => new \CURLFile($textPath, 'text/plain', 'smoke.txt'),
        ],
    ]);

    assert_true(count($send['message']['attachments']) === 2, 'Expected two uploaded attachments.');
    $messageId = (int) $send['message']['id'];
    $imageAttachment = current(array_filter($send['message']['attachments'], static fn (array $item): bool => $item['previewKind'] === 'image'));
    $downloadAttachment = current(array_filter($send['message']['attachments'], static fn (array $item): bool => $item['previewKind'] === 'download'));

    assert_true(is_array($imageAttachment), 'Image attachment was not detected.');
    assert_true(is_array($downloadAttachment), 'Download attachment was not detected.');

    $pollTwo = requestJson('GET', $baseUrl . '/api/room/messages?code=' . urlencode($roomCode), $cookieTwo);
    assert_true(($pollTwo['room']['name'] ?? null) === 'اتاق پروژه', 'Polling should return the latest room name.');
    assert_true(count($pollTwo['messages']) >= 1, 'Second participant did not receive the new message.');
    assert_true(($pollTwo['presence']['onlineCount'] ?? 0) >= 2, 'Polling should return presence data.');

    $reply = requestJson('POST', $baseUrl . '/api/room/messages', $cookieTwo, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'reply text',
            'replyToMessageId' => (string) $messageId,
        ],
    ]);
    assert_true(($reply['message']['replyTo']['id'] ?? null) === $messageId, 'Reply should reference the original message.');

    $edit = requestJson('PATCH', $baseUrl . '/api/messages/' . $messageId, $cookieOne, [
        'json' => ['text' => 'edited text'],
    ]);
    assert_true($edit['message']['bodyText'] === 'edited text', 'Edited text was not saved.');
    assert_true(($edit['presence']['onlineCount'] ?? 0) >= 1, 'Edit should return presence data.');

    $downloadAllowed = request('GET', absoluteUrl($baseUrl, $imageAttachment['url']), $cookieTwo);
    $downloadBlocked = request('GET', absoluteUrl($baseUrl, $downloadAttachment['url']));
    assert_true($downloadAllowed['status'] === 200, 'A participant should be able to view a room attachment.');
    assert_true($downloadBlocked['status'] === 403, 'A visitor outside the room should not access attachments.');

    $deleteForbidden = request('DELETE', $baseUrl . '/api/messages/' . $messageId, $cookieTwo, [
        'json' => [],
    ]);
    assert_true($deleteForbidden['status'] === 403, 'A second browser should not be able to delete this message.');

    $deleteOwn = requestJson('DELETE', $baseUrl . '/api/messages/' . $messageId, $cookieOne, [
        'json' => [],
    ]);
    assert_true($deleteOwn['message']['isDeleted'] === true, 'Own delete should mark the message as deleted.');
    assert_true(($deleteOwn['presence']['onlineCount'] ?? 0) >= 1, 'Delete should return presence data.');

    $cleanupRoom = requestJson('POST', $baseUrl . '/api/room/enter', $cookieOne, [
        'json' => [
            'displayName' => 'Ali',
            'roomCode' => '',
        ],
    ]);
    $cleanupCode = $cleanupRoom['room']['code'];

    $cleanupUpload = requestJson('POST', $baseUrl . '/api/room/messages', $cookieOne, [
        'multipart' => [
            'roomCode' => $cleanupCode,
            'text' => 'cleanup probe',
            'files[0]' => new \CURLFile($pngPath, 'image/png', 'cleanup.png'),
        ],
    ]);
    $cleanupAttachmentId = $cleanupUpload['message']['attachments'][0]['id'];

    $pdo = Database::connection();
    $pathStatement = $pdo->prepare('SELECT stored_path FROM attachments WHERE id = :id');
    $pathStatement->execute(['id' => $cleanupAttachmentId]);
    $storedPath = (string) $pathStatement->fetchColumn();
    $absoluteStoredPath = storage_path('uploads/' . $storedPath);
    assert_true(is_file($absoluteStoredPath), 'Cleanup test file was not stored on disk.');

    $expireStatement = $pdo->prepare('UPDATE rooms SET expires_at = :expires_at WHERE code = :code');
    $expireStatement->execute([
        'expires_at' => '2000-01-01 00:00:00.000000',
        'code' => $cleanupCode,
    ]);

    $removedRooms = RoomService::make()->purgeExpiredRooms();
    assert_true($removedRooms >= 1, 'Cleanup did not remove the expired room.');
    assert_true(!is_file($absoluteStoredPath), 'Cleanup did not remove the expired room file.');

    echo json_encode([
        'ok' => true,
        'roomCode' => $roomCode,
        'messageId' => $messageId,
        'attachmentCount' => count($send['message']['attachments']),
        'secondParticipantMessages' => count($pollTwo['messages']),
        'presenceCount' => $bootstrap['presence']['onlineCount'] ?? 0,
        'cleanupRemovedRooms' => $removedRooms,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $throwable) {
    fwrite(STDERR, $throwable->getMessage() . PHP_EOL);
    exit(1);
} finally {
    @unlink($cookieOne);
    @unlink($cookieTwo);

    if (is_dir($tempDir)) {
        foreach (glob($tempDir . DIRECTORY_SEPARATOR . '*') ?: [] as $path) {
            @unlink($path);
        }

        @rmdir($tempDir);
    }
}
