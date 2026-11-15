<?php

namespace Tests\Feature;

use Tests\TestCase;

class AndroidDownloadTest extends TestCase
{
    public function test_configured_artifact_is_used_instead_of_old_local_apks(): void
    {
        config(['downloads.android.url' => 'https://artifacts.example.invalid/android/skue-tv.apk']);

        $this->get('/download/skue-tv.apk')
            ->assertRedirect('https://artifacts.example.invalid/android/skue-tv.apk')
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_old_plural_link_redirects_to_the_canonical_download(): void
    {
        $this->get('/downloads/skue-tv.apk')->assertRedirect('/download/skue-tv.apk');
    }

    public function test_invalid_artifact_configuration_does_not_serve_a_stale_local_apk(): void
    {
        foreach (['http://artifacts.example.invalid/skue-tv.apk', 'javascript:alert(1)'] as $url) {
            config(['downloads.android.url' => $url]);
            $this->get('/download/skue-tv.apk')->assertStatus(503);
        }
    }

    public function test_portal_presents_the_current_artifact_metadata(): void
    {
        $this->withoutVite()->get('/')
            ->assertOk()
            ->assertSee('1.0.2-tv-beta')
            ->assertSee('8,2 MiB')
            ->assertSee(route('download.android'), false);
    }
}
