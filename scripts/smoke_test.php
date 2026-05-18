<?php

declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

use App\Support\Database;
use App\Support\RoomService;

$baseUrl = rtrim($argv[1] ?? 'http://localhost/ootaa2', '/');
$cookieOne = tempnam(sys_get_temp_dir(), 'ootaa2-user-1-');
$cookieOneSecondDevice = tempnam(sys_get_temp_dir(), 'ootaa2-user-1b-');
$cookieTwo = tempnam(sys_get_temp_dir(), 'ootaa2-user-2-');
$cookieOtpExisting = tempnam(sys_get_temp_dir(), 'ootaa2-otp-existing-');
$cookieOtpNew = tempnam(sys_get_temp_dir(), 'ootaa2-otp-new-');
$cookieGuest = tempnam(sys_get_temp_dir(), 'ootaa2-guest-');
$cookieGuestExisting = tempnam(sys_get_temp_dir(), 'ootaa2-guest-existing-');
$tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ootaa2-smoke-' . bin2hex(random_bytes(4));

if (
    $cookieOne === false
    || $cookieOneSecondDevice === false
    || $cookieTwo === false
    || $cookieOtpExisting === false
    || $cookieOtpNew === false
    || $cookieGuest === false
    || $cookieGuestExisting === false
) {
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

function latestOtpDebugCode(string $mobileInput, string $purpose): string
{
    $mobileNormalized = \App\Support\MobileNumber::normalize($mobileInput);
    $statement = Database::connection()->prepare(
        'SELECT meta_json
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
    $metaJson = $statement->fetchColumn();
    $meta = is_string($metaJson) ? json_decode($metaJson, true) : null;
    $code = is_array($meta) ? ($meta['_debugCode'] ?? null) : null;

    if (!is_string($code) || $code === '') {
        throw new RuntimeException("Missing debug OTP code for {$purpose}.");
    }

    return $code;
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
    $anonymousMe = requestJson('GET', $baseUrl . '/api/auth/me');
    assert_true($anonymousMe['user'] === null, 'Anonymous auth/me should return a null user.');

    $userOne = requestJson('POST', $baseUrl . '/api/auth/register', $cookieOne, [
        'json' => [
            'mobile' => '09123456789',
            'displayName' => 'Ali',
            'password' => 'secret123',
        ],
    ]);
    assert_true(($userOne['user']['mobileNormalized'] ?? '') === '+989123456789', 'Mobile should be normalized on registration.');

    $duplicateRegister = request('POST', $baseUrl . '/api/auth/register', null, [
        'json' => [
            'mobile' => '+989123456789',
            'displayName' => 'Ali Duplicate',
            'password' => 'secret123',
        ],
    ]);
    assert_true($duplicateRegister['status'] === 409, 'Duplicate mobile registration should be rejected.');

    $wrongLogin = request('POST', $baseUrl . '/api/auth/login', null, [
        'json' => [
            'mobile' => '09123456789',
            'password' => 'wrong-password',
        ],
    ]);
    assert_true($wrongLogin['status'] === 401, 'Wrong password should fail.');

    $userOneSecondDevice = requestJson('POST', $baseUrl . '/api/auth/login', $cookieOneSecondDevice, [
        'json' => [
            'mobile' => '989123456789',
            'password' => 'secret123',
        ],
    ]);
    assert_true(($userOneSecondDevice['user']['id'] ?? 0) === ($userOne['user']['id'] ?? -1), 'Second device should log into the same user.');

    $userTwo = requestJson('POST', $baseUrl . '/api/auth/register', $cookieTwo, [
        'json' => [
            'mobile' => '09121234567',
            'displayName' => 'Mina',
            'password' => 'secret456',
        ],
    ]);
    assert_true(($userTwo['user']['mobileDisplay'] ?? '') === '09121234567', 'Second user should expose the display mobile format.');

    requestJson('POST', $baseUrl . '/api/auth/register/request-otp', null, [
        'json' => [
            'mobile' => '09120000001',
            'displayName' => 'Sara OTP',
            'password' => 'otpregister123',
        ],
    ]);
    $registerOtpCode = latestOtpDebugCode('09120000001', 'register');
    $otpRegisteredUser = requestJson('POST', $baseUrl . '/api/auth/register/confirm', null, [
        'json' => [
            'mobile' => '09120000001',
            'code' => $registerOtpCode,
        ],
    ]);
    assert_true(($otpRegisteredUser['user']['mobileDisplay'] ?? '') === '09120000001', 'OTP registration should create a registered user.');

    requestJson('POST', $baseUrl . '/api/auth/login/request-otp', $cookieOtpExisting, [
        'json' => [
            'mobile' => '09123456789',
        ],
    ]);
    $existingLoginOtpCode = latestOtpDebugCode('09123456789', 'login');
    $existingOtpLogin = requestJson('POST', $baseUrl . '/api/auth/login/verify-otp', $cookieOtpExisting, [
        'json' => [
            'mobile' => '09123456789',
            'code' => $existingLoginOtpCode,
        ],
    ]);
    assert_true(($existingOtpLogin['needsProfile'] ?? true) === false, 'Existing OTP login should not require a profile step.');
    assert_true(($existingOtpLogin['user']['id'] ?? 0) === ($userOne['user']['id'] ?? -1), 'Existing OTP login should authenticate the same account.');

    requestJson('POST', $baseUrl . '/api/auth/login/request-otp', $cookieOtpNew, [
        'json' => [
            'mobile' => '09120000002',
        ],
    ]);
    $newLoginOtpCode = latestOtpDebugCode('09120000002', 'login');
    $newOtpVerify = requestJson('POST', $baseUrl . '/api/auth/login/verify-otp', $cookieOtpNew, [
        'json' => [
            'mobile' => '09120000002',
            'code' => $newLoginOtpCode,
        ],
    ]);
    assert_true(($newOtpVerify['needsProfile'] ?? false) === true, 'New OTP login should request profile completion.');
    $newOtpAccount = requestJson('POST', $baseUrl . '/api/auth/login/complete-profile', $cookieOtpNew, [
        'json' => [
            'mobile' => '09120000002',
            'displayName' => 'New OTP User',
        ],
    ]);
    assert_true(($newOtpAccount['user']['displayName'] ?? '') === 'New OTP User', 'Completing OTP profile should create the account.');

    requestJson('POST', $baseUrl . '/api/auth/password/request-otp', null, [
        'json' => [
            'mobile' => '09121234567',
        ],
    ]);
    $passwordResetCode = latestOtpDebugCode('09121234567', 'password_reset');
    $passwordReset = requestJson('POST', $baseUrl . '/api/auth/password/reset', null, [
        'json' => [
            'mobile' => '09121234567',
            'code' => $passwordResetCode,
            'newPassword' => 'secret654',
        ],
    ]);
    assert_true(($passwordReset['passwordReset'] ?? false) === true, 'Password reset by OTP should succeed.');
    $postResetLogin = requestJson('POST', $baseUrl . '/api/auth/login', $cookieTwo, [
        'json' => [
            'mobile' => '09121234567',
            'password' => 'secret654',
        ],
    ]);
    assert_true(($postResetLogin['user']['id'] ?? 0) === ($userTwo['user']['id'] ?? -1), 'User should log in with the OTP-reset password.');

    $enterOne = requestJson('POST', $baseUrl . '/api/room/enter', $cookieOne, [
        'json' => [
            'roomCode' => '',
        ],
    ]);
    $roomCode = $enterOne['room']['code'];
    assert_true(($enterOne['presence']['onlineCount'] ?? 0) === 1, 'Room creator should be the first online participant.');

    $enterSameAccountSecondDevice = requestJson('POST', $baseUrl . '/api/room/enter', $cookieOneSecondDevice, [
        'json' => [
            'roomCode' => $roomCode,
        ],
    ]);
    assert_true(($enterSameAccountSecondDevice['presence']['onlineCount'] ?? 0) === 1, 'Same account on a second device should not create a second participant.');

    $renameRoom = requestJson('PATCH', $baseUrl . '/api/room/name', $cookieOneSecondDevice, [
        'json' => [
            'roomCode' => $roomCode,
            'name' => 'اتاق پروژه',
        ],
    ]);
    assert_true(($renameRoom['room']['name'] ?? null) === 'اتاق پروژه', 'Creator account should be able to rename the room from another device.');

    $enterTwo = requestJson('POST', $baseUrl . '/api/room/enter', $cookieTwo, [
        'json' => [
            'roomCode' => $roomCode,
        ],
    ]);
    assert_true(($enterTwo['presence']['onlineCount'] ?? 0) >= 2, 'Second user should appear in room presence.');

    $renameForbidden = request('PATCH', $baseUrl . '/api/room/name', $cookieTwo, [
        'json' => [
            'roomCode' => $roomCode,
            'name' => 'نام غیرمجاز',
        ],
    ]);
    assert_true($renameForbidden['status'] === 403, 'A non-creator user should not rename the room.');

    $bootstrap = requestJson('GET', $baseUrl . '/api/room/bootstrap?code=' . urlencode($roomCode), $cookieOneSecondDevice);
    assert_true(($bootstrap['room']['name'] ?? null) === 'اتاق پروژه', 'Bootstrap should return the renamed room.');

    $pngPath = $tempDir . DIRECTORY_SEPARATOR . 'smoke.png';
    $textPath = $tempDir . DIRECTORY_SEPARATOR . 'smoke.txt';
    writePng($pngPath);
    file_put_contents($textPath, 'private file test');

    $guest = requestJson('POST', $baseUrl . '/api/auth/guest', $cookieGuest, [
        'json' => [
            'displayName' => 'Guest One',
        ],
    ]);
    assert_true(($guest['user']['isGuest'] ?? false) === true, 'Guest auth should create a guest user.');
    assert_true(array_key_exists('mobileDisplay', $guest['user']) && $guest['user']['mobileDisplay'] === null, 'Guest should not expose a mobile display.');

    $guestCreateRoom = request('POST', $baseUrl . '/api/room/enter', $cookieGuest, [
        'json' => [
            'roomCode' => '',
        ],
    ]);
    assert_true($guestCreateRoom['status'] === 403, 'Guest should not be able to create a room.');

    $guestEnter = requestJson('POST', $baseUrl . '/api/room/enter', $cookieGuest, [
        'json' => [
            'roomCode' => $roomCode,
        ],
    ]);
    assert_true(($guestEnter['participant']['mobileDisplay'] ?? null) === null, 'Guest participant should not need a mobile display.');

    $guestSend = requestJson('POST', $baseUrl . '/api/room/messages', $cookieGuest, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'guest file',
            'files[0]' => new CURLFile($pngPath, 'image/png', 'guest.png'),
        ],
    ]);
    $guestMessageId = (int) $guestSend['message']['id'];
    assert_true(($guestSend['message']['senderMobile'] ?? null) === null, 'Guest message should not need sender mobile.');
    assert_true(count($guestSend['message']['attachments']) === 1, 'Guest should be able to upload an attachment.');

    $guestDownloadAllowed = request('GET', absoluteUrl($baseUrl, $guestSend['message']['attachments'][0]['url']), $cookieGuest);
    $guestDownloadBlocked = request('GET', absoluteUrl($baseUrl, $guestSend['message']['attachments'][0]['url']));
    assert_true($guestDownloadAllowed['status'] === 200, 'Guest room participant should access room attachments.');
    assert_true($guestDownloadBlocked['status'] === 401, 'Anonymous visitor should not access guest uploaded attachments.');

    $guestRegistered = requestJson('POST', $baseUrl . '/api/auth/register', $cookieGuest, [
        'json' => [
            'mobile' => '09330001122',
            'displayName' => 'Guest Registered',
            'password' => 'guestpass123',
        ],
    ]);
    assert_true(($guestRegistered['user']['isGuest'] ?? true) === false, 'Guest registration should convert the guest into a registered user.');

    $guestAfterRegisterMessages = requestJson('GET', $baseUrl . '/api/room/messages?code=' . urlencode($roomCode), $cookieGuest);
    $registeredGuestMessage = current(array_filter($guestAfterRegisterMessages['messages'], static fn (array $message): bool => (int) $message['id'] === $guestMessageId));
    assert_true(is_array($registeredGuestMessage) && ($registeredGuestMessage['isOwn'] ?? false) === true, 'Guest message should remain own after registration.');

    $guestExisting = requestJson('POST', $baseUrl . '/api/auth/guest', $cookieGuestExisting, [
        'json' => [
            'displayName' => 'Guest Existing',
        ],
    ]);
    assert_true(($guestExisting['user']['isGuest'] ?? false) === true, 'Second guest auth should create a guest user.');

    requestJson('POST', $baseUrl . '/api/room/enter', $cookieGuestExisting, [
        'json' => [
            'roomCode' => $roomCode,
        ],
    ]);
    $guestExistingSend = requestJson('POST', $baseUrl . '/api/room/messages', $cookieGuestExisting, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'guest before existing login',
        ],
    ]);
    $guestExistingMessageId = (int) $guestExistingSend['message']['id'];

    $guestLoginTransfer = requestJson('POST', $baseUrl . '/api/auth/login', $cookieGuestExisting, [
        'json' => [
            'mobile' => '09121234567',
            'password' => 'secret654',
        ],
    ]);
    assert_true(($guestLoginTransfer['user']['id'] ?? 0) === ($userTwo['user']['id'] ?? -1), 'Guest login should transfer data to the existing account.');

    $transferredMessages = requestJson('GET', $baseUrl . '/api/room/messages?code=' . urlencode($roomCode), $cookieGuestExisting);
    $transferredMessage = current(array_filter($transferredMessages['messages'], static fn (array $message): bool => (int) $message['id'] === $guestExistingMessageId));
    assert_true(is_array($transferredMessage) && ($transferredMessage['isOwn'] ?? false) === true, 'Transferred guest message should belong to the logged-in account.');

    $send = requestJson('POST', $baseUrl . '/api/room/messages', $cookieOne, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'hello files',
            'files[0]' => new CURLFile($pngPath, 'image/png', 'smoke.png'),
            'files[1]' => new CURLFile($textPath, 'text/plain', 'smoke.txt'),
        ],
    ]);
    $messageId = (int) $send['message']['id'];
    assert_true(count($send['message']['attachments']) === 2, 'Message should store two attachments.');
    assert_true(($send['message']['senderMobile'] ?? '') === '09123456789', 'Messages should expose sender mobile display.');

    $pollTwo = requestJson('GET', $baseUrl . '/api/room/messages?code=' . urlencode($roomCode), $cookieTwo);
    assert_true(count($pollTwo['messages']) >= 1, 'Second user should receive the room messages.');

    $reply = requestJson('POST', $baseUrl . '/api/room/messages', $cookieTwo, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'reply text',
            'replyToMessageId' => (string) $messageId,
        ],
    ]);
    assert_true(($reply['message']['replyTo']['id'] ?? null) === $messageId, 'Reply should reference the original message.');

    $editFromSecondDevice = requestJson('PATCH', $baseUrl . '/api/messages/' . $messageId, $cookieOneSecondDevice, [
        'json' => [
            'text' => 'edited from same account',
        ],
    ]);
    assert_true(($editFromSecondDevice['message']['bodyText'] ?? '') === 'edited from same account', 'Same account on another device should edit the message.');

    $deleteForbidden = request('DELETE', $baseUrl . '/api/messages/' . $messageId, $cookieTwo, [
        'json' => [],
    ]);
    assert_true($deleteForbidden['status'] === 403, 'Another user should not delete this message.');

    $downloadAllowed = request('GET', absoluteUrl($baseUrl, $send['message']['attachments'][0]['url']), $cookieTwo);
    $downloadBlocked = request('GET', absoluteUrl($baseUrl, $send['message']['attachments'][1]['url']));
    assert_true($downloadAllowed['status'] === 200, 'A room participant should access room attachments.');
    assert_true($downloadBlocked['status'] === 401, 'A logged-out visitor should not access attachments.');

    $profileUpdate = requestJson('PATCH', $baseUrl . '/api/account/profile', $cookieOne, [
        'json' => [
            'displayName' => 'Ali Updated',
        ],
    ]);
    assert_true(($profileUpdate['user']['displayName'] ?? '') === 'Ali Updated', 'Profile update should return the new display name.');

    $newMessage = requestJson('POST', $baseUrl . '/api/room/messages', $cookieOne, [
        'multipart' => [
            'roomCode' => $roomCode,
            'text' => 'message after profile update',
        ],
    ]);
    assert_true(($newMessage['message']['senderName'] ?? '') === 'Ali Updated', 'Messages sent after profile update should use the new display name.');

    $oldMessageSnapshot = requestJson('GET', $baseUrl . '/api/room/messages?code=' . urlencode($roomCode), $cookieTwo);
    $firstMessage = current(array_filter($oldMessageSnapshot['messages'], static fn (array $message): bool => (int) $message['id'] === $messageId));
    assert_true(is_array($firstMessage), 'Original message should still be present.');
    assert_true(($firstMessage['senderName'] ?? '') === 'Ali', 'Original message should keep the old sender snapshot.');

    $passwordChange = requestJson('PATCH', $baseUrl . '/api/account/password', $cookieOne, [
        'json' => [
            'currentPassword' => 'secret123',
            'newPassword' => 'secret999',
        ],
    ]);
    assert_true(($passwordChange['user']['displayName'] ?? '') === 'Ali Updated', 'Password change should keep the authenticated user data.');

    $expiredSecondDeviceSession = requestJson('GET', $baseUrl . '/api/auth/me', $cookieOneSecondDevice);
    assert_true($expiredSecondDeviceSession['user'] === null, 'Changing password should revoke the other device session.');

    $revokedProtectedAccess = request('GET', $baseUrl . '/api/room/bootstrap?code=' . urlencode($roomCode), $cookieOneSecondDevice);
    assert_true($revokedProtectedAccess['status'] === 401, 'Revoked session should lose access to protected routes.');

    $postPasswordLogin = requestJson('POST', $baseUrl . '/api/auth/login', $cookieOneSecondDevice, [
        'json' => [
            'mobile' => '09123456789',
            'password' => 'secret999',
        ],
    ]);
    assert_true(($postPasswordLogin['user']['displayName'] ?? '') === 'Ali Updated', 'User should be able to log in with the new password.');

    $deleteOwn = requestJson('DELETE', $baseUrl . '/api/messages/' . $messageId, $cookieOneSecondDevice, [
        'json' => [],
    ]);
    assert_true(($deleteOwn['message']['isDeleted'] ?? false) === true, 'Same account on second device should delete the message.');

    $cleanupRoom = requestJson('POST', $baseUrl . '/api/room/enter', $cookieOne, [
        'json' => [
            'roomCode' => '',
        ],
    ]);
    $cleanupCode = $cleanupRoom['room']['code'];

    $cleanupUpload = requestJson('POST', $baseUrl . '/api/room/messages', $cookieOne, [
        'multipart' => [
            'roomCode' => $cleanupCode,
            'text' => 'cleanup probe',
            'files[0]' => new CURLFile($pngPath, 'image/png', 'cleanup.png'),
        ],
    ]);
    $cleanupAttachmentId = $cleanupUpload['message']['attachments'][0]['id'];

    $pdo = Database::connection();
    $pathStatement = $pdo->prepare('SELECT stored_path FROM attachments WHERE id = :id');
    $pathStatement->execute(['id' => $cleanupAttachmentId]);
    $storedPath = (string) $pathStatement->fetchColumn();
    $absoluteStoredPath = storage_path('uploads/' . $storedPath);
    assert_true(is_file($absoluteStoredPath), 'Cleanup test file should exist on disk before purge.');

    $expireStatement = $pdo->prepare('UPDATE rooms SET expires_at = :expires_at WHERE code = :code');
    $expireStatement->execute([
        'expires_at' => '2000-01-01 00:00:00.000000',
        'code' => $cleanupCode,
    ]);

    $removedRooms = RoomService::make()->purgeExpiredRooms();
    assert_true($removedRooms >= 1, 'Expired rooms should be purged.');
    assert_true(!is_file($absoluteStoredPath), 'Purging an expired room should remove its files.');

    echo json_encode([
        'ok' => true,
        'roomCode' => $roomCode,
        'messageId' => $messageId,
        'attachmentCount' => count($send['message']['attachments']),
        'presenceCount' => $enterTwo['presence']['onlineCount'] ?? 0,
        'cleanupRemovedRooms' => $removedRooms,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
} catch (Throwable $throwable) {
    fwrite(STDERR, $throwable->getMessage() . PHP_EOL);
    exit(1);
} finally {
    @unlink($cookieOne);
    @unlink($cookieOneSecondDevice);
    @unlink($cookieTwo);
    @unlink($cookieOtpExisting);
    @unlink($cookieOtpNew);
    @unlink($cookieGuest);
    @unlink($cookieGuestExisting);

    if (is_dir($tempDir)) {
        foreach (glob($tempDir . DIRECTORY_SEPARATOR . '*') ?: [] as $path) {
            @unlink($path);
        }

        @rmdir($tempDir);
    }
}
