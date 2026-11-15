<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    public function test_player_and_native_origins_can_preflight_bearer_requests(): void
    {
        foreach (['https://player.skue.tv', 'http://localhost', 'https://localhost', 'capacitor://localhost'] as $origin) {
            $response = $this->withHeaders([
                'Origin' => $origin,
                'Access-Control-Request-Method' => 'POST',
                'Access-Control-Request-Headers' => 'authorization,content-type,x-device-token',
            ])->options('/api/v1/devices/handshake');

            $response->assertSuccessful()->assertHeader('Access-Control-Allow-Origin', $origin);
            $response->assertHeaderMissing('Access-Control-Allow-Credentials');
            $this->assertStringContainsString('authorization', strtolower($response->headers->get('Access-Control-Allow-Headers')));
            $this->assertStringContainsString('x-device-token', strtolower($response->headers->get('Access-Control-Allow-Headers')));
        }
    }

    public function test_unlisted_origin_does_not_receive_browser_access(): void
    {
        $this->withHeaders(['Origin' => 'https://untrusted.example.invalid'])
            ->get('/api/v1/health')->assertOk()->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_bearer_authentication_is_still_required_for_allowed_origins(): void
    {
        $this->withHeaders(['Origin' => 'https://player.skue.tv', 'Accept' => 'application/json'])
            ->get('/api/v1/devices/00:11:22:33:44:55/config')
            ->assertUnauthorized()->assertHeader('Access-Control-Allow-Origin', 'https://player.skue.tv');
    }
}
