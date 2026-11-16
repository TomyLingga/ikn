<?php

// Map tile providers (ASUMSI A-98): validation messages for the maps settings group and "Test" button results.
return [
    'tile_url_invalid' => ':attribute must start with https:// and contain {z}, {x} and {y}. The only other placeholders accepted are {s} and {r}.',
    'google_key_required' => 'A Google Maps API key is required for the Google provider.',
    'custom_required' => 'Fill in at least one tile URL (street map or satellite imagery).',

    'test_ok' => 'The map provider answered correctly.',
    'test_failed' => 'The map provider cannot be used yet. See the details per layer.',

    'default_ok' => 'The default map (:name) needs no API key.',
    'unreachable' => 'The server could not reach :host. Check the server internet connection.',
    'not_an_image' => 'The provider did not return a tile image. Check the URL or the API key.',

    'google_key_missing' => 'The Google Maps API key is empty.',
    'google_ok' => 'Session token created and a sample tile received. The token is valid until :until and renews automatically.',
    'google_rejected' => 'Google rejected the request: :reason',
    'google_bad_response' => 'The Google response did not contain a session token.',

    'custom_ok' => 'Sample tile received from :host.',
    'custom_blank' => 'Empty URL: this layer uses the default map.',
    'custom_rejected' => ':host answered HTTP :status. Check the URL, the API key, or the domain restriction on the key.',
];
