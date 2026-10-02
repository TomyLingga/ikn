<?php

// CORS untuk SPA Next.js (Sanctum cookie): origin FE eksplisit + credentials.
return [
    // storage/* = berkas publik (fallback route dev) agar penampil PDF di FE (pdf.js) boleh mengambilnya lintas origin.
    'paths' => ['api/*', 'sanctum/csrf-cookie', 'storage/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(',', env('CORS_ALLOWED_ORIGINS', 'http://localhost:3000'))))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => true,
];
