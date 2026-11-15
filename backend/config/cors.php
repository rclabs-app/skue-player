<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CORS_ALLOWED_ORIGINS', env('APP_ENV') === 'local'
            ? '*'
            : 'https://player.skue.tv,http://localhost,https://localhost,capacitor://localhost')),
    ))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Device-Token', 'X-Requested-With'],
    'exposed_headers' => [],
    'max_age' => 600,
    // Device authentication uses Bearer tokens; portal cookies stay on Laravel's origin.
    'supports_credentials' => false,
];
