<?php

namespace App\Http\Controllers\Api\V1;

use App\Services\Payment\PaymentService;
use Illuminate\Http\Request;

/**
 * POST /payments/webhook/{provider} (kontrak bagian 10): publik, tanpa CSRF (Sanctum stateful hanya bila Origin FE),
 * throttle api. Signature salah → 401; selain itu selalu 200 { received: true, result }.
 */
class PaymentWebhookController extends ApiController
{
    public function handle(Request $request, string $provider, PaymentService $payments)
    {
        $headers = [];
        foreach ($request->headers->all() as $name => $values) {
            $headers[strtolower($name)] = is_array($values) ? implode(', ', $values) : (string) $values;
        }

        $payload = $request->json()->all();
        if (! is_array($payload) || $payload === []) {
            $payload = $request->all();
        }

        $result = $payments->handleWebhook($provider, $headers, $payload);

        return $this->data($result->toArray());
    }
}
