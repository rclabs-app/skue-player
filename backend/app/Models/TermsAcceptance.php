<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TermsAcceptance extends Model
{
    protected $fillable = [
        'acceptance_id',
        'device_id',
        'terms_version',
        'platform',
        'ip_address',
    ];
}
