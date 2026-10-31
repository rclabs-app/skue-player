<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class Device extends Model
{
    protected $fillable = [
        'customer_id',
        'mac',
        'device_key',
        'key_expires_at',
        'name',
        'status',
        'trial_ends_at',
        'device_model',
        'app_version',
        'ip_address',
        'last_seen_at',
    ];

    protected $casts = [
        'key_expires_at' => 'datetime',
        'trial_ends_at'  => 'datetime',
        'last_seen_at'   => 'datetime',
    ];

    /**
     * Relationship with Customer.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Relationship with Subscriptions.
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * Active subscription relationship.
     */
    public function activeSubscription(): HasOne
    {
        return $this->hasOne(Subscription::class)
            ->where('status', 'active')
            ->where(function ($query) {
                $query->whereNull('expires_at')
                      ->orWhere('expires_at', '>', Carbon::now());
            })
            ->latestOfMany();
    }

    /**
     * Relationship with DevicePlaylist.
     */
    public function playlists(): HasMany
    {
        return $this->hasMany(DevicePlaylist::class);
    }

    /**
     * Check if the device license is active (either via active subscription or ongoing trial).
     */
    public function isLicensed(): bool
    {
        if ($this->status === 'blocked') {
            return false;
        }

        if ($this->activeSubscription()->exists()) {
            return true;
        }

        if ($this->status === 'trial' && $this->trial_ends_at && $this->trial_ends_at->isFuture()) {
            return true;
        }

        return false;
    }

    /**
     * Calculate days remaining on license / trial.
     */
    public function daysRemaining(): int
    {
        $activeSub = $this->activeSubscription;
        if ($activeSub) {
            if ($activeSub->type === 'lifetime' || is_null($activeSub->expires_at)) {
                return 9999;
            }
            return max(0, Carbon::now()->diffInDays($activeSub->expires_at, false));
        }

        if ($this->status === 'trial' && $this->trial_ends_at) {
            return max(0, Carbon::now()->diffInDays($this->trial_ends_at, false));
        }

        return 0;
    }

    /**
     * Check if the device key has expired.
     */
    public function isKeyExpired(): bool
    {
        return $this->key_expires_at->isPast();
    }

    /**
     * Generate a new unique 6-character key and set permanent expiration.
     */
    public function refreshKey(): string
    {
        if (!$this->device_key) {
            $this->device_key = self::generateUniqueKey();
        }
        $this->key_expires_at = Carbon::now()->addYears(100);
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
