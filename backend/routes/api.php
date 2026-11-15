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
        Route::patch('/{mac}/playlists/{id}/set-main', [DeviceController::class, 'setMainPlaylist'])->middleware('device.auth');
        Route::get('/{mac}/config',    [DeviceController::class, 'config'])->middleware('device.auth');
        Route::get('/{mac}/playlists/{id}/xtream/series/{seriesId}', \App\Http\Controllers\Api\XtreamSeriesController::class)
            ->whereNumber('id')->whereNumber('seriesId')->middleware('device.auth');
        Route::post('/{mac}/playlists/{id}/movie-ticket', \App\Http\Controllers\Api\MoviePlaybackController::class)
            ->whereNumber('id')->middleware(['device.auth', 'throttle:30,1']);
    });

    // Portal de Gerenciamento Remoto de Playlists
    Route::prefix('portal')->middleware('throttle:120,1')->group(function () {
        Route::post('/authenticate',   [PortalController::class, 'authenticate']);
        Route::get('/playlists',       [PortalController::class, 'index']);
        Route::post('/playlists',      [PortalController::class, 'store']);
        Route::put('/playlists/{id}',  [PortalController::class, 'update']);
        Route::patch('/playlists/{id}/set-main', [PortalController::class, 'setMain']);
        Route::delete('/playlists/{id}', [PortalController::class, 'destroy']);
    });

    // Pairing — rate limiting
    Route::prefix('pairing-codes')->middleware('throttle:60,1')->group(function () {
        Route::post('/',                    [PairingController::class, 'create']);
        Route::get('/{code}',               [PairingController::class, 'show']);
        Route::post('/{code}/payload',      [PairingController::class, 'storePayload']);
        Route::post('/{code}/consume',      [PairingController::class, 'consume']);
    });

    // Pagamentos e Webhooks (Stripe Checkout)
    Route::prefix('payments')->middleware('throttle:30,1')->group(function () {
        Route::post('/checkout-session',    [\App\Http\Controllers\Api\PaymentController::class, 'createCheckoutSession']);
    });
    Route::post('/webhooks/stripe',         [\App\Http\Controllers\Api\PaymentController::class, 'handleWebhook']);

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
            if ($response->status() === 451) {
                // Only fixed categories enter logs; upstream headers/body may
                // contain credentials or private playlist addresses.
                $diagnosticId = (string) \Illuminate\Support\Str::uuid();
                $server = strtolower(trim($response->header('Server') ?? ''));
                $serverFamily = match (true) {
                    str_contains($server, 'cloudflare') => 'cloudflare',
                    str_contains($server, 'vercel') => 'vercel',
                    str_contains($server, 'nginx') => 'nginx',
                    str_contains($server, 'apache') => 'apache',
                    $server === '' => 'absent',
                    default => 'other',
                };
                \Illuminate\Support\Facades\Log::warning('Playlist import received HTTP 451', [
                    'diagnostic_id' => $diagnosticId,
                    'upstream_status' => 451,
                    'requested_scheme' => $parsed['scheme'],
                    'server_family' => $serverFamily,
                    'has_cloudflare_ray' => $response->header('CF-Ray') !== null,
                    'has_blocked_by_link' => (bool) preg_match('/rel\s*=\s*["\']?blocked-by/i', $response->header('Link') ?? ''),
                    'has_via_header' => $response->header('Via') !== null,
                ]);
                return response()->json([
                    'code' => 'PLAYLIST_SOURCE_RESTRICTED',
                    'error' => 'A origem recusou o acesso à lista (HTTP 451). Verifique a disponibilidade e as condições de acesso com o responsável pela fonte.',
                    'diagnostic_id' => $diagnosticId,
                ], 451);
            }
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
            return response()->json(['error' => 'Não foi possível buscar a lista na origem.'], 502);
        }
    })->middleware(['throttle:300,1', 'device.auth']);

});

