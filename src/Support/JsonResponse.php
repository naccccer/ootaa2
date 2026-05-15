<?php

declare(strict_types=1);

namespace App\Support;

class JsonResponse
{
    public static function send(array $payload, int $status = 200): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, no-cache, must-revalidate');

        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(array $data = [], int $status = 200): never
    {
        self::send([
            'ok' => true,
            'data' => $data,
        ], $status);
    }

    public static function error(string $message, int $status = 400, array $details = []): never
    {
        self::send([
            'ok' => false,
            'error' => [
                'message' => $message,
                'details' => array_filter($details, static fn (mixed $value): bool => $value !== null),
            ],
        ], $status);
    }
}

