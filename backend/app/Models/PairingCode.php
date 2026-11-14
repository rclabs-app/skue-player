<?php

namespace App\Models;

use App\Casts\ProtectedPlaylistValue;
use Illuminate\Database\Eloquent\Model;

class PairingCode extends Model
{
    protected $primaryKey = 'code';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'code',
        'payload',
        'attempts',
        'consumed',
        'expires_at',
    ];

    protected $casts = [
        'payload' => ProtectedPlaylistValue::class,
        'consumed' => 'boolean',
        'expires_at' => 'datetime',
        'attempts' => 'integer',
    ];

    protected $hidden = ['payload'];

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    public function isAvailable(): bool
    {
        return ! $this->consumed && ! $this->isExpired();
    }
}
