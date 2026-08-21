<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class Device extends Model
{
    protected $fillable = [
        'mac',
        'device_key',
        'key_expires_at',
        'name',
    ];

    protected $casts = [
        'key_expires_at' => 'datetime',
    ];

    /**
     * Relationship with DevicePlaylist.
     */
    public function playlists(): HasMany
    {
        return $this->hasMany(DevicePlaylist::class);
    }

    /**
     * Check if the device key has expired.
     */
    public function isKeyExpired(): bool
    {
        return $this->key_expires_at->isPast();
    }

    /**
     * Generate a new unique 6-character key and set expiration.
     */
    public function refreshKey(): string
    {
        $this->device_key = self::generateUniqueKey();
        $this->key_expires_at = Carbon::now()->addHours(24);
        $this->save();

        return $this->device_key;
    }

    /**
     * Generates a readable 6-character key (excluding O, 0, I, 1, etc.).
     */
    public static function generateUniqueKey(): string
    {
        $chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        
        do {
            $key = '';
            for ($i = 0; $i < 6; $i++) {
                $key .= $chars[random_int(0, strlen($chars) - 1)];
            }
        } while (self::where('device_key', $key)->where('key_expires_at', '>', Carbon::now())->exists());

        return $key;
    }
}
