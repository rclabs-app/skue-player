<?php

namespace App\Http\Controllers\Api;

use App\Models\Device;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
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
            'device_model' => 'nullable|string|max:100',
            'app_version' => 'nullable|string|max:50',
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
                'status' => 'trial',
                'trial_ends_at' => Carbon::now()->addDays(7),
                'device_model' => $request->input('device_model'),
                'app_version' => $request->input('app_version'),
                'ip_address' => $request->ip(),
                'last_seen_at' => Carbon::now(),
            ]);
        } else {
            // Keep device key permanent for each device
            if (!$device->device_key) {
                $device->refreshKey();
            } else if ($device->key_expires_at && $device->key_expires_at->isPast()) {
                // Upgrade legacy 24h expired keys to permanent without changing the key
                $device->update(['key_expires_at' => now()->addYears(100)]);
            }
            
            $updates = [
                'ip_address' => $request->ip(),
                'last_seen_at' => Carbon::now(),
            ];

            if ($request->has('name')) {
                $updates['name'] = $request->input('name');
            }
            if ($request->has('device_model')) {
                $updates['device_model'] = $request->input('device_model');
            }
            if ($request->has('app_version')) {
                $updates['app_version'] = $request->input('app_version');
            }

            // Check if trial has expired and status is still trial
            if ($device->status === 'trial' && $device->trial_ends_at && $device->trial_ends_at->isPast()) {
                if (!$device->activeSubscription()->exists()) {
                    $updates['status'] = 'expired';
                }
            }

            $device->update($updates);
        }

        return response()->json([
            'mac' => $device->mac,
            'device_key' => $device->device_key,
            'key_expires_at' => $device->key_expires_at->toIso8601String(),
            'playlists_count' => $device->playlists()->count(),
            'license' => [
                'status' => $device->status,
                'is_licensed' => $device->isLicensed(),
                'days_remaining' => $device->daysRemaining(),
                'trial_ends_at' => $device->trial_ends_at?->toIso8601String(),
            ],
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

        // Update last seen
        $device->update([
            'last_seen_at' => Carbon::now(),
        ]);

        $playlists = $device->playlists()
            ->where('is_active', true)
            ->get(['id', 'name', 'type', 'url', 'username', 'password', 'is_main'])
            ->makeVisible('password');

        return response()->json([
            'mac' => $device->mac,
            'name' => $device->name,
            'license' => [
                'status' => $device->status,
                'is_licensed' => $device->isLicensed(),
                'days_remaining' => $device->daysRemaining(),
            ],
            'playlists' => $playlists,
        ]);
    }
}
