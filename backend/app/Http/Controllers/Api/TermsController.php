<?php

namespace App\Http\Controllers\Api;

use App\Models\TermsAcceptance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class TermsController extends Controller
{
    private const CURRENT_VERSION = '1.0-draft';

    /**
     * POST /api/v1/terms/accept
     */
    public function accept(Request $request): JsonResponse
    {
        $request->validate([
            'device_id'     => 'required|string|max:64',
            'terms_version' => 'required|string|max:32',
            'platform'      => 'required|in:web,android',
        ]);

        TermsAcceptance::create([
            'device_id'     => $request->input('device_id'),
            'terms_version' => $request->input('terms_version'),
            'platform'      => $request->input('platform'),
            'ip_address'    => null, // deliberately not logged for privacy
        ]);

        return response()->json([
            'status'          => 'accepted',
            'terms_version'   => $request->input('terms_version'),
            'current_version' => self::CURRENT_VERSION,
        ], 201);
    }

    /**
     * GET /api/v1/app-version
     */
    public function appVersion(): JsonResponse
    {
        return response()->json([
            'version'         => config('app.version', '0.1.0'),
            'terms_version'   => self::CURRENT_VERSION,
            'min_app_version' => '0.1.0',
        ]);
    }
}
