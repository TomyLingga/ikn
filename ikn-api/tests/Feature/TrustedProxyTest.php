<?php

namespace Tests\Feature;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Route::get('/_probe/scheme', fn (Request $request) => ['secure' => $request->secure(), 'url' => $request->url()]);
    }

    public function test_forwarded_proto_is_ignored_without_trusted_proxies(): void
    {
        config(['trustedproxy.proxies' => null]);

        $this->getJson('/_probe/scheme', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'demo.example.ts.net'])
            ->assertOk()
            ->assertJsonPath('secure', false);
    }

    public function test_forwarded_proto_and_host_are_used_when_proxy_is_trusted(): void
    {
        config(['trustedproxy.proxies' => '*']);

        $this->getJson('/_probe/scheme', ['X-Forwarded-Proto' => 'https', 'X-Forwarded-Host' => 'demo.example.ts.net'])
            ->assertOk()
            ->assertJsonPath('secure', true)
            ->assertJsonPath('url', 'https://demo.example.ts.net/_probe/scheme');
    }
}
