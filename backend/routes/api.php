<?php

use App\Http\Controllers\Api\HealthController;
use App\Http\Controllers\Api\PairingController;
use App\Http\Controllers\Api\TermsController;
use App\Http\Controllers\Api\DeviceController;
use App\Http\Controllers\Api\PortalController;
use App\Http\Controllers\Api\TMDBController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Health check — no auth, no rate limit
    Route::get('/health', HealthController::class);

    // TMDB metadata proxy
    Route::get('/tmdb/metadata', [TMDBController::class, 'getMetadata']);

    // App version / terms version
    Route::get('/app-version', [TermsController::class, 'appVersion']);

    // Terms acceptance
    Route::post('/terms/accept', [TermsController::class, 'accept'])
        ->middleware('throttle:30,1');

    // Device Activation (MAC Address & Chave de pareamento)
    Route::prefix('devices')->middleware('throttle:120,1')->group(function () {
        Route::post('/handshake',      [DeviceController::class, 'handshake']);
        Route::get('/{mac}/config',    [DeviceController::class, 'config'])->middleware('device.auth');
    });

    // Portal de Gerenciamento Remoto de Playlists
    Route::prefix('portal')->middleware('throttle:120,1')->group(function () {
        Route::post('/authenticate',   [PortalController::class, 'authenticate']);
        Route::get('/playlists',       [PortalController::class, 'index']);
        Route::post('/playlists',      [PortalController::class, 'store']);
        Route::put('/playlists/{id}',  [PortalController::class, 'update']);
        Route::delete('/playlists/{id}', [PortalController::class, 'destroy']);
    });

    // Pairing — rate limiting
    Route::prefix('pairing-codes')->middleware('throttle:60,1')->group(function () {
        Route::post('/',                    [PairingController::class, 'create']);
        Route::get('/{code}',               [PairingController::class, 'show']);
        Route::post('/{code}/payload',      [PairingController::class, 'storePayload']);
        Route::post('/{code}/consume',      [PairingController::class, 'consume']);
    });

    Route::post('/proxy', function (\Illuminate\Http\Request $request) {
        $url = $request->input('url');
        if (!$url) return response()->json(['error' => 'URL required'], 400);

        // SSRF Protection: validate URL scheme and block internal IPs
        $parsed = parse_url($url);
        if (!$parsed || !isset($parsed['scheme']) || !in_array($parsed['scheme'], ['http', 'https'])) {
            return response()->json(['error' => 'Only http/https URLs are allowed'], 400);
        }

        $host = $parsed['host'] ?? '';
        $ip = gethostbyname($host);

        // Block private/reserved IP ranges
        if ($ip && !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return response()->json(['error' => 'Access to internal networks is not allowed'], 403);
        }
        
        try {
            $response = \Illuminate\Support\Facades\Http::timeout(120)
                ->withHeaders([
                    'User-Agent' => 'VLC/3.0.0 LibVLC/3.0.0',
                    'Accept' => '*/*'
                ])
                ->get($url);
            $body = $response->body();
            
            // Check magic bytes for gzip: 1f 8b
            if (strlen($body) >= 2 && ord($body[0]) === 0x1f && ord($body[1]) === 0x8b) {
                if (function_exists('gzdecode')) {
                    $decompressed = @gzdecode($body);
                    if ($decompressed !== false) {
                        $body = $decompressed;
                    }
                }
            }
            
            return response($body, $response->status())
                ->header('Content-Type', 'text/plain; charset=utf-8');
        } catch (\Exception $e) {
            return response()->json(['error' => 'Proxy fetch failed: ' . $e->getMessage()], 500);
        }
    })->middleware(['throttle:300,1', 'device.auth']);

});

