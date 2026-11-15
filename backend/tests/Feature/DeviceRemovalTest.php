<?php

namespace Tests\Feature;

use App\Filament\Resources\DeviceResource\Pages\ListDevices;
use App\Filament\Resources\DeviceResource\Pages\EditDevice;
use App\Models\Device;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Livewire\Livewire;
use Tests\TestCase;

class DeviceRemovalTest extends TestCase
{
    use RefreshDatabase;

    private function device(string $mac = 'SK:AA:BB:CC:DD:EE'): Device
    {
        return Device::create(['mac' => $mac, 'device_key' => 'ABC234', 'key_expires_at' => now()->addYear()]);
    }

    public function test_deletion_starts_a_clean_registration_with_a_new_stable_key(): void
    {
        $device = $this->device();
        $device->playlists()->create(['name' => 'Test', 'type' => 'm3u', 'url' => 'https://example.com/list']);
        $oldKey = $device->device_key;
        $oldToken = Crypt::encryptString($device->id.'|'.$device->mac);
        $device->delete();
        $this->assertDatabaseCount('devices', 0);
        $this->assertDatabaseCount('device_playlists', 0);
        $this->assertDatabaseHas('removed_devices', ['identifier_hash' => hash('sha256', $device->mac)]);
        $fresh = $this->postJson('/api/v1/devices/handshake', ['mac' => strtolower($device->mac)])
            ->assertOk()->assertJsonPath('reset_required', true)->assertJsonPath('playlists_count', 0);
        $newKey = $fresh->json('device_key');
        $fresh->assertJsonPath('registration_pending', true)->assertJsonPath('device_token', null);
        $this->assertDatabaseCount('devices', 0);
        $this->postJson('/api/v1/devices/handshake', ['mac' => $device->mac, 'registration_key' => $newKey])
            ->assertOk()->assertJsonPath('device_key', $newKey)->assertJsonPath('reset_required', false);
        $this->assertDatabaseCount('devices', 0);
        $this->post('/portal', ['mac' => $device->mac, 'device_key' => $newKey])->assertRedirect('/portal/dashboard');
        $this->assertDatabaseCount('pending_device_registrations', 0);
        $newToken = Crypt::encryptString(Device::first()->id.'|'.$device->mac);
        $this->assertNotSame($oldKey, $newKey);
        $this->assertNotSame($device->id, Device::first()->id);
        $this->assertDatabaseCount('removed_devices', 0);
        // A delayed request from the old installation must clear its cache without rotating again.
        $this->withToken($oldToken)->postJson('/api/v1/devices/handshake', ['mac' => $device->mac])
            ->assertOk()->assertJsonPath('reset_required', true)->assertJsonPath('device_key', $newKey);
        $this->getJson("/api/v1/devices/{$device->mac}/config")
            ->assertStatus(410)->assertJsonPath('code', 'DEVICE_REMOVED');
        $this->withToken($newToken)->postJson('/api/v1/devices/handshake', ['mac' => $device->mac])
            ->assertOk()->assertJsonPath('reset_required', false)->assertJsonPath('device_key', $newKey);
        $this->getJson("/api/v1/devices/{$device->mac}/config")->assertOk()->assertJsonCount(0, 'playlists');
        $this->postJson('/api/v1/portal/authenticate', ['mac' => $device->mac, 'device_key' => $oldKey])->assertUnauthorized();
        $this->postJson('/api/v1/portal/authenticate', ['mac' => $device->mac, 'device_key' => $newKey])->assertOk();
        $this->assertDatabaseCount('devices', 1);
    }

    public function test_filament_list_has_no_individual_or_bulk_delete(): void
    {
        $this->withoutVite();
        $admin = User::factory()->create();
        config(['admin.emails' => [$admin->email]]);
        $this->actingAs($admin);
        $device = $this->device();
        Livewire::test(ListDevices::class)
            ->assertTableActionDoesNotExist('delete')
            ->assertTableBulkActionDoesNotExist('delete');
        $this->assertModelExists($device);
    }

