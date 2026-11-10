<?php

namespace App\Http\Controllers\Api;

use App\Models\Device;
use App\Services\DevicePlaylistService;
use App\Services\DeviceRegistrationService;
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
    public function handshake(Request $request, DeviceRegistrationService $registrations): JsonResponse
    {
        $request->validate([
            'mac' => 'required|string|max:50',
            'name' => 'nullable|string|max:100',
            'device_model' => 'nullable|string|max:100',
            'app_version' => 'nullable|string|max:50',
            'registration_key' => 'nullable|string|size:6',
        ]);

        $mac = strtoupper(trim($request->input('mac')));

        // Only portal confirmation creates a device; handshake prepares a pending key.
        $device = Device::where('mac', $mac)->first();

        $resetRequired = !$device && Device::wasRemoved($mac);
        if ($token = $request->bearerToken()) {
            try {
                $identity = explode('|', Crypt::decryptString($token));
                if (count($identity) !== 2 || strtoupper(trim($identity[1])) !== $mac) {
                    return response()->json(['error' => 'Token inválido.'], 401);
                }
                // A different registration ID means the old local content must be reset.
                $resetRequired = $resetRequired || !$device || (string) $device->id !== $identity[0];
            } catch (\Exception $e) {
                return response()->json(['error' => 'Token inválido.'], 401);
            }
        }

        if (!$device) {
            $pending = $registrations->prepare($mac, [
                'name' => $request->input('name'),
                'device_model' => $request->input('device_model'),
                'app_version' => $request->input('app_version'),
                'ip_address' => $request->ip(),
            ]);
            $samePendingKey = strtoupper((string) $request->input('registration_key')) === $pending->device_key;

            return response()->json([
                'registration_pending' => true,
                'reset_required' => $resetRequired && !$samePendingKey,
                'mac' => $mac,
                'device_key' => $pending->device_key,
                'key_expires_at' => $pending->expires_at->toIso8601String(),
                'playlists_count' => 0,
                'device_token' => null,
            ]);
        } else {
            // Keep the key stable within this registration
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
            'registration_pending' => false,
            'reset_required' => $resetRequired,
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
    public function setMainPlaylist(Request $request, string $mac, int $id, DevicePlaylistService $playlists): JsonResponse
    {
        $playlists->setMain($request->attributes->get('device'), $id);

        return response()->json(['status' => 'ok', 'main_playlist_id' => $id]);
    }
}
