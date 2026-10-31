<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'device_id',
        'customer_id',
        'type',
        'status',
        'starts_at',
        'expires_at',
        'amount_cents',
        'payment_method',
        'notes',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'expires_at' => 'datetime',
        'amount_cents' => 'integer',
    ];

    /**
     * The device linked to this subscription.
     */
    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class);
    }

    /**
     * The customer linked to this subscription.
     */
    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    /**
     * Check if subscription is active and not expired.
     */
    public function isValid(): bool
    {
        if ($this->status !== 'active') {
            return false;
        }

        if ($this->type === 'lifetime' || is_null($this->expires_at)) {
            return true;
        }

        return $this->expires_at->isFuture();
    }
}