    public function test_filament_delete_requires_exact_mac_and_cancel_preserves_content(): void
    {
        $this->withoutVite();
        $admin = User::factory()->create();
        config(['admin.emails' => [$admin->email]]);
        $this->actingAs($admin);
        $device = $this->device();
        $device->update(['name' => 'TV da sala']);
        $list = $device->playlists()->create(['name' => 'Test', 'type' => 'm3u', 'url' => 'https://example.com/list']);
        $page = Livewire::test(EditDevice::class, ['record' => $device->getRouteKey()]);
        $page->mountAction('delete')
            ->assertSee('TV da sala')
            ->assertSee($device->mac)
            ->assertSee('Listas vinculadas: 1')
            ->assertSee('O app perderá a configuração ao sincronizar')
            ->unmountAction();
        $this->assertModelExists($device);
        $this->assertModelExists($list);
        $page->callAction('delete', data: ['confirmation_mac' => ''])
            ->assertHasActionErrors(['confirmation_mac' => 'required']);
        $page->callAction('delete', data: ['confirmation_mac' => 'SK:00:00:00:00:00'])
            ->assertHasActionErrors(['confirmation_mac' => 'in']);
        $this->assertModelExists($device);
        $this->assertModelExists($list);
        $this->assertFalse(Device::wasRemoved($device->mac));
        $page->callAction('delete', data: ['confirmation_mac' => $device->mac])
            ->assertHasNoActionErrors();
        $this->assertModelMissing($device);
        $this->assertModelMissing($list);
        $this->assertTrue(Device::wasRemoved($device->mac));
    }

    public function test_unrelated_new_installations_only_prepare_registration(): void
    {
        $removed = $this->device();
        $removed->delete();
        $this->postJson('/api/v1/devices/handshake', ['mac' => 'SK:11:22:33:44:55'])
            ->assertOk()->assertJsonPath('registration_pending', true)->assertJsonPath('device_token', null);
        $this->assertDatabaseCount('devices', 0);
    }

    public function test_legacy_removal_also_returns_a_new_key_and_requires_local_reset(): void
    {
        $device = $this->device();
        $token = Crypt::encryptString($device->id.'|'.$device->mac);
        // Simulate deletion by an older version, before model events recorded markers.
        DB::table('devices')->where('id', $device->id)->delete();
        $this->withToken($token)->postJson('/api/v1/devices/handshake', ['mac' => $device->mac])
            ->assertOk()->assertJsonPath('reset_required', true)->assertJsonPath('playlists_count', 0);
        $this->assertDatabaseCount('devices', 0);
    }

    public function test_admin_can_explicitly_register_the_same_identifier_again(): void
    {
        $device = $this->device();
        $device->delete();
        $this->device();
        $this->postJson('/api/v1/devices/handshake', ['mac' => $device->mac])->assertOk();
        $this->assertDatabaseCount('devices', 1);
    }
    public function test_existing_blocked_device_is_not_recreated_or_given_a_new_trial(): void
    {
        $device = $this->device();
        $device->update(['status' => 'blocked']);
        $this->postJson('/api/v1/devices/handshake', ['mac' => $device->mac])
            ->assertOk()->assertJsonPath('reset_required', false)
            ->assertJsonPath('device_key', $device->device_key)
            ->assertJsonPath('license.status', 'blocked')->assertJsonPath('license.is_licensed', false);
        $this->assertDatabaseCount('devices', 1);
    }

    public function test_only_valid_unexpired_portal_confirmation_registers_and_starts_trial(): void
    {
        $mac = 'SK:11:22:33:44:55';
        $key = $this->postJson('/api/v1/devices/handshake', ['mac' => $mac])->assertOk()->json('device_key');
        $this->post('/portal', ['mac' => $mac, 'device_key' => 'WRONG1'])->assertSessionHasErrors();
        $this->postJson('/api/v1/portal/authenticate', ['mac' => $mac, 'device_key' => $key])->assertUnauthorized();
        $this->assertDatabaseCount('devices', 0);
        $this->travel(25)->hours();
        $this->post('/portal', ['mac' => $mac, 'device_key' => $key])->assertSessionHasErrors();
        $this->assertDatabaseCount('devices', 0);
        $newKey = $this->postJson('/api/v1/devices/handshake', ['mac' => $mac])->assertOk()->json('device_key');
        $this->assertNotSame($key, $newKey);
        $this->post('/portal', ['mac' => strtolower($mac), 'device_key' => $newKey])->assertRedirect('/portal/dashboard');
        $this->assertDatabaseCount('devices', 1);
        $this->assertEquals(now()->addDays(7)->timestamp, Device::first()->trial_ends_at->timestamp);
        $this->post('/portal', ['mac' => $mac, 'device_key' => $newKey])->assertRedirect('/portal/dashboard');
        $this->assertDatabaseCount('devices', 1);
        $this->assertDatabaseCount('pending_device_registrations', 0);
    }

}
