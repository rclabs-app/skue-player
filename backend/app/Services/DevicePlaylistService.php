<?php

namespace App\Services;

use App\Models\Device;
use App\Models\DevicePlaylist;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class DevicePlaylistService
{
    public function save(Device $device, array $input, ?int $id = null): DevicePlaylist
    {
        return DB::transaction(function () use ($device, $input, $id) {
            // Serialize changes to the main playlist for this device.
            Device::whereKey($device->id)->lockForUpdate()->firstOrFail();
            $playlist = $id === null ? null : $device->playlists()->findOrFail($id);
            $keepPassword = $playlist?->type === 'xtream' && filled($playlist->password);
            $rules = [
                'name' => 'required|string|max:100',
                'type' => 'required|in:m3u,xtream',
                'url' => 'required|url:http,https|max:2048',
                'is_active' => 'sometimes|boolean',
            ];
            if (($input['type'] ?? null) === 'xtream') {
                $rules['username'] = 'required|string|max:255';
                $rules['password'] = ($keepPassword ? 'nullable' : 'required').'|string|max:255';
            }
            $data = Validator::make($input, $rules, [
                'url.url' => 'Informe um endereço HTTP ou HTTPS válido.',
                'password.required' => 'Informe a senha da conta Xtream.',
            ])->validate();
            $data['is_active'] = $data['is_active'] ?? $playlist?->is_active ?? true;
            $data['username'] = $data['type'] === 'xtream' ? $data['username'] : null;
            $data['password'] = $data['type'] === 'xtream'
                ? ($data['password'] ?? $playlist?->password)
                : null;

            if ($playlist) {
                $playlist->update($data);
            } else {
                $playlist = $device->playlists()->create($data);
            }
            $this->normalizeMain($device);

            return $playlist->refresh();
        });
    }

    public function setMain(Device $device, int $id): void
    {
        DB::transaction(function () use ($device, $id) {
            Device::whereKey($device->id)->lockForUpdate()->firstOrFail();
            $playlist = $device->playlists()->findOrFail($id);
            if (!$playlist->is_active) {
                throw ValidationException::withMessages([
                    'is_active' => 'Ative a lista antes de defini-la como principal.',
                ]);
            }
            $device->playlists()->update(['is_main' => false]);
            $device->playlists()->whereKey($playlist->id)->update(['is_main' => true]);
        });
    }

    public function delete(Device $device, int $id): void
    {
        DB::transaction(function () use ($device, $id) {
            Device::whereKey($device->id)->lockForUpdate()->firstOrFail();
            $device->playlists()->findOrFail($id)->delete();
            $this->normalizeMain($device);
        });
    }

    private function normalizeMain(Device $device): void
    {
        $active = $device->playlists()->where('is_active', true);
        $main = (clone $active)->where('is_main', true)->orderBy('id')->first()
            ?? $active->orderBy('id')->first();
        $device->playlists()->update(['is_main' => false]);
        if ($main) {
            $device->playlists()->whereKey($main->id)->update(['is_main' => true]);
        }
    }
}
