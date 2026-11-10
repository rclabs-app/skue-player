<?php

namespace App\Services;

use App\Models\Device;
use App\Models\PendingDeviceRegistration;
use Illuminate\Support\Facades\DB;

class DeviceRegistrationService
{
    public function prepare(string $mac, array $attributes): PendingDeviceRegistration
    {
        return DB::transaction(function () use ($mac, $attributes) {
            $pending = PendingDeviceRegistration::where('mac', $mac)->lockForUpdate()->first();
            if (!$pending || $pending->expires_at->isPast()) {
                do {
                    $key = Device::generateUniqueKey();
                } while (PendingDeviceRegistration::where('device_key', $key)->exists());
                if (!$pending) $pending = new PendingDeviceRegistration(['mac' => $mac]);
                $pending->device_key = $key;
            }
            $pending->fill($attributes);
            $pending->expires_at = now()->addDay();
            $pending->save();

            return $pending;
        });
    }

    /** Only a valid MAC/key submitted to the customer portal confirms registration. */
    public function confirm(string $mac, string $key): ?Device
    {
        return DB::transaction(function () use ($mac, $key) {
            $existing = Device::where('mac', $mac)->lockForUpdate()->first();
            if ($existing) return $existing;

            $pending = PendingDeviceRegistration::where('mac', $mac)->lockForUpdate()->first();
            if (!$pending || $pending->expires_at->isPast() || !hash_equals($pending->device_key, $key)) {
                return null;
            }
            $device = Device::create([
                'mac' => $mac,
                'device_key' => $pending->device_key,
                'key_expires_at' => now()->addYears(100),
                'name' => $pending->name ?? 'Smart TV',
                'device_model' => $pending->device_model,
                'app_version' => $pending->app_version,
                'ip_address' => $pending->ip_address,
                'last_seen_at' => now(),
                'status' => 'trial',
                'trial_ends_at' => now()->addDays(7),
            ]);
            $pending->delete();
            DB::table('removed_devices')->where('identifier_hash', hash('sha256', $mac))->delete();

            return $device;
        });
    }
}
