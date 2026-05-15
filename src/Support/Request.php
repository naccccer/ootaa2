<?php

declare(strict_types=1);

namespace App\Support;

class Request
{
    public static function method(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    public static function route(): string
    {
        $route = trim((string) ($_GET['route'] ?? ''), '/');

        if ($route !== '') {
            return $route;
        }

        $candidates = array_filter([
            $_SERVER['PATH_INFO'] ?? null,
            $_SERVER['ORIG_PATH_INFO'] ?? null,
            $_SERVER['REDIRECT_URL'] ?? null,
            $_SERVER['UNENCODED_URL'] ?? null,
            parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH) ?: null,
        ]);

        foreach ($candidates as $candidate) {
            $resolved = self::extractRouteFromPath((string) $candidate);

            if ($resolved !== '') {
                return $resolved;
            }
        }

        return '';
    }

    private static function extractRouteFromPath(string $uriPath): string
    {
        if ($uriPath === '') {
            return '';
        }

        $basePath = app_base_path();

        if ($basePath !== '' && str_starts_with($uriPath, $basePath . '/')) {
            $uriPath = substr($uriPath, strlen($basePath) + 1);
        } else {
            $uriPath = ltrim($uriPath, '/');
        }

        if (str_starts_with($uriPath, 'api.php/')) {
            return trim(substr($uriPath, 8), '/');
        }

        if (str_starts_with($uriPath, 'api/')) {
            return trim(substr($uriPath, 4), '/');
        }

        return trim($uriPath, '/');
    }

    public static function query(string $key, mixed $default = null): mixed
    {
        return $_GET[$key] ?? $default;
    }

    public static function json(): array
    {
        static $decoded;

        if ($decoded !== null) {
            return $decoded;
        }

        $raw = file_get_contents('php://input');

        if ($raw === false || trim($raw) === '') {
            $decoded = [];
            return $decoded;
        }

        $decodedJson = json_decode($raw, true);

        if (!is_array($decodedJson)) {
            throw new ApiException('درخواست ارسالی قابل خواندن نیست.', 422);
        }

        $decoded = $decodedJson;

        return $decoded;
    }

    public static function input(string $key, mixed $default = null): mixed
    {
        if (array_key_exists($key, $_POST)) {
            return $_POST[$key];
        }

        $json = self::json();

        return $json[$key] ?? $default;
    }

    public static function uploadedFiles(string $field): array
    {
        if (!isset($_FILES[$field]) || !is_array($_FILES[$field])) {
            return [];
        }

        $files = $_FILES[$field];

        if (!is_array($files['name'])) {
            return [$files];
        }

        $normalized = [];
        $total = count($files['name']);

        for ($index = 0; $index < $total; $index++) {
            $normalized[] = [
                'name' => $files['name'][$index],
                'type' => $files['type'][$index],
                'tmp_name' => $files['tmp_name'][$index],
                'error' => $files['error'][$index],
                'size' => $files['size'][$index],
            ];
        }

        return $normalized;
    }
}
