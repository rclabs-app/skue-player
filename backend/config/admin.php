<?php

return [
    // Explicit identities, never an entire email domain. Empty denies access outside local.
    'emails' => array_values(array_filter(array_map(
        fn (string $email) => strtolower(trim($email)),
        explode(',', (string) env('SKUE_ADMIN_EMAILS', '')),
    ))),
];
