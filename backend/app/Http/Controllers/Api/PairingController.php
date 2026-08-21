<?php

namespace App\Http\Controllers\Api;

use App\Models\PairingCode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;

class PairingController extends Controller
{
    private const MAX_ATTEMPTS = 5;
    private const EXPIRY_MINUTES = 10;
    // Characters that are easy to read/type — no O, 0, I, 1
    private const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    /**
     * POST /api/v1/pairing-codes
     * TV calls this to generate a new pairing code.
     */
    public function create(): JsonResponse
    {
        // Clean up expired codes before creating a new one
        PairingCode::where('expires_at', '<', now())->delete();

        $code = $this->generateCode();

        PairingCode::create([
            'code'       => $code,
            'payload'    => null,
            'attempts'   => 0,
            'consumed'   => false,
            'expires_at' => now()->addMinutes(self::EXPIRY_MINUTES),
        ]);

        return response()->json([
            'code'       => $code,
            'expires_in' => self::EXPIRY_MINUTES * 60, // seconds
        ], 201);
    }

    /**
     * GET /api/v1/pairing-codes/{code}
     * TV polls this to know when a payload is ready.
     */
    public function show(string $code): JsonResponse
    {
        $pairing = PairingCode::find(strtoupper($code));

        if (! $pairing || ! $pairing->isAvailable()) {
            return response()->json(['error' => 'Code not found or expired'], 404);
        }

        return response()->json([
            'code'        => $pairing->code,
            'has_payload' => $pairing->payload !== null,
            'expires_at'  => $pairing->expires_at->toIso8601String(),
        ]);
    }

    /**
     * POST /api/v1/pairing-codes/{code}/payload
     * Browser sends the encrypted config payload.
     */
    public function storePayload(Request $request, string $code): JsonResponse
    {
        $request->validate([
            'payload' => 'required|string|max:65535',
        ]);

        $pairing = PairingCode::find(strtoupper($code));

        if (! $pairing) {
            return response()->json(['error' => 'Code not found'], 404);
        }

        if (! $pairing->isAvailable()) {
            return response()->json(['error' => 'Code expired or already used'], 410);
        }

        if ($pairing->payload !== null) {
            return response()->json(['error' => 'Payload already set'], 409);
        }

        $pairing->update(['payload' => $request->input('payload')]);

        return response()->json(['status' => 'payload_stored']);
    }

    /**
     * POST /api/v1/pairing-codes/{code}/consume
     * TV calls this to retrieve and destroy the payload (single use).
     */
    public function consume(Request $request, string $code): JsonResponse
    {
        $pairing = PairingCode::find(strtoupper($code));

        if (! $pairing) {
            return response()->json(['error' => 'Code not found'], 404);
        }

        // Count and limit attempts before revealing anything
        if ($pairing->attempts >= self::MAX_ATTEMPTS) {
            $pairing->delete();

            return response()->json(['error' => 'Too many attempts'], 429);
        }

        $pairing->increment('attempts');

        if (! $pairing->isAvailable()) {
            return response()->json(['error' => 'Code expired or already used'], 410);
        }

        if ($pairing->payload === null) {
            return response()->json(['error' => 'No payload yet', 'has_payload' => false], 202);
        }

        $payload = $pairing->payload;

        // Destroy immediately after reading — single use
        $pairing->delete();

        return response()->json([
            'payload' => $payload,
        ]);
    }

    private function generateCode(): string
    {
        $charset = self::CHARSET;
        $length  = strlen($charset);

        do {
            $code = '';
            for ($i = 0; $i < 6; $i++) {
                $code .= $charset[random_int(0, $length - 1)];
            }
        } while (PairingCode::where('code', $code)->exists());

        return $code;
    }
}
