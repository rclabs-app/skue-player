<?php

return [
    // Disabled unless both values are explicitly configured. Never reuse APP_KEY.
    'gateway_url' => env('MEDIA_GATEWAY_URL'),
    'gateway_key' => env('MEDIA_GATEWAY_KEY'),
    'ticket_seconds' => 21600,
];
