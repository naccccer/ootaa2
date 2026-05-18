<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

use App\Support\ApiException;
use App\Support\AuthService;
use App\Support\JsonResponse;
use App\Support\Request;
use App\Support\RoomService;

$auth = AuthService::make();
$service = RoomService::make();

try {
    $route = Request::route();
    $method = Request::method();

    if ($route === 'health' && $method === 'GET') {
        JsonResponse::success($service->health());
    }

    if ($route === 'auth/register' && $method === 'POST') {
        JsonResponse::success($auth->register(
            (string) Request::input('mobile', ''),
            (string) Request::input('displayName', ''),
            (string) Request::input('password', '')
        ), 201);
    }

    if ($route === 'auth/guest' && $method === 'POST') {
        JsonResponse::success($auth->createGuest(
            (string) Request::input('displayName', '')
        ), 201);
    }

    if ($route === 'auth/login' && $method === 'POST') {
        JsonResponse::success($auth->login(
            (string) Request::input('mobile', ''),
            (string) Request::input('password', '')
        ));
    }

    if ($route === 'auth/logout' && $method === 'POST') {
        JsonResponse::success($auth->logout());
    }

    if ($route === 'auth/me' && $method === 'GET') {
        JsonResponse::success($auth->me());
    }

    if ($route === 'account/profile' && $method === 'PATCH') {
        $user = $auth->requireRegisteredUser();

        JsonResponse::success($auth->updateProfile(
            (int) $user['id'],
            (string) Request::input('displayName', '')
        ));
    }

    if ($route === 'account/password' && $method === 'PATCH') {
        $user = $auth->requireRegisteredUser();

        JsonResponse::success($auth->updatePassword(
            (int) $user['id'],
            (string) Request::input('currentPassword', ''),
            (string) Request::input('newPassword', '')
        ));
    }

    if ($route === 'contacts/search' && $method === 'GET') {
        $user = $auth->requireRegisteredUser();

        JsonResponse::success($auth->searchUsers(
            (string) Request::query('q', ''),
            (int) $user['id']
        ));
    }

    if ($route === 'room/enter' && $method === 'POST') {
        JsonResponse::success($service->enterRoom(
            Request::input('roomCode'),
            $auth->requireAuthenticatedUser()
        ));
    }

    if ($route === 'room/bootstrap' && $method === 'GET') {
        JsonResponse::success($service->bootstrapRoom(
            (string) Request::query('code', ''),
            $auth->requireAuthenticatedUser()
        ));
    }

    if ($route === 'room/name' && $method === 'PATCH') {
        JsonResponse::success($service->updateRoomName(
            (string) Request::input('roomCode', ''),
            $auth->requireAuthenticatedUser(),
            (string) Request::input('name', '')
        ));
    }

    if ($route === 'room/messages' && $method === 'GET') {
        JsonResponse::success($service->fetchMessages(
            (string) Request::query('code', ''),
            $auth->requireAuthenticatedUser(),
            Request::query('since')
        ));
    }

    if ($route === 'room/messages' && $method === 'POST') {
        JsonResponse::success($service->sendMessage(
            (string) Request::input('roomCode', ''),
            $auth->requireAuthenticatedUser(),
            is_string(Request::input('text')) ? (string) Request::input('text') : null,
            Request::uploadedFiles('files'),
            Request::input('replyToMessageId')
        ), 201);
    }

    if (preg_match('#^messages/(\d+)$#', $route, $matches) === 1 && $method === 'PATCH') {
        JsonResponse::success($service->editMessage(
            (int) $matches[1],
            $auth->requireAuthenticatedUser(),
            is_string(Request::input('text')) ? (string) Request::input('text') : null
        ));
    }

    if (preg_match('#^messages/(\d+)$#', $route, $matches) === 1 && $method === 'DELETE') {
        JsonResponse::success($service->deleteMessage(
            (int) $matches[1],
            $auth->requireAuthenticatedUser()
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
