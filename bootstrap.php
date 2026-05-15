<?php

declare(strict_types=1);

date_default_timezone_set('Asia/Tehran');

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';

    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $relativePath = str_replace('\\', DIRECTORY_SEPARATOR, $relativeClass) . '.php';
    $fullPath = __DIR__ . DIRECTORY_SEPARATOR . 'src' . DIRECTORY_SEPARATOR . $relativePath;

    if (is_file($fullPath)) {
        require $fullPath;
    }
});

function base_path(string $path = ''): string
{
    $base = __DIR__;

    if ($path === '') {
        return $base;
    }

    return $base . DIRECTORY_SEPARATOR . ltrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path), DIRECTORY_SEPARATOR);
}

function storage_path(string $path = ''): string
{
    return base_path('storage' . ($path === '' ? '' : DIRECTORY_SEPARATOR . $path));
}

function app_config(?string $key = null, mixed $default = null): mixed
{
    static $config;

    if ($config === null) {
        $config = require base_path('config/app.php');
    }

    if ($key === null) {
        return $config;
    }

    $segments = explode('.', $key);
    $value = $config;

    foreach ($segments as $segment) {
        if (!is_array($value) || !array_key_exists($segment, $value)) {
            return $default;
        }

        $value = $value[$segment];
    }

    return $value;
}

function app_base_path(): string
{
    $basePath = (string) app_config('app.base_path', '');

    if ($basePath === '' || $basePath === '/') {
        return '';
    }

    return rtrim($basePath, '/');
}

function app_url(string $path = ''): string
{
    $basePath = app_base_path();
    $trimmedPath = ltrim($path, '/');

    if ($trimmedPath === '') {
        return $basePath === '' ? '/' : $basePath . '/';
    }

    return ($basePath === '' ? '' : $basePath) . '/' . $trimmedPath;
}

