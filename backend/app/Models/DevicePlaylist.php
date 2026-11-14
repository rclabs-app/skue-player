<?php

namespace App\Models;

use App\Casts\ProtectedPlaylistValue;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DevicePlaylist extends Model
{
    protected $fillable = [
        'device_id',
        'name',
        'type',
        'url',
        'username',
        'password',
        'is_active',
        'is_main',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_main' => 'boolean',
        'url' => ProtectedPlaylistValue::class,
        'username' => ProtectedPlaylistValue::class,
        'password' => ProtectedPlaylistValue::class,
    ];

    /**
     * Configuration is only serialized explicitly for the authenticated device.
     */
    protected $hidden = [
        'url',
        'username',
        'password',
    ];

    /**
     * Relationship with Device.
     */
    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }
}
