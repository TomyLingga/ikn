<?php

namespace App\Http\Resources;

use App\Models\CustomerAddress;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\Resources\Json\JsonResource;

// Detail GET /admin/customers/{id}: profil + alamat + ringkasan order (kontrak 11.4).
// orders()/ordersCount() sengaja publik dan terpisah agar BE-3 mengisinya dari model Order tanpa mengubah bentuk lain.
class AdminCustomerResource extends JsonResource
{
    public function toArray($request): array
    {
        /** @var User $user */
        $user = $this->resource;
        $user->loadMissing(array_merge(
            ['profile', 'approvedBy'],
            array_map(fn (string $relation) => 'addresses.'.$relation, CustomerAddress::REGION_RELATIONS)
        ));
        $profile = $user->profile;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'status' => $user->status,
            'locale' => $user->locale,
            'phone' => $profile?->phone,
            'company' => $profile?->company,
            'position' => $profile?->position,
            'companyEmail' => $profile?->company_email,
            'companyPhone' => $profile?->company_phone,
            'taxId' => $profile?->tax_id,
            'market' => $user->market(),
            'currency' => $user->currency(),
            'countryCode' => $profile?->country_code ?: \App\Models\CustomerProfile::DEFAULT_COUNTRY,
            'companyAddress' => $profile?->company_address,
            'openOrdersCount' => $user->orders()->whereNotIn('status', Order::FINAL_STATUSES)->count(),
            'joinedAt' => optional($user->created_at)->toApiString(),
            'emailVerifiedAt' => optional($user->email_verified_at)->toApiString(),
            'approvedAt' => optional($user->approved_at)->toApiString(),
            'approvedBy' => $user->approvedBy ? ['id' => $user->approvedBy->id, 'name' => $user->approvedBy->name] : null,
            'rejectionReason' => $user->rejection_reason,
            'lastLoginAt' => optional($user->last_login_at)->toApiString(),
            'addresses' => CustomerAddressResource::collection($user->addresses),
            'addressesCount' => $user->addresses->count(),
            'orders' => $this->orders($user),
            'ordersCount' => $this->ordersCount($user),
        ];
    }

    /**
     * Ringkasan 10 order terbaru customer (kontrak 11.4 `orders[]` ringkas).
     *
     * @return array<int, array<string, mixed>>
     */
    public function orders(User $user): array
    {
        return $user->orders()->withCount('items')->orderByDesc('created_at')->orderByDesc('id')->limit(10)->get()
            ->map(fn (Order $order) => [
                'number' => $order->number,
                'invoiceNumber' => $order->invoice_number,
                'date' => optional($order->created_at)->toApiString(),
                'status' => $order->status,
                'paymentStatus' => $order->payment_status,
                'itemsCount' => (int) $order->items_count,
                'currency' => $order->currencyCode(),
                'grandTotal' => $order->grandTotalInt(),
                'paidAt' => optional($order->paid_at)->toApiString(),
                // Cara serah terima ringkas untuk label status per varian (pickup/port), sama dengan OrderSummaryResource.
                'deliveryTerm' => $this->deliveryTerm($order),
            ])->values()->all();
    }

    /** @return array{code: string, family: string|null}|null */
    private function deliveryTerm(Order $order): ?array
    {
        $shipping = $order->shipping_snapshot ?? [];
        $code = $order->delivery_term ?: ($shipping['term'] ?? null);
        if (! $code) {
            return null;
        }
        $family = $shipping['family'] ?? null;
        if ($family === null) {
            $family = $order->isPickup() ? 'pickup' : ($order->isPort() ? 'port' : null);
        }

        return ['code' => $code, 'family' => $family];
    }

    public function ordersCount(User $user): int
    {
        return $user->orders()->count();
    }
}
