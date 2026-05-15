<?php

declare(strict_types=1);

namespace App\Support;

use PDO;
use PDOException;

class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection instanceof PDO) {
            return self::$connection;
        }

        $host = (string) app_config('db.host');
        $port = (int) app_config('db.port');
        $database = (string) app_config('db.database');
        $charset = (string) app_config('db.charset', 'utf8mb4');
        $username = (string) app_config('db.username');
        $password = (string) app_config('db.password');

        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=%s', $host, $port, $database, $charset);

        try {
            self::$connection = new PDO($dsn, $username, $password, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $exception) {
            throw new ApiException('اتصال به پایگاه داده برقرار نشد.', 500, [
                'debug' => app_config('app.debug') ? $exception->getMessage() : null,
            ]);
        }

        return self::$connection;
    }
}

