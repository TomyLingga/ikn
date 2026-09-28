@extends('mail.layout', ['title' => __('commerce.mail.payment_rejected.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_rejected.intro') }}</p>
    <p style="margin:0 0 4px;color:#6b7280;">{{ __('commerce.mail.payment_rejected.reason') }}</p>
    <p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;">{{ $reason }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_rejected.retry', ['due' => F::dateTime($order->payment_due_at)]) }}</p>
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
