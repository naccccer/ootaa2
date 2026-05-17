<?php

declare(strict_types=1);

namespace App\Support;

final class MobileNumber
{
    public static function normalize(string $input): string
    {
        $digits = preg_replace('/\D+/', '', trim($input)) ?? '';

        if ($digits === '') {
            throw new ApiException('شماره موبایل را وارد کنید.', 422);
        }

        if (str_starts_with($digits, '0098')) {
            $digits = substr($digits, 4);
        } elseif (str_starts_with($digits, '98')) {
            $digits = substr($digits, 2);
        } elseif (str_starts_with($digits, '0')) {
            $digits = substr($digits, 1);
        }

        if (preg_match('/^9\d{9}$/', $digits) !== 1) {
            throw new ApiException('شماره موبایل ایران معتبر نیست.', 422);
        }

        return '+98' . $digits;
    }

    public static function toDisplay(string $normalized): string
    {
        if (preg_match('/^\+989\d{9}$/', $normalized) !== 1) {
            throw new ApiException('فرمت شماره موبایل ذخیره‌شده معتبر نیست.', 500);
        }

        return '0' . substr($normalized, 3);
    }
}
