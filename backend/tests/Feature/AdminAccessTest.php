<?php

namespace Tests\Feature;

use App\Models\User;
use Filament\Panel;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_production_denies_a_valid_user_when_no_administrator_is_configured(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        config(['admin.emails' => []]);
        $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden();
    }

    public function test_only_the_configured_identity_can_access_the_production_panel(): void
    {
        $this->withoutVite();
        $this->app->detectEnvironment(fn () => 'production');
        config(['admin.emails' => ['allowed@example.invalid']]);
        $allowed = User::factory()->create(['email' => 'allowed@example.invalid']);
        $other = User::factory()->create(['email' => 'other@example.invalid']);
        $this->actingAs($other)->get('/admin')->assertForbidden();
        $this->actingAs($allowed)->get('/admin')->assertOk();
        $this->assertFalse($allowed->canAccessPanel(Panel::make()->id('another-panel')));
    }

    public function test_local_development_access_is_preserved_without_granting_other_environments(): void
    {
        config(['admin.emails' => []]);
        $user = User::factory()->create();
        $panel = Panel::make()->id('admin');
        $this->app->detectEnvironment(fn () => 'local');
        $this->assertTrue($user->canAccessPanel($panel));
        $this->app->detectEnvironment(fn () => 'staging');
        $this->assertFalse($user->canAccessPanel($panel));
    }
}
