<?php

// Proxies whose X-Forwarded-* headers Laravel trusts (read by App\Http\Middleware\TrustProxies via the framework
// fallback). Needed behind a reverse proxy that terminates HTTPS (Caddy/nginx in Docker, the preview proxy behind
// Tailscale Funnel); otherwise requests look like plain http and signed URLs (email verification) fail.
// Empty = trust nothing (local dev). "*" = trust the calling proxy; only use it when the app port is not public.
return [
    'proxies' => env('TRUSTED_PROXIES') ?: null,
];
