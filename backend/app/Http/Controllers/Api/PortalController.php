<?php

namespace App\Http\Controllers\Api;

use App\Models\Device;
use App\Models\DevicePlaylist;
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

    /**
     * POST /api/v1/portal/playlists
     * Add a new playlist to the device.
     */
    public function store(Request $request): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) {
            return response()->json(['error' => 'Não autorizado.'], 401);
        }

        $rules = [
            'name' => 'required|string|max:100',
            'type' => 'required|in:m3u,xtream',
            'url' => 'required|string|max:2048',
            'is_active' => 'boolean',
        ];

        if ($request->input('type') === 'xtream') {
            $rules['username'] = 'required|string|max:255';
            $rules['password'] = 'required|string|max:255';
        }

        $request->validate($rules);

        $playlist = $device->playlists()->create([
            'name' => $request->input('name'),
            'type' => $request->input('type'),
            'url' => $request->input('url'),
            'username' => $request->input('type') === 'xtream' ? $request->input('username') : null,
            'password' => $request->input('type') === 'xtream' ? $request->input('password') : null,
            'is_active' => $request->input('is_active', true),
        ]);

        return response()->json($playlist, 201);
    }

    /**
     * PUT /api/v1/portal/playlists/{id}
     * Update an existing playlist.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) {
            return response()->json(['error' => 'Não autorizado.'], 401);
        }

        $playlist = $device->playlists()->find($id);
        if (!$playlist) {
            return response()->json(['error' => 'Playlist não encontrada.'], 404);
        }

        $rules = [
            'name' => 'required|string|max:100',
            'type' => 'required|in:m3u,xtream',
            'url' => 'required|string|max:2048',
            'is_active' => 'boolean',
        ];

        if ($request->input('type') === 'xtream') {
            $rules['username'] = 'required|string|max:255';
            $rules['password'] = 'required|string|max:255';
        }

        $request->validate($rules);

        $playlist->update([
            'name' => $request->input('name'),
            'type' => $request->input('type'),
            'url' => $request->input('url'),
            'username' => $request->input('type') === 'xtream' ? $request->input('username') : null,
            'password' => $request->input('type') === 'xtream' ? $request->input('password') : null,
            'is_active' => $request->input('is_active', true),
        ]);

        return response()->json($playlist);
    }

    /**
     * DELETE /api/v1/portal/playlists/{id}
     * Delete a playlist.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $device = $this->resolveDevice($request);
        if (!$device) {
            return response()->json(['error' => 'Não autorizado.'], 401);
        }

        $playlist = $device->playlists()->find($id);
        if (!$playlist) {
            return response()->json(['error' => 'Playlist não encontrada.'], 404);
        }

        $playlist->delete();

        return response()->json(['status' => 'deleted']);
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
