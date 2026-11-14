<?php

return [
    // Enable only after the mailbox, owner and delivery test are confirmed.
    'enabled' => (bool) env('SKUE_CONTACT_ENABLED', false),
    'email' => env('SKUE_CONTACT_EMAIL', 'contato@skue.tv'),
];
