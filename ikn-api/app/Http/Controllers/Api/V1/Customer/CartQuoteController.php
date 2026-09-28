<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Customer\CartQuoteRequest;
use App\Services\Commerce\AddressResolver;
use App\Services\Commerce\OrderCalculator;

// POST /cart/quote (kontrak bagian 9, ASUMSI A-11): validasi item + hitung total tanpa membuat order.
class CartQuoteController extends ApiController
{
    public function quote(CartQuoteRequest $request, OrderCalculator $calculator, AddressResolver $addresses)
    {
        $data = $request->validated();
        $user = $request->user();

        $address = isset($data['addressId']) ? $addresses->forUser($user, (int) $data['addressId']) : null;

        $quote = $calculator->quote(
            $user,
            $data['items'],
            $address,
            isset($data['shippingRateId']) ? (int) $data['shippingRateId'] : null,
            $data['voucherCode'] ?? null,
            $data['paymentMethodCode'] ?? null,
        );

        return $this->data($quote->toArray());
    }
}
