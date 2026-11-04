<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customer\CartQuoteRequest;
use App\Services\Commerce\AddressResolver;
use App\Services\Commerce\DeliveryTermResolver;
use App\Services\Commerce\OrderCalculator;
use App\Services\Commerce\PaymentTermResolver;

// POST /cart/quote (kontrak bagian 9, ASUMSI A-11): validasi item + hitung total tanpa membuat order.
// Mata uang dan pasar dari customer (ASUMSI A-86); paymentTermCode opsional di quote, diperiksa bila dikirim (A-87).
class CartQuoteController extends ApiController
{
    public function quote(CartQuoteRequest $request, OrderCalculator $calculator, AddressResolver $addresses, DeliveryTermResolver $terms, PaymentTermResolver $paymentTerms)
    {
        $data = $request->validated();
        $user = $request->user();

        $term = $terms->resolve($data['deliveryTermCode'] ?? null, $user->market());
        $address = isset($data['addressId']) ? $addresses->forUser($user, (int) $data['addressId']) : null;

        $quote = $calculator->quote(
            $user,
            $data['items'],
            $address,
            isset($data['shippingRateId']) ? (int) $data['shippingRateId'] : null,
            $data['voucherCode'] ?? null,
            $data['paymentMethodCode'] ?? null,
            $term,
        );
        $quote->paymentTerm = $paymentTerms->resolve($data['paymentTermCode'] ?? null, $user, false);

        return $this->data($quote->toArray());
    }
}
