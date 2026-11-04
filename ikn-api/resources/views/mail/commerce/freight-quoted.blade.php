@extends('mail.layout', ['title' => __('commerce.mail.freight.quoted.'.($extended ? 'subject_extended' : 'subject'), ['number' => $order->number])])

@section('content')
    @php
        use App\Mail\Commerce\OrderMailable as F;
        use App\Services\Commerce\OrderCalculator;
        $estimated = OrderCalculator::grandTotalOf($order->subtotalInt(), $order->discountTotalInt(), $quote->totalMinor(), $order->feeTotalInt(), $order->taxTotalInt(), (bool) $order->price_includes_tax, (int) $order->unique_code);
    @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    @if ($extended)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.quoted.intro_extended', ['until' => F::dateTime($quote->valid_until)]) }}</p>
    @else
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.quoted.intro', ['port' => $port['name'] ?? '-']) }}</p>
    @endif
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;font-size:14px;">
        <tr>
            <td style="padding:6px 0;color:#6b7280;width:45%;">{{ __('commerce.mail.order_label') }}</td>
            <td style="padding:6px 0;font-weight:bold;">{{ $order->number }}</td>
        </tr>
        @if ($port)
        <tr>
            <td style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.freight.destination_port') }}</td>
            <td style="padding:6px 0;">{{ $port['name'] }}@if (! empty($port['country'])), {{ $port['country'] }}@endif</td>
        </tr>
        @endif
    </table>
    @include('mail.commerce.partials.freight-lines', ['quote' => $quote, 'order' => $order])
    <p style="margin:16px 0 8px;"><strong>{{ __('commerce.mail.freight.quoted.grand_total') }}:</strong> {{ F::money($estimated, $order->currencyCode()) }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
