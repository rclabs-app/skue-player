<?php

namespace Tests\Feature;

use App\Models\Device;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Tests\TestCase;

class MoviePlaybackTest extends TestCase
{
    use RefreshDatabase;

    private function setupMovie(): array
    {
        $device = Device::create(['mac' => 'SK:AA:BB:CC:DD:94', 'device_key' => 'SYN234', 'key_expires_at' => now()->addDay()]);
        $playlist = $device->playlists()->create(['name' => 'Synthetic', 'type' => 'xtream', 'url' => 'http://source.example.invalid',
            'username' => 'synthetic-user', 'password' => 'synthetic-secret', 'is_active' => true]);
        $this->withToken(Crypt::encryptString($device->id.'|'.$device->mac));
        config(['media.gateway_url' => 'https://media.example.invalid', 'media.gateway_key' => base64_encode(str_repeat('x', 32))]);

        return [$device, $playlist, '/api/v1/devices/'.$device->mac.'/playlists/'.$playlist->id.'/movie-ticket'];
    }

    public function test_ticket_is_encrypted_scoped_to_the_owned_configuration_and_not_cached(): void
    {
        [$device, $playlist, $url] = $this->setupMovie();
        $response = $this->postJson($url, ['stream_id' => '123', 'extension' => 'mp4'])
            ->assertOk()->assertDontSee('synthetic-secret')->assertDontSee('synthetic-user')
            ->assertHeader('Cache-Control', 'no-store, private');
        parse_str(parse_url($response->json('url'), PHP_URL_QUERY), $query);
        $bytes = base64_decode(strtr($query['ticket'], '-_', '+/'));
        $plain = openssl_decrypt(substr($bytes, 28), 'aes-256-gcm', str_repeat('x', 32), OPENSSL_RAW_DATA,
            substr($bytes, 0, 12), substr($bytes, 12, 16), 'skue-media-v1');
        $data = json_decode($plain, true);
        $this->assertSame('http://source.example.invalid/movie/synthetic-user/synthetic-secret/123.mp4', $data['url']);
        $this->assertSame($device->id, $data['device_id']);
        $this->assertSame(21600, $data['exp'] - $data['iat']);
    }

    public function test_gateway_disabled_is_explicit_and_does_not_leak_source(): void
    {
        [, , $url] = $this->setupMovie();
        config(['media.gateway_key' => null]);
        $this->postJson($url, ['stream_id' => '123', 'extension' => 'mp4'])->assertStatus(503)
            ->assertJsonPath('code', 'MEDIA_GATEWAY_UNAVAILABLE')->assertDontSee('synthetic-secret');
    }

    public function test_authentication_ownership_and_active_playlist_are_required(): void
    {
        $this->postJson('/api/v1/devices/SK:AA/playlists/1/movie-ticket', [])->assertUnauthorized();
        [, $playlist, $url] = $this->setupMovie();
        $this->postJson(str_replace('/playlists/'.$playlist->id.'/', '/playlists/999/', $url), ['stream_id' => '1', 'extension' => 'mp4'])->assertNotFound();
        $playlist->update(['is_active' => false]);
        $this->postJson($url, ['stream_id' => '1', 'extension' => 'mp4'])->assertNotFound();
    }

    public function test_arbitrary_urls_paths_and_unsupported_formats_are_rejected(): void
    {
        [, , $url] = $this->setupMovie();
        foreach ([['stream_id' => '../private', 'extension' => 'mp4'], ['stream_id' => '1', 'extension' => 'm3u8'],
            ['stream_id' => '1', 'extension' => 'mp4', 'url' => 'http://127.0.0.1']] as $input) {
            $this->postJson($url, $input)->assertUnprocessable();
        }
        config(['media.gateway_url' => 'http://media.example.invalid']);
        $this->postJson($url, ['stream_id' => '1', 'extension' => 'mp4'])->assertStatus(503);
    }
}
