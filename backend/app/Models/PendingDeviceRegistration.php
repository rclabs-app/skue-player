<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PendingDeviceRegistration extends Model
{
    protected $fillable = ['mac', 'device_key', 'name', 'device_model', 'app_version', 'ip_address', 'expires_at'];

    protected $casts = ['expires_at' => 'datetime'];
}
