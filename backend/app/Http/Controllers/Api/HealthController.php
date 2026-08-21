<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;

class HealthController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'status'  => 'ok',
            'service' => 'RC Player API',
            'version' => config('app.version', '0.1.0'),
        ]);
    }
}
