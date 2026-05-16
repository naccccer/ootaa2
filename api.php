<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Support\ApiException;
use App\Support\BrowserSession;
use App\Support\JsonResponse;
use App\Support\Request;
use App\Support\RoomService;

BrowserSession::ensureBrowserId();
$service = RoomService::make();

try {
    $route = Request::route();
    $method = Request::method();
    $browserId = BrowserSession::ensureBrowserId();

    if ($route === 'health' && $method === 'GET') {
        JsonResponse::success($service->health());
    }

    if ($route === 'room/enter' && $method === 'POST') {
        JsonResponse::success($service->enterRoom(
            (string) Request::input('displayName', ''),
            Request::input('roomCode'),
            $browserId
        ));
    }

    if ($route === 'room/bootstrap' && $method === 'GET') {
        JsonResponse::success($service->bootstrapRoom(
            (string) Request::query('code', ''),
            $browserId
        ));
    }

    if ($route === 'room/name' && $method === 'PATCH') {
        JsonResponse::success($service->updateRoomName(
            (string) Request::input('roomCode', ''),
            $browserId,
            (string) Request::input('name', '')
        ));
    }

    if ($route === 'room/messages' && $method === 'GET') {
        JsonResponse::success($service->fetchMessages(
            (string) Request::query('code', ''),
            $browserId,
            Request::query('since')
        ));
    }

    if ($route === 'room/messages' && $method === 'POST') {
        JsonResponse::success($service->sendMessage(
            (string) Request::input('roomCode', ''),
            $browserId,
            is_string(Request::input('text')) ? (string) Request::input('text') : null,
            Request::uploadedFiles('files')
        ), 201);
    }

    if (preg_match('#^messages/(\d+)$#', $route, $matches) === 1 && $method === 'PATCH') {
        JsonResponse::success($service->editMessage(
            (int) $matches[1],
            $browserId,
            is_string(Request::input('text')) ? (string) Request::input('text') : null
        ));
    }

    if (preg_match('#^messages/(\d+)$#', $route, $matches) === 1 && $method === 'DELETE') {
        JsonResponse::success($service->deleteMessage(
            (int) $matches[1],
            $browserId
        ));
    }

    throw new ApiException('مسیر درخواستی پیدا نشد.', 404);
} catch (ApiException $exception) {
    JsonResponse::error($exception->getMessage(), $exception->status(), $exception->details());
} catch (Throwable $throwable) {
    JsonResponse::error('خطای غیرمنتظره‌ای رخ داد.', 500, [
        'debug' => app_config('app.debug') ? $throwable->getMessage() : null,
    ]);
}
