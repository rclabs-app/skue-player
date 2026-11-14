<?php

namespace Tests\Feature;

use App\Models\PairingCode;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PairingTest extends TestCase
{
    use RefreshDatabase;

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_can_create_pairing_code(): void
    {
        $response = $this->postJson('/api/v1/pairing-codes');

        $response->assertStatus(201)
            ->assertJsonStructure(['code', 'expires_in'])
            ->assertJsonPath('expires_in', 600);

        $this->assertDatabaseCount('pairing_codes', 1);
    }

    public function test_generated_code_is_six_characters(): void
    {
        $response = $this->postJson('/api/v1/pairing-codes');
        $code = $response->json('code');

        $this->assertSame(6, strlen($code));
    }

    public function test_generated_code_has_no_ambiguous_chars(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $code = $this->postJson('/api/v1/pairing-codes')->json('code');
            $this->assertMatchesRegularExpression('/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/', $code);
        }
    }

    // ── Show ──────────────────────────────────────────────────────────────────

    public function test_can_retrieve_existing_code(): void
    {
        $pairing = PairingCode::create([
            'code' => 'ABC123',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->getJson('/api/v1/pairing-codes/ABC123')
            ->assertOk()
            ->assertJsonPath('code', 'ABC123')
            ->assertJsonPath('has_payload', false);
    }

    public function test_returns_404_for_unknown_code(): void
    {
        $this->getJson('/api/v1/pairing-codes/XXXXXX')
            ->assertNotFound();
    }

    public function test_returns_404_for_expired_code(): void
    {
        PairingCode::create([
            'code' => 'EXPIRD',
            'expires_at' => now()->subMinute(),
        ]);

        $this->getJson('/api/v1/pairing-codes/EXPIRD')
            ->assertNotFound();
    }

    // ── Store Payload ─────────────────────────────────────────────────────────

    public function test_browser_can_store_payload(): void
    {
        PairingCode::create([
            'code' => 'VALID1',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/v1/pairing-codes/VALID1/payload', [
            'payload' => 'encrypted-config-data',
        ])->assertOk()
            ->assertJsonPath('status', 'payload_stored');

        $this->assertDatabaseHas('pairing_codes', [
            'code' => 'VALID1',
        ]);
        $this->assertSame('encrypted-config-data', PairingCode::findOrFail('VALID1')->payload);
    }

    public function test_cannot_overwrite_payload(): void
    {
        PairingCode::create([
            'code' => 'DOUBLE',
            'payload' => 'first',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/v1/pairing-codes/DOUBLE/payload', [
            'payload' => 'second',
        ])->assertStatus(409);
    }

    public function test_cannot_store_payload_on_expired_code(): void
    {
        PairingCode::create([
            'code' => 'EXPPAY',
            'expires_at' => now()->subMinute(),
        ]);

        $this->postJson('/api/v1/pairing-codes/EXPPAY/payload', [
            'payload' => 'data',
        ])->assertStatus(410);
    }

    // ── Consume ───────────────────────────────────────────────────────────────

    public function test_tv_can_consume_payload(): void
    {
        PairingCode::create([
            'code' => 'CONSM1',
            'payload' => 'config-data',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/v1/pairing-codes/CONSM1/consume')
            ->assertOk()
            ->assertJsonPath('payload', 'config-data');

        // Must be deleted after consumption
        $this->assertDatabaseMissing('pairing_codes', ['code' => 'CONSM1']);
    }

    public function test_payload_is_deleted_after_consumption(): void
    {
        PairingCode::create([
            'code' => 'DELET1',
            'payload' => 'data',
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/v1/pairing-codes/DELET1/consume')->assertOk();

        // Second attempt must fail
        $this->postJson('/api/v1/pairing-codes/DELET1/consume')->assertNotFound();
    }

    public function test_returns_202_when_payload_not_ready(): void
    {
        PairingCode::create([
            'code' => 'NOPAY1',
            'payload' => null,
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/v1/pairing-codes/NOPAY1/consume')
            ->assertStatus(202)
            ->assertJsonPath('has_payload', false);
    }

    public function test_max_attempts_deletes_code(): void
    {
        PairingCode::create([
            'code' => 'ATMPT1',
            'payload' => null,
            'attempts' => 5,
            'expires_at' => now()->addMinutes(10),
        ]);

        $this->postJson('/api/v1/pairing-codes/ATMPT1/consume')
            ->assertStatus(429);

        $this->assertDatabaseMissing('pairing_codes', ['code' => 'ATMPT1']);
    }

    // ── Health ────────────────────────────────────────────────────────────────

    public function test_health_returns_ok(): void
    {
        $this->getJson('/api/v1/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }
}
