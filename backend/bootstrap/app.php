<?php

use App\Exceptions\PlaylistProtectionException;
use App\Http\Middleware\PrivateConfigurationResponse;
use App\Http\Middleware\VerifyDeviceToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(PrivateConfigurationResponse::class);
        $middleware->trustProxies(at: '*');
        $middleware->alias([
            'device.auth' => VerifyDeviceToken::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontFlash(['url', 'host', 'username', 'password', 'device_key', 'token', 'payload']);
        $exceptions->dontReport([PlaylistProtectionException::class]);
        $exceptions->render(function (PlaylistProtectionException $error, Request $request) {
            $headers = ['Cache-Control' => 'no-store, private', 'Pragma' => 'no-cache'];

            return $request->is('api/*')
                ? response()->json(['error' => $error->getMessage()], 503, $headers)
                : response($error->getMessage(), 503, $headers);
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
