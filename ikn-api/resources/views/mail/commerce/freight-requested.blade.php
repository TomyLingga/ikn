@extends('mail.layout', ['title' => __('commerce.mail.freight.requested.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.requested.intro', ['port' => $port['name'] ?? '-']) }}</p>
    @if ($port)
    <p style="margin:0 0 16px;"><strong>{{ __('commerce.mail.freight.destination_port') }}:</strong> {{ $port['name'] }}@if (! empty($port['country'])), {{ $port['country'] }}@endif</p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.requested.next') }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
