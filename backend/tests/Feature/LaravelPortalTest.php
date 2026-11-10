<?php

namespace Tests\Feature;

use App\Models\Device;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class LaravelPortalTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    private function device(string $mac = 'SK:AA:BB:CC:DD:EE'): Device
    {
        return Device::create(['mac' => $mac, 'device_key' => 'ABC234', 'key_expires_at' => now()->addYear()]);
    }

    private function data(array $overrides = []): array
    {
        return array_merge(['name' => 'Teste', 'type' => 'm3u', 'url' => 'https://example.com/list.m3u', 'is_active' => true], $overrides);
    }

    public function test_login_dashboard_edit_and_logout(): void
    {
        $device = $this->device();
        $playlist = $device->playlists()->create($this->data(['is_main' => true]));
        $this->post('/portal', ['mac' => $device->mac, 'device_key' => 'abc234'])
            ->assertRedirect(route('portal.dashboard'))->assertSessionHas('portal_device_id', $device->id);
        $this->get('/portal/dashboard')->assertOk()->assertSee('Editar lista')->assertSee('Principal');
        $this->get("/portal/playlists/{$playlist->id}/edit")->assertOk()->assertSee('Salvar alterações');
        $this->post('/portal/logout')->assertRedirect(route('portal.login'));
        $this->get('/portal/dashboard')->assertRedirect(route('portal.login'));
    }

    public function test_guests_cannot_read_or_change_playlists(): void
    {
        $playlist = $this->device()->playlists()->create($this->data());
        $this->get("/portal/playlists/{$playlist->id}/edit")->assertRedirect(route('portal.login'));
        $this->post('/portal/playlists', $this->data())->assertRedirect(route('portal.login'));
        $this->put("/portal/playlists/{$playlist->id}", $this->data())->assertRedirect(route('portal.login'));
        $this->patch("/portal/playlists/{$playlist->id}/set-main")->assertRedirect(route('portal.login'));
        $this->delete("/portal/playlists/{$playlist->id}")->assertRedirect(route('portal.login'));
        $this->assertDatabaseCount('device_playlists', 1);
    }

    public function test_first_active_playlist_is_main_and_clients_share_validation(): void
    {
        $device = $this->device();
        $this->withSession(['portal_device_id' => $device->id])
            ->post('/portal/playlists', $this->data(['is_active' => false]))->assertRedirect(route('portal.dashboard'));
        $this->withToken(Crypt::encryptString($device->id))
            ->postJson('/api/v1/portal/playlists', $this->data())->assertCreated()->assertJsonPath('is_main', true);
        $this->assertFalse($device->playlists()->oldest('id')->first()->is_main);
        $invalid = $this->data(['name' => str_repeat('a', 101), 'url' => 'file:///etc/test', 'type' => 'xtream']);
        $this->post('/portal/playlists', $invalid)->assertSessionHasErrors(['name', 'url', 'username', 'password']);
        $this->postJson('/api/v1/portal/playlists', $invalid)->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'url', 'username', 'password']);
        $this->assertDatabaseCount('device_playlists', 2);
    }

    public function test_edit_keeps_password_and_main_and_type_change_clears_credentials(): void
    {
        $device = $this->device();
        $playlist = $device->playlists()->create($this->data([
            'type' => 'xtream', 'username' => 'test-user', 'password' => 'synthetic-password-4389', 'is_main' => true,
        ]));
        $this->withSession(['portal_device_id' => $device->id])
            ->get("/portal/playlists/{$playlist->id}/edit")->assertOk()->assertDontSee('synthetic-password-4389');
        $this->put("/portal/playlists/{$playlist->id}", $this->data(['type' => 'xtream', 'username' => 'web-user', 'password' => '']))
            ->assertRedirect(route('portal.dashboard'));
        $this->assertSame('synthetic-password-4389', $playlist->fresh()->password);
        $this->assertTrue($playlist->fresh()->is_main);
        $this->withToken(Crypt::encryptString($device->id))
            ->putJson("/api/v1/portal/playlists/{$playlist->id}", $this->data(['type' => 'xtream', 'username' => 'api-user']))
            ->assertOk()->assertJsonMissingPath('password');
        $this->assertSame('synthetic-password-4389', $playlist->fresh()->password);
        $this->put("/portal/playlists/{$playlist->id}", $this->data())->assertRedirect(route('portal.dashboard'));
        $this->assertNull($playlist->fresh()->password);
        $this->assertNull($playlist->fresh()->username);
    }

    public function test_deactivation_and_deletion_choose_another_active_main(): void
    {
        $device = $this->device();
        $main = $device->playlists()->create($this->data(['is_main' => true]));
        $inactive = $device->playlists()->create($this->data(['is_active' => false]));
        $next = $device->playlists()->create($this->data());
        $last = $device->playlists()->create($this->data());
        $this->withSession(['portal_device_id' => $device->id])
            ->put("/portal/playlists/{$main->id}", $this->data(['is_active' => false]))->assertRedirect(route('portal.dashboard'));
        $this->assertFalse($main->fresh()->is_main);
        $this->assertFalse($inactive->fresh()->is_main);
        $this->assertTrue($next->fresh()->is_main);
        $this->withToken(Crypt::encryptString($device->id))
            ->deleteJson("/api/v1/portal/playlists/{$next->id}")->assertOk();
        $this->assertTrue($last->fresh()->is_main);
        $this->delete("/portal/playlists/{$last->id}")->assertRedirect(route('portal.dashboard'));
        $this->assertSame(0, $device->playlists()->where('is_main', true)->count());
    }

    public function test_selecting_main_is_idempotent_and_rejects_inactive_lists(): void
    {
        $device = $this->device();
        $first = $device->playlists()->create($this->data(['is_main' => true]));
        $second = $device->playlists()->create($this->data());
        $inactive = $device->playlists()->create($this->data(['is_active' => false]));
        $this->withSession(['portal_device_id' => $device->id]);
        for ($i = 0; $i < 2; $i++) {
            $this->patch("/portal/playlists/{$second->id}/set-main")->assertRedirect(route('portal.dashboard'));
            $this->assertTrue($second->fresh()->is_main);
        }
        $this->assertFalse($first->fresh()->is_main);
        $this->withToken(Crypt::encryptString($device->id))
            ->patchJson("/api/v1/portal/playlists/{$inactive->id}/set-main")->assertUnprocessable();
        $this->assertSame(1, $device->playlists()->where('is_main', true)->count());
    }

    public function test_web_and_api_cannot_access_another_devices_playlists(): void
    {
        $device = $this->device();
        $playlist = $this->device('SK:11:22:33:44:55')->playlists()->create($this->data(['is_main' => true]));
        $this->withSession(['portal_device_id' => $device->id])
            ->get("/portal/playlists/{$playlist->id}/edit")->assertNotFound();
        $this->put("/portal/playlists/{$playlist->id}", $this->data())->assertNotFound();
        $this->patch("/portal/playlists/{$playlist->id}/set-main")->assertNotFound();
        $this->delete("/portal/playlists/{$playlist->id}")->assertNotFound();
        $this->withToken(Crypt::encryptString($device->id))
            ->putJson("/api/v1/portal/playlists/{$playlist->id}", $this->data())->assertNotFound();
        $this->patchJson("/api/v1/portal/playlists/{$playlist->id}/set-main")->assertNotFound();
        $this->deleteJson("/api/v1/portal/playlists/{$playlist->id}")->assertNotFound();
        $this->assertTrue($playlist->fresh()->is_main);
    }

    public function test_player_uses_its_own_token_to_set_main_and_reads_updated_config(): void
    {
        $device = $this->device();
        $first = $device->playlists()->create($this->data(['is_main' => true]));
        $second = $device->playlists()->create($this->data());
        $path = "/api/v1/devices/{$device->mac}/playlists/{$second->id}/set-main";
        $this->patchJson($path)->assertUnauthorized();
        $this->withToken(Crypt::encryptString($device->id.'|'.$device->mac))->patchJson($path)->assertOk();
        $this->assertFalse($first->fresh()->is_main);
        $this->getJson("/api/v1/devices/{$device->mac}/config")->assertOk()->assertJsonPath('playlists.1.is_main', true);
        $this->patchJson("/api/v1/devices/SK:11:22:33:44:55/playlists/{$second->id}/set-main")->assertForbidden();
        $other = $this->device('SK:11:22:33:44:55')->playlists()->create($this->data());
        $this->patchJson("/api/v1/devices/{$device->mac}/playlists/{$other->id}/set-main")->assertNotFound();
    }
}
