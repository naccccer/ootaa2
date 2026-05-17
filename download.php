<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Support\ApiException;
use App\Support\AuthService;
use App\Support\RoomService;

try {
    $auth = AuthService::make();
    $user = $auth->requireAuthenticatedUser();
    $attachmentId = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['id'] ?? ''));

    if ($attachmentId === '') {
        throw new ApiException('شناسه فایل معتبر نیست.', 422);
    }

    $service = RoomService::make();
    $file = $service->attachmentForDownload($attachmentId, (int) $user['id']);
    $absolutePath = storage_path('uploads/' . $file['path']);

    if (!is_file($absolutePath)) {
        throw new ApiException('فایل موردنظر پیدا نشد.', 404);
    }

    $disposition = in_array($file['previewKind'], ['image', 'audio', 'video'], true) ? 'inline' : 'attachment';

    header('Content-Type: ' . $file['mimeType']);
    header('Content-Length: ' . filesize($absolutePath));
    header('Content-Disposition: ' . $disposition . '; filename="' . rawurlencode($file['name']) . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, max-age=3600');

    readfile($absolutePath);
    exit;
} catch (ApiException $exception) {
    http_response_code($exception->status());
    header('Content-Type: text/plain; charset=utf-8');
    echo $exception->getMessage();
} catch (Throwable) {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'خطای داخلی سرور';
}
