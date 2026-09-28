@extends('mail.layout', ['title' => __('commerce.mail.cancelled.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.cancelled.intro') }}</p>
    @if ($reason)
    <p style="margin:0 0 4px;color:#6b7280;">{{ __('commerce.mail.cancelled.reason') }}</p>
    <p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;">{{ $reason }}</p>
    @endif
    @if ($wasPaid)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.cancelled.refund') }}</p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
