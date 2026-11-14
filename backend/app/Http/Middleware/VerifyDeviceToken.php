<?php

namespace App\Http\Middleware;

use App\Models\Device;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Symfony\Component\HttpFoundation\Response;

class VerifyDeviceToken
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $authHeader = $request->header('Authorization');
        if (! $authHeader || ! str_starts_with($authHeader, 'Bearer ')) {
            // Also accept a custom header X-Device-Token
            $token = $request->header('X-Device-Token');
        } else {
            $token = substr($authHeader, 7);
        }

        if (! $token) {
            return response()->json(['error' => 'Token de dispositivo ausente.'], 401);
        }

        try {
            $decrypted = Crypt::decryptString($token);
            $parts = explode('|', $decrypted);

            if (count($parts) < 2) {
                return response()->json(['error' => 'Token inválido.'], 401);
            }

            [$deviceId, $mac] = $parts;

            // Optional: check if mac parameter in route matches the token's mac
            $routeMac = $request->route('mac');
            if ($routeMac && strtoupper(trim($routeMac)) !== strtoupper(trim($mac))) {
                return response()->json(['error' => 'Acesso negado para este dispositivo.'], 403);
            }

            // Find the device to verify it still exists in the database
            $device = Device::find($deviceId);
            if (! $device) {
                return response()->json([
                    'code' => 'DEVICE_REMOVED',
                    'error' => 'Este dispositivo foi removido pelo administrador.',
                ], 410);
            }
            if (strtoupper(trim($device->mac)) !== strtoupper(trim($mac))) {
                return response()->json(['error' => 'Dispositivo não autorizado.'], 401);
            }

            // Put device in request attributes so controllers can use it
            $request->attributes->set('device', $device);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Falha na autenticação do dispositivo.'], 401);
        }

        return $next($request);
    }
}
