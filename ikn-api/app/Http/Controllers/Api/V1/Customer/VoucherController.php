<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Models\Voucher;
use App\Services\Commerce\VoucherService;
use Illuminate\Http\Request;

// GET /customer/vouchers: voucher yang ditujukan khusus ke customer ini dan masih bisa dipakai (ASUMSI A-67).
// Voucher umum tidak didaftar di sini; kodenya dibagikan admin di luar sistem seperti sebelumnya.
class VoucherController extends ApiController
{
    public function index(Request $request, VoucherService $vouchers)
    {
        return $this->data($vouchers->assignedTo($request->user())->map(fn (Voucher $voucher) => [
            'code' => $voucher->code,
            'type' => $voucher->type,
            'value' => $voucher->valueNumber(),
            'minSubtotal' => $voucher->minSubtotalInt(),
            'maxDiscount' => $voucher->maxDiscountInt(),
            'scope' => $voucher->discountScope(),
            'endsAt' => optional($voucher->ends_at)->toApiString(),
        ])->all());
    }
}
