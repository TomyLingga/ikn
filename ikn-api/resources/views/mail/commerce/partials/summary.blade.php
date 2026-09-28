{{-- Ringkasan order untuk email: item + total. Pakai: @include('mail.commerce.partials.summary', ['order' => $order]) --}}
@php
    use App\Mail\Commerce\OrderMailable as F;
    $lang = $locale ?? app()->getLocale();
    $pick = fn ($value) => is_array($value) ? ($value[$lang] ?? $value['id'] ?? reset($value) ?: '') : (string) $value;
@endphp
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;font-size:14px;">
    <tr>
        <td style="padding:6px 0;color:#6b7280;width:45%;">{{ __('commerce.mail.order_label') }}</td>
        <td style="padding:6px 0;font-weight:bold;">{{ $order->number }}</td>
    </tr>
    @if ($order->invoice_number)
    <tr>
        <td style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.invoice_label') }}</td>
        <td style="padding:6px 0;font-weight:bold;">{{ $order->invoice_number }}</td>
    </tr>
    @endif
    <tr>
        <td style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.customer') }}</td>
        <td style="padding:6px 0;">{{ $order->customerName() }}</td>
    </tr>
</table>

<p style="margin:16px 0 8px;font-weight:bold;">{{ __('commerce.mail.items_label') }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;border-top:1px solid #e5e7eb;">
    @foreach ($order->items as $item)
    <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">{{ $pick($item->productName()) }}<br><span style="color:#6b7280;font-size:12px;">{{ $item->product_snapshot['code'] ?? '' }}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap;">{{ $item->qty }} {{ $item->product_snapshot['unit'] ?? '' }}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">{{ F::money($item->lineTotalInt()) }}</td>
    </tr>
    @endforeach
    <tr><td colspan="2" style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.subtotal') }}</td><td style="padding:6px 0;text-align:right;">{{ F::money($order->subtotalInt()) }}</td></tr>
    @if ($order->discountTotalInt() > 0)
    <tr><td colspan="2" style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.discount') }}@if ($order->voucher_code) ({{ $order->voucher_code }})@endif</td><td style="padding:6px 0;text-align:right;">- {{ F::money($order->discountTotalInt()) }}</td></tr>
    @endif
    <tr><td colspan="2" style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.shipping') }}</td><td style="padding:6px 0;text-align:right;">{{ F::money($order->shippingTotalInt()) }}</td></tr>
    @if ($order->feeTotalInt() > 0)
    <tr><td colspan="2" style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.fee') }}</td><td style="padding:6px 0;text-align:right;">{{ F::money($order->feeTotalInt()) }}</td></tr>
    @endif
    @if ($order->taxTotalInt() > 0)
    <tr><td colspan="2" style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.tax', ['rate' => $order->taxRateNumber()]) }}@if ($order->price_includes_tax) ({{ __('commerce.mail.tax_included') }})@endif</td><td style="padding:6px 0;text-align:right;">{{ F::money($order->taxTotalInt()) }}</td></tr>
    @endif
    @if ((int) $order->unique_code > 0)
    <tr><td colspan="2" style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.unique_code') }}</td><td style="padding:6px 0;text-align:right;">{{ F::money((int) $order->unique_code) }}</td></tr>
    @endif
    <tr><td colspan="2" style="padding:10px 0;font-weight:bold;border-top:1px solid #e5e7eb;">{{ __('commerce.mail.grand_total') }}</td><td style="padding:10px 0;text-align:right;font-weight:bold;border-top:1px solid #e5e7eb;">{{ F::money($order->grandTotalInt()) }}</td></tr>
</table>
