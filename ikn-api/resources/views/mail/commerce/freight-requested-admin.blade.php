@extends('mail.layout', ['title' => __('commerce.mail.freight.requested_admin.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $admin->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.requested_admin.intro', ['customer' => $order->customerName(), 'port' => $port['name'] ?? '-', 'total' => F::money($order->grandTotalInt(), $order->currencyCode())]) }}</p>
    @if ($port)
    <p style="margin:0 0 16px;"><strong>{{ __('commerce.mail.freight.destination_port') }}:</strong> {{ $port['name'] }}@if (! empty($port['country'])), {{ $port['country'] }}@endif
        @if (isset($port['lat'], $port['lng']))<br><span style="color:#6b7280;font-size:12px;">{{ $port['lat'] }}, {{ $port['lng'] }}</span>@endif
    </p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $adminUrl, 'label' => __('commerce.mail.open_admin')])
@endsection
