<?php

namespace Tests\Feature;

use App\Models\Device;
use App\Models\DevicePlaylist;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class DeviceActivationTest extends TestCase
{
    use RefreshDatabase;

    // ── Handshake ────────────────────────────────────────────────────────────

    public function test_handshake_creates_new_device(): void
    {
        $response = $this->postJson('/api/v1/devices/handshake', [
            'mac' => 'AA:BB:CC:DD:EE:FF',
            'name' => 'TV do Quarto',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['mac', 'device_key', 'key_expires_at', 'playlists_count', 'device_token'])
            ->assertJsonPath('mac', 'AA:BB:CC:DD:EE:FF');

        $this->assertDatabaseHas('devices', [
            'mac' => 'AA:BB:CC:DD:EE:FF',
            'name' => 'TV do Quarto',
        ]);
    }

    public function test_handshake_preserves_device_key_and_extends_expiry(): void
    {
        $device = Device::create([
            'mac' => '11:22:33:44:55:66',
            'device_key' => 'OLD123',
            'key_expires_at' => now()->subHour(),
            'name' => 'TV Antiga',
        ]);

        $response = $this->postJson('/api/v1/devices/handshake', [
            'mac' => '11:22:33:44:55:66',
        ]);

        $response->assertStatus(200);
        $key = $response->json('device_key');

        $this->assertEquals('OLD123', $key);
        $this->assertDatabaseHas('devices', [
            'mac' => '11:22:33:44:55:66',
            'device_key' => 'OLD123',
        ]);
    }

    // ── Config / Polling ─────────────────────────────────────────────────────

    public function test_device_can_fetch_its_config(): void
    {
        $device = Device::create([
            'mac' => 'AA:AA:AA:AA:AA:AA',
            'device_key' => 'AAAAAA',
            'key_expires_at' => now()->addHour(),
        ]);

        $device->playlists()->create([
            'name' => 'Lista M3U Teste',
            'type' => 'm3u',
            'url' => 'https://example.com/lista.m3u',
            'is_active' => true,
        ]);

        // Inactive one
        $device->playlists()->create([
            'name' => 'Lista Inativa',
            'type' => 'm3u',
            'url' => 'https://example.com/inativa.m3u',
            'is_active' => false,
        ]);

        $token = Crypt::encryptString($device->id . '|' . $device->mac);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/devices/AA:AA:AA:AA:AA:AA/config');

        $response->assertStatus(200)
            ->assertJsonPath('mac', 'AA:AA:AA:AA:AA:AA')
            ->assertJsonCount(1, 'playlists')
            ->assertJsonPath('playlists.0.name', 'Lista M3U Teste');
    }

    public function test_device_cannot_fetch_config_without_token(): void
    {
        Device::create([
            'mac' => 'AA:AA:AA:AA:AA:AA',
            'device_key' => 'AAAAAA',
            'key_expires_at' => now()->addHour(),
        ]);

        $this->getJson('/api/v1/devices/AA:AA:AA:AA:AA:AA/config')
            ->assertStatus(401);
    }

    // ── Portal Authentication ────────────────────────────────────────────────

    public function test_portal_can_authenticate_with_valid_key(): void
    {
        $device = Device::create([
            'mac' => 'BB:BB:BB:BB:BB:BB',
            'device_key' => 'KEY123',
            'key_expires_at' => now()->addHour(),
        ]);

        $response = $this->postJson('/api/v1/portal/authenticate', [
            'mac' => 'BB:BB:BB:BB:BB:BB',
            'device_key' => 'KEY123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['token', 'device']);

        $token = $response->json('token');
        $this->assertEquals($device->id, Crypt::decryptString($token));
    }

    public function test_portal_fails_to_authenticate_with_invalid_or_expired_key(): void
    {
        // Invalid key
        Device::create([
            'mac' => 'CC:CC:CC:CC:CC:CC',
            'device_key' => 'VALID1',
            'key_expires_at' => now()->addHour(),
        ]);

        $this->postJson('/api/v1/portal/authenticate', [
            'mac' => 'CC:CC:CC:CC:CC:CC',
            'device_key' => 'WRONG1',
        ])->assertStatus(401);

        // Expired key
        Device::create([
            'mac' => 'DD:DD:DD:DD:DD:DD',
            'device_key' => 'EXPIR1',
            'key_expires_at' => now()->subMinute(),
        ]);

        $this->postJson('/api/v1/portal/authenticate', [
            'mac' => 'DD:DD:DD:DD:DD:DD',
            'device_key' => 'EXPIR1',
        ])->assertStatus(401);
    }

    // ── Portal CRUD ──────────────────────────────────────────────────────────

    public function test_portal_can_create_playlist(): void
    {
        $device = Device::create([
            'mac' => 'EE:EE:EE:EE:EE:EE',
            'device_key' => 'KEYEEE',
            'key_expires_at' => now()->addHour(),
        ]);

        $token = Crypt::encryptString($device->id);

        // M3U Playlist
        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/portal/playlists', [
                'name' => 'Minha Lista M3U',
                'type' => 'm3u',
                'url' => 'http://example.com/playlist.m3u',
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('name', 'Minha Lista M3U')
            ->assertJsonPath('type', 'm3u');

        $this->assertDatabaseHas('device_playlists', [
            'device_id' => $device->id,
            'name' => 'Minha Lista M3U',
        ]);
    }

    public function test_portal_can_update_playlist(): void
    {
        $device = Device::create([
            'mac' => 'FF:FF:FF:FF:FF:FF',
            'device_key' => 'KEYFFF',
            'key_expires_at' => now()->addHour(),
        ]);

        $playlist = $device->playlists()->create([
            'name' => 'Old Name',
            'type' => 'm3u',
            'url' => 'http://old.com',
        ]);

        $token = Crypt::encryptString($device->id);

        $response = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/v1/portal/playlists/' . $playlist->id, [
                'name' => 'New Name',
                'type' => 'xtream',
                'url' => 'http://new.com',
                'username' => 'user1',
                'password' => 'pass1',
            ]);

        $response->assertStatus(200)
            ->assertJsonPath('name', 'New Name')
            ->assertJsonPath('type', 'xtream')
            ->assertJsonPath('username', 'user1');

        $this->assertDatabaseHas('device_playlists', [
            'id' => $playlist->id,
            'name' => 'New Name',
            'username' => 'user1',
        ]);
    }

    public function test_portal_can_delete_playlist(): void
    {
        $device = Device::create([
            'mac' => 'GG:GG:GG:GG:GG:GG',
            'device_key' => 'KEYGGG',
            'key_expires_at' => now()->addHour(),
        ]);

        $playlist = $device->playlists()->create([
            'name' => 'Lista para deletar',
            'type' => 'm3u',
            'url' => 'http://delete.com',
        ]);

        $token = Crypt::encryptString($device->id);

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->deleteJson('/api/v1/portal/playlists/' . $playlist->id)
            ->assertStatus(200);

        $this->assertDatabaseMissing('device_playlists', [
            'id' => $playlist->id,
        ]);
    }
}
