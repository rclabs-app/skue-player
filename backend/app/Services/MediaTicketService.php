<?php

namespace App\Services;

class MediaTicketService
{
    public function issue(string $source, string $format, int $deviceId): ?array
    {
        $gateway = config('media.gateway_url');
        $encodedKey = config('media.gateway_key');
        $key = is_string($encodedKey) ? base64_decode($encodedKey, true) : false;
        $parts = is_string($gateway) ? parse_url($gateway) : false;
        if (! $parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host'])
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
            || (($parts['path'] ?? '') !== '' && $parts['path'] !== '/')
            || ! in_array($format, ['mp4', 'm4v', 'webm'], true)
            || $key === false || strlen($key) !== 32) {
            return null;
        }
        $now = now()->getTimestamp();
        $expires = $now + max(60, min(21600, (int) config('media.ticket_seconds', 21600)));
        $json = json_encode(['v' => 1, 'iat' => $now, 'exp' => $expires, 'url' => $source,
            'format' => $format, 'device_id' => $deviceId], JSON_THROW_ON_ERROR);
        $iv = random_bytes(12);
        $ciphertext = openssl_encrypt($json, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag, 'skue-media-v1');
        if ($ciphertext === false) {
            throw new \RuntimeException('Unable to issue media ticket.');
        }
        $ticket = rtrim(strtr(base64_encode($iv.$tag.$ciphertext), '+/', '-_'), '=');

        return ['url' => rtrim($gateway, '/').'/v1/media.'.$format.'?ticket='.$ticket, 'expires_at' => $expires];
    }
}
