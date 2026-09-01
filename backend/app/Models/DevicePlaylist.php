<?php

namespace App\Models;

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
    ];

    /**
     * Hidden fields to avoid exposing passwords in API responses.
     * Use makeVisible('password') when you explicitly need it.
     */
    protected $hidden = [
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
