<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CommerceAttributes;
use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST /admin/orders/{number}/status: { status: processing|shipped|delivered|completed, note?, courier?, trackingNumber?,
// vesselName?, voyage?, blNumber?, blDate? }. shipped wajib kurir + resi (kontrak 11.2), kecuali order Loco yang diambil
// sendiri (ASUMSI A-85) dan order FOB/CIF yang wajib nama kapal + nomor B/L (ASUMSI A-88, kontrak 11.11).
class UpdateOrderStatusRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $order = $this->route('order');
        $isPickup = $order instanceof Order && $order->isPickup();
        $isPort = $order instanceof Order && ! $isPickup && $order->isPort();
        $requiredWhenShipped = ['required_if:status,'.Order::STATUS_SHIPPED];
        $shippingRequired = $isPickup || $isPort ? [] : $requiredWhenShipped;
        $vesselRequired = $isPort ? $requiredWhenShipped : [];

        return [
            'status' => ['required', 'string', Rule::in(Order::ADMIN_TARGET_STATUSES)],
            'note' => ['nullable', 'string', 'max:1000'],
            'courier' => array_merge(['nullable', 'string', 'max:120'], $shippingRequired),
            'trackingNumber' => array_merge(['nullable', 'string', 'max:120'], $shippingRequired),
            // Order FOB/CIF: nama kapal + nomor B/L menggantikan kurir + resi; untuk order lain diabaikan.
            'vesselName' => array_merge(['nullable', 'string', 'max:120'], $vesselRequired),
            'voyage' => ['nullable', 'string', 'max:60'],
            'blNumber' => array_merge(['nullable', 'string', 'max:60'], $vesselRequired),
            'blDate' => ['nullable', 'date', 'before_or_equal:today'],
        ];
    }

    public function messages(): array
    {
        return [
            'courier.required_if' => __('commerce.shipping_required'),
            'trackingNumber.required_if' => __('commerce.shipping_required'),
            'vesselName.required_if' => __('commerce.vessel_required'),
            'blNumber.required_if' => __('commerce.vessel_required'),
        ];
    }
}
