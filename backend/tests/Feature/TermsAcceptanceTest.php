<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TermsAcceptanceTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_replace([
            'acceptance_id' => '67876896-7788-4344-9555-123456789012',
            'device_id' => 'SK:AA:BB:CC:DD:EE',
            'platform' => 'web',
            'terms_version' => config('legal.version'),
        ], $overrides);
    }

    public function test_public_documents_and_manifest_use_the_same_text_and_version(): void
    {
        $this->withoutVite();
        $response = $this->getJson('/api/v1/app-version')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('terms_version', config('legal.version'))
            ->assertJsonPath('legal.documents', config('legal.documents'));
        foreach ($response->json('legal.documents') as $document) {
            $page = $this->get($document['path'])->assertOk()
                ->assertSee(config('legal.version'))->assertSee(config('legal.status'));
            foreach ($document['sections'] as $section) {
                $page->assertSee($section['title'])->assertSee($section['text']);
            }
        }
        $this->get('/')->assertOk()->assertSee('/termos')->assertSee('/privacidade')->assertSee('/aviso-legal');
    }

    public function test_receipt_is_persisted_without_ip_and_retry_returns_the_original_receipt(): void
    {
        $first = $this->postJson('/api/v1/terms/accept', $this->payload())->assertCreated()
            ->assertJsonPath('status', 'accepted')->assertJsonPath('terms_version', config('legal.version'));
        $this->travel(2)->minutes();
        $this->postJson('/api/v1/terms/accept', $this->payload())->assertOk()->assertExactJson($first->json());
        $this->assertDatabaseCount('terms_acceptances', 1);
        $this->assertDatabaseHas('terms_acceptances', $this->payload() + ['ip_address' => null]);
    }

    public function test_old_future_and_missing_versions_or_identity_are_rejected(): void
    {
        foreach (['1.0-draft', 'unknown-future', ''] as $version) {
            $this->postJson('/api/v1/terms/accept', $this->payload(['terms_version' => $version]))
                ->assertUnprocessable()->assertJsonValidationErrors('terms_version');
        }
        foreach (['anonymous-device', '', 'SK:wrong'] as $device) {
            $this->postJson('/api/v1/terms/accept', $this->payload(['device_id' => $device]))
                ->assertUnprocessable()->assertJsonValidationErrors('device_id');
        }
        $this->postJson('/api/v1/terms/accept', $this->payload(['acceptance_id' => null]))
            ->assertUnprocessable()->assertJsonValidationErrors('acceptance_id');
        $this->assertDatabaseCount('terms_acceptances', 0);
    }

    public function test_same_attempt_cannot_be_reassigned_to_another_device_or_platform(): void
    {
        $this->postJson('/api/v1/terms/accept', $this->payload())->assertCreated();
        $this->postJson('/api/v1/terms/accept', $this->payload(['platform' => 'android']))->assertConflict();
        $this->postJson('/api/v1/terms/accept', $this->payload(['device_id' => 'SK:11:22:33:44:55']))->assertConflict();
        $this->assertDatabaseCount('terms_acceptances', 1);
    }

    public function test_new_required_version_requires_a_new_acceptance_and_preserves_history(): void
    {
        $this->postJson('/api/v1/terms/accept', $this->payload())->assertCreated();
        $previousVersion = config('legal.version');
        config(['legal.version' => 'synthetic-next-version']);
        $this->postJson('/api/v1/terms/accept', $this->payload(['terms_version' => $previousVersion]))->assertUnprocessable();
        $this->postJson('/api/v1/terms/accept', $this->payload())->assertConflict();
        $this->postJson('/api/v1/terms/accept', $this->payload([
            'acceptance_id' => '67876896-7788-4344-9555-123456789013', 'platform' => 'android',
        ]))->assertCreated()->assertJsonPath('current_version', 'synthetic-next-version');
        $this->assertDatabaseCount('terms_acceptances', 2);
    }

    public function test_legacy_rows_remain_historical_and_are_not_upgraded_to_current_acceptance(): void
    {
        DB::table('terms_acceptances')->insert([
            'device_id' => 'SK:AA:BB:CC:DD:EE', 'terms_version' => '1.0-draft',
            'platform' => 'web', 'created_at' => now(), 'updated_at' => now(),
        ]);
        $this->postJson('/api/v1/terms/accept', $this->payload())->assertCreated();
        $this->assertDatabaseCount('terms_acceptances', 2);
        $this->assertDatabaseHas('terms_acceptances', ['acceptance_id' => null, 'terms_version' => '1.0-draft']);
    }
}
