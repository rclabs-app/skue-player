<?php

namespace Tests\Feature;

use App\Models\Device;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Tests\TestCase;

class PlaylistProxyRestrictionTest extends TestCase
{
    use RefreshDatabase;

    public function test_source_restriction_is_preserved_without_disclosing_its_body_or_retrying(): void
    {
        Log::spy();
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response('synthetic-secret-in-upstream-body', 451, [
            'Server' => 'cloudflare synthetic-secret',
            'CF-Ray' => 'synthetic-secret',
            'Link' => '<https://example.invalid/synthetic-secret>; rel="blocked-by"',
            'Via' => 'synthetic-secret',
        ])]);
        $device = Device::create([
            'mac' => 'AA:BB:CC:DD:EE:09', 'device_key' => 'SYN234', 'key_expires_at' => now()->addDay(),
        ]);
        $token = Crypt::encryptString($device->id.'|'.$device->mac);

        $response = $this->withToken($token)->postJson('/api/v1/proxy', [
            'url' => 'http://93.184.216.34/list?password=synthetic-secret',
        ])->assertStatus(451)
            ->assertJsonPath('code', 'PLAYLIST_SOURCE_RESTRICTED')
            ->assertDontSee('synthetic-secret')
            ->assertHeader('Cache-Control', 'no-store, private');

        $diagnosticId = $response->json('diagnostic_id');
        $this->assertTrue(Str::isUuid($diagnosticId));
        Log::shouldHaveReceived('warning')->once()->with(
            'Playlist import received HTTP 451',
            \Mockery::on(fn (array $context): bool =>
                $context['diagnostic_id'] === $diagnosticId
                && $context['upstream_status'] === 451
                && $context['requested_scheme'] === 'http'
                && $context['server_family'] === 'cloudflare'
                && $context['has_cloudflare_ray']
                && $context['has_blocked_by_link']
                && $context['has_via_header']
                && !str_contains(json_encode($context), 'synthetic-secret')
            )
        );
        Http::assertSentCount(1);
    }
}
