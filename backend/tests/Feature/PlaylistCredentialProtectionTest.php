<?php

namespace Tests\Feature;

use App\Casts\ProtectedPlaylistValue;
use App\Exceptions\PlaylistProtectionException;
use App\Models\Device;
use App\Models\DevicePlaylist;
use App\Models\PairingCode;
use App\Services\DevicePlaylistService;
use App\Services\PlaylistCredentialMigration;
use Illuminate\Encryption\Encrypter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\TestCase;

class PlaylistCredentialProtectionTest extends TestCase
{
    use RefreshDatabase;

    private string $isolatedStorage;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->isolatedStorage = sys_get_temp_dir().'/skue-credential-test-'.Str::uuid();
        $this->app->useStoragePath($this->isolatedStorage);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->isolatedStorage);
        parent::tearDown();
    }

    private function device(string $mac = 'AA:BB:CC:DD:EE:01'): Device
    {
        return Device::create(['mac' => $mac, 'device_key' => 'ABC234', 'key_expires_at' => now()->addDay()]);
    }

    private function input(): array
    {
        return [
            'name' => 'Synthetic fixture', 'type' => 'xtream', 'is_active' => true,
            'url' => 'https://url-user:url-secret@example.invalid/get.php?token=synthetic-url-secret',
            'username' => 'synthetic-user', 'password' => 'synthetic-password',
        ];
    }

    private function legacy(Device $device): int
    {
        return DB::table('device_playlists')->insertGetId([
            ...$this->input(), 'device_id' => $device->id, 'is_main' => true,
        ]);
    }

    public function test_writes_encrypt_all_sensitive_columns_and_nulls_still_work(): void
    {
        $device = $this->device();
        $playlist = app(DevicePlaylistService::class)->save($device, $this->input());
        $row = (array) DB::table('device_playlists')->find($playlist->id);
        foreach (['url', 'username', 'password'] as $field) {
            $this->assertStringStartsWith(ProtectedPlaylistValue::PREFIX, $row[$field]);
            $this->assertStringNotContainsString($this->input()[$field], $row[$field]);
            $this->assertSame($this->input()[$field], $playlist->fresh()->$field);
            $this->assertArrayNotHasKey($field, $playlist->toArray());
        }
        $playlist = app(DevicePlaylistService::class)->save($device, [
            'name' => 'M3U fixture', 'type' => 'm3u', 'url' => 'https://example.invalid/list?password=synthetic-url-secret',
        ], $playlist->id);
        $this->assertNull($playlist->username);
        $this->assertNull($playlist->password);
        $this->assertStringStartsWith(ProtectedPlaylistValue::PREFIX, DB::table('device_playlists')->find($playlist->id)->url);
    }

    public function test_maximum_credentials_fit_expanded_columns_and_empty_password_keeps_existing_value(): void
    {
        $device = $this->device();
        $input = [...$this->input(), 'username' => str_repeat('u', 255), 'password' => str_repeat('p', 255)];
        $playlist = app(DevicePlaylistService::class)->save($device, $input);
        $this->assertGreaterThan(255, strlen(DB::table('device_playlists')->find($playlist->id)->password));
        // HTTP middleware converts an omitted/empty replacement password to null.
        $updated = app(DevicePlaylistService::class)->save($device, [...$input, 'password' => null], $playlist->id);
        $this->assertSame($input['password'], $updated->password);
        $this->assertSame($input['username'], $updated->username);
    }

    public function test_only_device_config_explicitly_exposes_credentials_and_uses_no_store(): void
    {
        $device = $this->device();
        $playlist = app(DevicePlaylistService::class)->save($device, $this->input());
        $portalToken = Crypt::encryptString($device->id);
        $this->withToken($portalToken)->getJson('/api/v1/portal/playlists')->assertOk()
            ->assertJsonPath('0.id', $playlist->id)
            ->assertJsonMissingPath('0.url')->assertJsonMissingPath('0.username')->assertJsonMissingPath('0.password');
        $this->withToken(Crypt::encryptString($device->id.'|'.$device->mac))
            ->getJson('/api/v1/devices/'.$device->mac.'/config')->assertOk()
            ->assertJsonPath('playlists.0.url', $this->input()['url'])
            ->assertJsonPath('playlists.0.username', $this->input()['username'])
            ->assertJsonPath('playlists.0.password', $this->input()['password'])
            ->assertHeader('Cache-Control', 'no-store, private');
        $other = $this->device('AA:BB:CC:DD:EE:02');
        $this->withToken(Crypt::encryptString($other->id.'|'.$other->mac))
            ->getJson('/api/v1/devices/'.$device->mac.'/config')->assertForbidden();
        $this->withToken($portalToken)->getJson('/api/v1/devices/'.$device->mac.'/config')->assertUnauthorized();
    }

    public function test_other_devices_cannot_edit_delete_or_select_private_playlists(): void
    {
        $owner = $this->device();
        $playlist = app(DevicePlaylistService::class)->save($owner, $this->input());
        $other = $this->device('AA:BB:CC:DD:EE:02');
        $this->withToken(Crypt::encryptString($other->id))
            ->putJson('/api/v1/portal/playlists/'.$playlist->id, $this->input())->assertNotFound();
        $this->deleteJson('/api/v1/portal/playlists/'.$playlist->id)->assertNotFound();
        $this->patchJson('/api/v1/portal/playlists/'.$playlist->id.'/set-main')->assertNotFound();
        $this->withSession(['portal_device_id' => $other->id])
            ->get('/portal/playlists/'.$playlist->id.'/edit')->assertNotFound();
        $this->assertSame($this->input()['password'], $playlist->fresh()->password);
    }

    public function test_validation_does_not_flash_sources_credentials_or_device_keys(): void
    {
        $device = $this->device();
        $this->withSession(['portal_device_id' => $device->id])
            ->post('/portal/playlists', [...$this->input(), 'name' => ''])
            ->assertSessionHasErrors('name');
        foreach (['url', 'username', 'password'] as $field) {
            $this->assertNull(session()->getOldInput($field));
        }
        $this->post('/portal', ['mac' => $device->mac, 'device_key' => 'BAD234'])
            ->assertSessionHasErrors('device_key');
        $this->assertNull(session()->getOldInput('device_key'));
    }

    public function test_corrupted_ciphertext_fails_closed_without_debug_or_credentials(): void
    {
        config(['app.debug' => true]);
        $device = $this->device();
        $id = $this->legacy($device);
        DB::table('device_playlists')->where('id', $id)->update(['url' => ProtectedPlaylistValue::PREFIX.'corrupted-fixture']);
        $this->withToken(Crypt::encryptString($device->id.'|'.$device->mac))
            ->getJson('/api/v1/devices/'.$device->mac.'/config')->assertStatus(503)
            ->assertExactJson(['error' => 'Não foi possível acessar a configuração protegida da lista.'])
            ->assertDontSee('corrupted-fixture')->assertDontSee('synthetic-password');
    }

    public function test_migration_backup_recovery_and_idempotence_preserve_existing_lists(): void
    {
        $device = $this->device();
        $id = $this->legacy($device);
        $before = (array) DB::table('device_playlists')->find($id);
        $this->assertSame($this->input()['url'], DevicePlaylist::findOrFail($id)->url);
        $service = app(PlaylistCredentialMigration::class);
        $this->assertSame(1, $service->pendingCount());
        $result = $service->migrate();
        $this->assertSame(1, $result['count']);
        $this->assertFileExists($result['backup']);
        $this->assertSame(0600, fileperms($result['backup']) & 0777);
        foreach (['url', 'username', 'password'] as $field) {
            $this->assertStringNotContainsString($this->input()[$field], file_get_contents($result['backup']));
            $this->assertSame($this->input()[$field], DevicePlaylist::findOrFail($id)->$field);
        }
        $this->assertSame(['count' => 0, 'backup' => null], $service->migrate());
        $this->assertSame(1, $service->restore($result['backup']));
        $this->assertStringStartsWith(ProtectedPlaylistValue::PREFIX, DB::table('device_playlists')->find($id)->url);
        $this->assertSame(1, $service->restore($result['backup'], true));
        $this->assertSame($before, (array) DB::table('device_playlists')->find($id));
        $this->assertSame(1, $service->migrate()['count']);
    }

    public function test_commands_default_to_inspection_without_exposing_values(): void
    {
        $id = $this->legacy($this->device());
        $this->artisan('playlists:protect-credentials')->expectsOutput('Configurações pendentes de proteção: 1')->assertSuccessful();
        $this->assertSame($this->input()['url'], DB::table('device_playlists')->find($id)->url);
        $this->assertDirectoryDoesNotExist($this->isolatedStorage.'/app/private/playlist-credential-backups');
        $this->artisan('playlists:protect-credentials', ['--apply' => true])->expectsOutput('Configurações protegidas: 1')->assertSuccessful();
        $path = glob($this->isolatedStorage.'/app/private/playlist-credential-backups/*.enc')[0];
        $this->artisan('playlists:restore-credentials', ['backup' => $path])->expectsOutput('Configurações recuperáveis: 1')->assertSuccessful();
        $this->assertStringStartsWith(ProtectedPlaylistValue::PREFIX, DB::table('device_playlists')->find($id)->url);
        $this->artisan('playlists:restore-credentials', ['backup' => $path, '--apply' => true])->expectsOutput('Configurações recuperadas: 1')->assertSuccessful();
        $this->assertSame($this->input()['url'], DB::table('device_playlists')->find($id)->url);
    }

    public function test_recovery_refuses_later_edits_and_deleted_rows(): void
    {
        $device = $this->device();
        $id = $this->legacy($device);
        $backup = app(PlaylistCredentialMigration::class)->migrate()['backup'];
        $playlist = DevicePlaylist::findOrFail($id);
        $playlist->update(['password' => 'new-synthetic-password']);
        $this->artisan('playlists:restore-credentials', ['backup' => $backup, '--apply' => true])->assertFailed();
        $this->assertSame('new-synthetic-password', $playlist->fresh()->password);
        $playlist->delete();
        $this->artisan('playlists:restore-credentials', ['backup' => $backup, '--apply' => true])->assertFailed();
        $this->assertDatabaseCount('device_playlists', 0);
    }

    public function test_tampered_backup_and_missing_key_do_not_change_the_database(): void
    {
        $id = $this->legacy($this->device());
        $service = app(PlaylistCredentialMigration::class);
        $backup = $service->migrate()['backup'];
        $before = (array) DB::table('device_playlists')->find($id);
        $contents = file_get_contents($backup);
        file_put_contents($backup, 'invalid-synthetic-backup');
        $this->artisan('playlists:restore-credentials', ['backup' => $backup, '--apply' => true])->assertFailed();
        file_put_contents($backup, $contents);
        $original = Crypt::getFacadeRoot();
        try {
            Crypt::swap(new Encrypter(random_bytes(32), 'AES-256-CBC'));
            $this->artisan('playlists:restore-credentials', ['backup' => $backup, '--apply' => true])->assertFailed();
        } finally {
            Crypt::swap($original);
        }
        $this->assertSame($before, (array) DB::table('device_playlists')->find($id));
    }

    public function test_previous_key_keeps_encrypted_values_readable_during_rotation(): void
    {
        $original = Crypt::getFacadeRoot();
        $oldKey = random_bytes(32);
        try {
            Crypt::swap(new Encrypter($oldKey, 'AES-256-CBC'));
            $encoded = ProtectedPlaylistValue::encode('synthetic-password');
            $new = new Encrypter(random_bytes(32), 'AES-256-CBC');
            $new->previousKeys([$oldKey]);
            Crypt::swap($new);
            $this->assertSame('synthetic-password', ProtectedPlaylistValue::decode($encoded));
        } finally {
            Crypt::swap($original);
        }
    }

    public function test_pairing_payload_is_protected_and_remains_single_use(): void
    {
        PairingCode::create(['code' => 'PAIR23', 'expires_at' => now()->addMinutes(10)]);
        $payload = json_encode(['url' => $this->input()['url']]);
        $this->postJson('/api/v1/pairing-codes/PAIR23/payload', ['payload' => $payload])->assertOk();
        $raw = DB::table('pairing_codes')->where('code', 'PAIR23')->value('payload');
        $this->assertStringStartsWith(ProtectedPlaylistValue::PREFIX, $raw);
        $this->assertStringNotContainsString('synthetic-url-secret', $raw);
        $this->assertArrayNotHasKey('payload', PairingCode::findOrFail('PAIR23')->toArray());
        $this->getJson('/api/v1/pairing-codes/PAIR23')->assertOk()->assertJsonPath('has_payload', true)->assertJsonMissingPath('payload');
        $this->postJson('/api/v1/pairing-codes/PAIR23/consume')->assertOk()->assertJsonPath('payload', $payload);
        $this->postJson('/api/v1/pairing-codes/PAIR23/consume')->assertNotFound();
    }

    public function test_maximum_pairing_payload_fits_ciphertext_storage(): void
    {
        PairingCode::create(['code' => 'LONG23', 'expires_at' => now()->addMinutes(10)]);
        $payload = str_repeat('x', 65535);
        $this->postJson('/api/v1/pairing-codes/LONG23/payload', ['payload' => $payload])->assertOk();
        $this->assertGreaterThan(65535, strlen(DB::table('pairing_codes')->where('code', 'LONG23')->value('payload')));
        $this->postJson('/api/v1/pairing-codes/LONG23/consume')->assertOk()->assertJsonPath('payload', $payload);
    }

    public function test_legacy_pairing_and_playlist_migrate_together_without_resurrecting_consumed_codes(): void
    {
        $id = $this->legacy($this->device());
        DB::table('pairing_codes')->insert([
            'code' => 'PAIR23', 'expires_at' => now()->addMinutes(10),
            'payload' => json_encode(['url' => $this->input()['url']]),
        ]);
        $service = app(PlaylistCredentialMigration::class);
        $this->assertSame(2, $service->pendingCount());
        $result = $service->migrate();
        $this->assertSame(2, $result['count']);
        $this->assertSame(2, $service->restore($result['backup']));
        $this->assertSame(2, $service->restore($result['backup'], true));
        $this->assertSame($this->input()['url'], DB::table('device_playlists')->find($id)->url);
        $result = $service->migrate();
        $this->postJson('/api/v1/pairing-codes/PAIR23/consume')->assertOk();
        $this->artisan('playlists:restore-credentials', ['backup' => $result['backup'], '--apply' => true])->assertFailed();
        $this->assertDatabaseMissing('pairing_codes', ['code' => 'PAIR23']);
        $this->assertStringStartsWith(ProtectedPlaylistValue::PREFIX, DB::table('device_playlists')->find($id)->url);
    }

    public function test_failed_backup_leaves_legacy_values_unchanged(): void
    {
        $id = $this->legacy($this->device());
        $before = (array) DB::table('device_playlists')->find($id);
        $service = new class extends PlaylistCredentialMigration
        {
            protected function writeBackup(array $data): string
            {
                throw new PlaylistProtectionException;
            }
        };
        try {
            $service->migrate();
            $this->fail('The migration must stop if the backup cannot be created.');
        } catch (PlaylistProtectionException) {
            $this->assertSame($before, (array) DB::table('device_playlists')->find($id));
        }
    }

    public function test_proxy_error_does_not_return_upstream_url_or_exception_message(): void
    {
        $device = $this->device();
        Http::preventStrayRequests();
        Http::fake(fn () => throw new \RuntimeException('https://example.invalid/?password=synthetic-upstream-secret'));
        $this->withToken(Crypt::encryptString($device->id.'|'.$device->mac))
            ->postJson('/api/v1/proxy', ['url' => 'https://93.184.216.34/fixture.m3u'])->assertStatus(502)
            ->assertExactJson(['error' => 'Não foi possível buscar a lista na origem.'])
            ->assertDontSee('synthetic-upstream-secret');
    }

    public function test_deletion_removes_active_credentials_and_device_deletion_cascades(): void
    {
        $device = $this->device();
        $playlist = app(DevicePlaylistService::class)->save($device, $this->input());
        app(DevicePlaylistService::class)->delete($device, $playlist->id);
        $this->assertDatabaseMissing('device_playlists', ['id' => $playlist->id]);
        app(DevicePlaylistService::class)->save($device, $this->input());
        $device->delete();
        $this->assertDatabaseCount('device_playlists', 0);
    }
}
