<?php

namespace App\Casts;

use App\Exceptions\PlaylistProtectionException;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

/** Versioned encryption, with read compatibility for existing plaintext rows. */
class ProtectedPlaylistValue implements CastsAttributes
{
    public const PREFIX = 'skue:encrypted:v1:';

    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return self::decode($value);
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return self::encode($value);
    }

    public static function encode(?string $value): ?string
    {
        return $value === null ? null : self::PREFIX.Crypt::encryptString($value);
    }

    public static function decode(?string $value): ?string
    {
        if ($value === null || ! str_starts_with($value, self::PREFIX)) {
            return $value;
        }

        try {
            return Crypt::decryptString(substr($value, strlen(self::PREFIX)));
        } catch (\Throwable) {
            throw new PlaylistProtectionException;
        }
    }
}
