@php
    $subjectKey = $pickup ? 'commerce.mail.shipped.subject_pickup' : (($onBoard ?? false) ? 'commerce.mail.shipped.subject_on_board' : 'commerce.mail.shipped.subject');
    $confirmKey = $pickup ? 'commerce.mail.shipped.confirm_pickup' : (($onBoard ?? false) ? 'commerce.mail.shipped.confirm_on_board' : 'commerce.mail.shipped.confirm');
    $shipment = $shipment ?? [];
@endphp
@extends('mail.layout', ['title' => __($subjectKey, ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    @if ($pickup)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.shipped.intro_pickup') }}</p>
    {{-- Satu blok per pabrik asal (ASUMSI A-90); order lama = satu titik dari field datar. --}}
    @foreach (($pickupPoints ?? []) ?: [$pickup] as $point)
    @php
        $pointName = is_array($point['name'] ?? null) ? trim((string) ($point['name'][app()->getLocale()] ?? '')) : '';
        $pointLabel = $pointName !== '' ? $pointName : ($point['label'] ?? '');
    @endphp
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.pickup_label') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $pointLabel ?: '-' }}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.pickup_address') }}</td><td style="padding:4px 0;">{{ ($point['address'] ?? '') ?: '-' }}</td></tr>
    </table>
    @endforeach
    @elseif ($onBoard ?? false)
    {{-- FOB/CIF (ASUMSI A-88): kapal, voyage, nomor dan tanggal B/L menggantikan kurir + resi. --}}
    <p style="margin:0 0 16px;">{{ __('commerce.mail.shipped.intro_on_board') }}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.vessel') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $shipment['vessel'] ?? '-' }}</td></tr>
        @if (! empty($shipment['voyage']))
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.voyage') }}</td><td style="padding:4px 0;">{{ $shipment['voyage'] }}</td></tr>
        @endif
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.bl_number') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $shipment['blNumber'] ?? $order->tracking_number ?? '-' }}</td></tr>
        @if (! empty($shipment['blDate']))
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.bl_date') }}</td><td style="padding:4px 0;">{{ \Illuminate\Support\Carbon::parse($shipment['blDate'])->format('d M Y') }}</td></tr>
        @endif
    </table>
    @else
    <p style="margin:0 0 16px;">{{ __('commerce.mail.shipped.intro') }}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.courier') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $order->courier }}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.tracking') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $order->tracking_number }}</td></tr>
    </table>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    <p style="margin:0 0 16px;">{{ __($confirmKey) }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
