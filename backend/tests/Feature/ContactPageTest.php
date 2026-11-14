<?php

namespace Tests\Feature;

use Tests\TestCase;

class ContactPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
    }

    public function test_unconfigured_channel_is_public_and_does_not_advertise_an_inactive_mailbox(): void
    {
        config(['contact.enabled' => false, 'contact.email' => 'contact@example.invalid']);
        $this->get('/contato')->assertOk()->assertSee('Canal em preparação')
            ->assertSee('Não envie senhas')->assertSee('fontes externas')
            ->assertDontSee('mailto:')->assertDontSee('contact@example.invalid');
        $this->get('/')->assertOk()->assertSee(route('contact'))->assertSee('Contato e notificações');
    }

    public function test_enabled_channel_exposes_separate_subjects_without_automatic_submission(): void
    {
        config(['contact.enabled' => true, 'contact.email' => 'contact@example.invalid']);
        $this->get('/contato')->assertOk()->assertSee('contact@example.invalid')
            ->assertSee('mailto:contact@example.invalid?subject='.rawurlencode('[Skue] Suporte'), false)
            ->assertSee('mailto:contact@example.invalid?subject='.rawurlencode('[Skue] Notificação'), false)
            ->assertDontSee('Canal em preparação')->assertDontSee('<form', false);
    }

    public function test_invalid_recipient_cannot_activate_the_channel(): void
    {
        config(['contact.enabled' => true, 'contact.email' => "invalid\r\nBcc: bad@example.invalid"]);
        $this->get('/contato')->assertOk()->assertSee('Canal em preparação')->assertDontSee('mailto:');
    }
}
