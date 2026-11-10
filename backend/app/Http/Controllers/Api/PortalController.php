<?php

namespace App\Http\Controllers\Api;

use App\Models\Device;
use App\Services\DevicePlaylistService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Crypt;

class PortalController extends Controller
{
    /**
     * POST /api/v1/portal/authenticate
     * Authenticate portal session using MAC Address & Activation Key.
     */
    public function authenticate(Request $request): JsonResponse
    {
        $request->validate([
            'mac' => 'required|string|max:50',
            'device_key' => 'required|string|size:6',
        ]);

        $mac = strtoupper(trim($request->input('mac')));
        $deviceKey = strtoupper(trim($request->input('device_key')));

        $device = Device::where('mac', $mac)->first();

        if (!$device) {
            return response()->json(['error' => 'Dispositivo não encontrado.'], 401);
        }

        if ($device->device_key !== $deviceKey) {
            return response()->json(['error' => 'Chave de ativação inválida.'], 401);
        }

        if ($device->isKeyExpired()) {
            return response()->json(['error' => 'Chave de ativação expirou. Gere uma nova chave no seu app.'], 401);
        }

        // Generate encrypted token containing the device ID
        $token = Crypt::encryptString($device->id);

        return response()->json([
            'token' => $token,
            'device' => [
                'mac' => $device->mac,
                'name' => $device->name,
            ]
        ]);
    }

    /**
     * GET /api/v1/portal/playlists
     * List all playlists associated with the device.
     */
    public function index(Request $request): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) {
            return response()->json(['error' => 'Não autorizado.'], 401);
        }

        $playlists = $device->playlists()->orderBy('created_at', 'desc')->get();

        return response()->json($playlists);
    }

    public function store(Request $request, DevicePlaylistService $playlists): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) return response()->json(['error' => 'Não autorizado.'], 401);

        return response()->json($playlists->save($device, $request->all()), 201);
    }

    public function update(Request $request, int $id, DevicePlaylistService $playlists): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) return response()->json(['error' => 'Não autorizado.'], 401);

        return response()->json($playlists->save($device, $request->all(), $id));
    }

    public function destroy(Request $request, int $id, DevicePlaylistService $playlists): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) return response()->json(['error' => 'Não autorizado.'], 401);
        $playlists->delete($device, $id);

        return response()->json(['status' => 'deleted']);
    }

    public function setMain(Request $request, int $id, DevicePlaylistService $playlists): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) return response()->json(['error' => 'Não autorizado.'], 401);
        $playlists->setMain($device, $id);

        return response()->json(['status' => 'ok', 'main_playlist_id' => $id]);
    }

    /**
     * Helper to decrypt Authorization Bearer token and retrieve the Device.
     */
    private function resolveDevice(Request $request): ?Device
    {
        $authHeader = $request->header('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            return null;
        }

        $token = substr($authHeader, 7);

        try {
            $deviceId = Crypt::decryptString($token);
            return Device::find($deviceId);
        } catch (\Exception $e) {
            return null;
        }
    }
}
