<?php

namespace Tests\Feature;

use App\Models\Device;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class XtreamSeriesTest extends TestCase
{
    use RefreshDatabase;

    private function endpoint(string $url = 'https://93.184.216.34'): string
    {
        $device = Device::create(['mac' => 'SK:AA:BB:CC:DD:91', 'device_key' => 'SYN234', 'key_expires_at' => now()->addDay()]);
        $playlist = $device->playlists()->create(['name' => 'Synthetic', 'type' => 'xtream', 'url' => $url,
            'username' => 'synthetic-user', 'password' => 'synthetic-secret', 'is_active' => true, 'is_main' => true]);
        $this->withToken(Crypt::encryptString($device->id.'|'.$device->mac));
        return '/api/v1/devices/'.$device->mac.'/playlists/'.$playlist->id.'/xtream/series/7';
    }

    public function test_authentication_and_ownership_are_required(): void
    {
        Http::preventStrayRequests();
        $this->getJson('/api/v1/devices/SK:AA/playlists/1/xtream/series/7')->assertUnauthorized();
        $url = $this->endpoint();
        $this->getJson(str_replace('/playlists/1/', '/playlists/999/', $url))->assertNotFound();
        $this->getJson(str_replace('SK:AA:BB:CC:DD:91', 'SK:AA:BB:CC:DD:92', $url))->assertForbidden();
        Http::assertNothingSent();
    }

    public function test_same_origin_metadata_redirect_is_followed_and_only_episode_fields_are_returned(): void
    {
        Http::fakeSequence()->push('', 301, ['Location' => '/info_api.php?ignored=1'])
            ->push(['episodes' => ['1' => [['id' => 42, 'season' => 1, 'episode_num' => 2,
                'container_extension' => 'mp4', 'direct_source' => 'synthetic-secret']]], 'info' => ['private' => 'synthetic-secret']]);
        $this->getJson($this->endpoint())->assertOk()->assertJsonPath('episodes.1.0.id', 42)
            ->assertDontSee('synthetic-secret')->assertHeader('Cache-Control', 'no-store, private');
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => str_contains($request->url(), '/info_api.php?')
            && $request['action'] === 'get_series_info' && $request['series_id'] === '7');
    }

    public function test_explicit_restriction_stops_without_leaking_response_or_retrying(): void
    {
        Http::fakeSequence()->push('synthetic-secret', 451);
        $this->getJson($this->endpoint())->assertStatus(451)->assertDontSee('synthetic-secret');
        Http::assertSentCount(1);
    }

    public function test_private_source_is_never_requested(): void
    {
        Http::preventStrayRequests();
        $this->getJson($this->endpoint('https://127.0.0.1'))->assertStatus(422);
        Http::assertNothingSent();
    }

    public function test_downgrade_or_cross_origin_redirect_is_not_followed(): void
    {
        Http::fakeSequence()->push('', 302, ['Location' => 'http://127.0.0.1/private']);
        $this->getJson($this->endpoint())->assertStatus(502);
        Http::assertSentCount(1);
    }

    public function test_non_json_media_or_excessive_body_is_not_relayed(): void
    {
        Http::fakeSequence()->push(str_repeat('x', 2097153), 200, ['Content-Type' => 'video/mp2t']);
        $this->getJson($this->endpoint())->assertStatus(502)->assertDontSee(str_repeat('x', 100));
    }
}
