<?php

declare(strict_types=1);

namespace App\Support;

class SmsIrService
{
    public function sendVerify(string $mobileNormalized, string $code): array
    {
        if ((bool) app_config('sms.fake', false) || (bool) app_config('app.is_local', false)) {
            return [
                'messageId' => random_int(100000, 999999),
                'cost' => 0.0,
                'fake' => true,
            ];
        }

        $apiKey = trim((string) app_config('sms.api_key', ''));
        $verifyUrl = trim((string) app_config('sms.verify_url', ''));
        $templateId = (int) app_config('sms.template_id', 0);

        if ($apiKey === '' || $verifyUrl === '' || $templateId <= 0) {
            throw new ApiException('تنظیمات ارسال پیامک کامل نیست.', 500);
        }

        $payload = [
            'Mobile' => MobileNumber::toDisplay($mobileNormalized),
            'TemplateId' => $templateId,
            'Parameters' => [
                [
                    'Name' => 'Code',
                    'Value' => $code,
                ],
            ],
        ];

        $handle = curl_init($verifyUrl);

        if ($handle === false) {
            throw new ApiException('اتصال به سرویس پیامک برقرار نشد.', 502);
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            CURLOPT_PROXY => '',
            CURLOPT_NOPROXY => '*',
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-API-KEY: ' . $apiKey,
            ],
            CURLOPT_TIMEOUT => 15,
        ]);

        $rawResponse = curl_exec($handle);

        if ($rawResponse === false) {
            $error = curl_error($handle);
            curl_close($handle);

            throw new ApiException('ارسال کد با خطا مواجه شد.', 502, [
                'debug' => app_config('app.debug') ? $error : null,
            ]);
        }

        $statusCode = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        curl_close($handle);

        $payload = json_decode($rawResponse, true);

        if (!is_array($payload)) {
            throw new ApiException('پاسخ سرویس پیامک معتبر نیست.', 502, [
                'debug' => app_config('app.debug') ? $rawResponse : null,
            ]);
        }

        if ($statusCode >= 400 || !isset($payload['status']) || (int) $payload['status'] !== 1) {
            throw new ApiException('ارسال کد تایید انجام نشد.', 502, [
                'debug' => app_config('app.debug') ? ($payload['message'] ?? $rawResponse) : null,
            ]);
        }

        $data = is_array($payload['data'] ?? null) ? $payload['data'] : [];

        return [
            'messageId' => (int) ($data['messageId'] ?? 0),
            'cost' => (float) ($data['cost'] ?? 0),
            'fake' => false,
        ];
    }
}
