@extends('mail.layout', ['title' => __('commerce.mail.payment_accepted.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_accepted.intro') }}</p>
    @if ($order->invoice_number)
    <p style="margin:0 0 16px;"><strong>{{ __('commerce.mail.payment_accepted.invoice', ['invoice' => $order->invoice_number]) }}</strong></p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
