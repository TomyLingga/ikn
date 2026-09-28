@extends('mail.layout', ['title' => __('commerce.mail.placed.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.placed.intro', ['due' => F::dateTime($order->payment_due_at)]) }}</p>
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.commerce.partials.payment-instructions', ['payment' => $payment, 'order' => $order])
    <p style="margin:0 0 8px;"><strong>{{ __('commerce.mail.due_label') }}:</strong> {{ F::dateTime($order->payment_due_at) }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
