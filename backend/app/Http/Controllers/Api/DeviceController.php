<?php

namespace App\Http\Controllers\Api;

use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

use Illuminate\Support\Facades\Crypt;

class DeviceController extends Controller
{
    /**
     * POST /api/v1/devices/handshake
     * Performs handshake with TV/App to generate or retrieve the pairing key.
     */
    public function handshake(Request $request): JsonResponse
    {
        $request->validate([
            'mac' => 'required|string|max:50',
            'name' => 'nullable|string|max:100',
        ]);

        $mac = strtoupper(trim($request->input('mac')));

        // Find or create device
        $device = Device::where('mac', $mac)->first();

        if (!$device) {
            $device = Device::create([
                'mac' => $mac,
                'device_key' => Device::generateUniqueKey(),
                'key_expires_at' => now()->addYears(100),
                'name' => $request->input('name', 'Smart TV'),
            ]);
        } else {
            // Keep device key permanent for each device
            if (!$device->device_key) {
                $device->refreshKey();
            } else if ($device->key_expires_at && $device->key_expires_at->isPast()) {
                // Upgrade legacy 24h expired keys to permanent without changing the key
                $device->update(['key_expires_at' => now()->addYears(100)]);
            }
            
            // Optionally update name if provided
            if ($request->has('name')) {
                $device->update(['name' => $request->input('name')]);
            }
        }

        return response()->json([
            'mac' => $device->mac,
            'device_key' => $device->device_key,
            'key_expires_at' => $device->key_expires_at->toIso8601String(),
            'playlists_count' => $device->playlists()->count(),
            'device_token' => Crypt::encryptString($device->id . '|' . $device->mac),
        ]);
    }

    /**
     * GET /api/v1/devices/{mac}/config
     * Called by TV/App to download the active playlists.
     */
    public function config(string $mac): JsonResponse
    {
        $mac = strtoupper(trim($mac));
        $device = Device::where('mac', $mac)->first();

        if (!$device) {
            return response()->json(['error' => 'Device not found'], 404);
        }

        $playlists = $device->playlists()
            ->where('is_active', true)
            ->get(['id', 'name', 'type', 'url', 'username', 'password', 'is_main'])
            ->makeVisible('password');

        return response()->json([
            'mac' => $device->mac,
            'name' => $device->name,
            'playlists' => $playlists,
        ]);
    }
}
