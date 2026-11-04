@extends('mail.layout', ['title' => __('commerce.mail.freight.accepted_admin.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $admin->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.accepted_admin.intro', [
        'total' => F::money($order->shippingTotalInt(), $order->currencyCode()),
        'number' => $order->number,
        'customer' => $order->customerName(),
        'by' => __('commerce.mail.freight.accepted_by.'.$acceptedBy),
        'grand' => F::money($order->grandTotalInt(), $order->currencyCode()),
        'due' => F::dateTime($order->payment_due_at),
    ]) }}</p>
    @include('mail.commerce.partials.freight-lines', ['quote' => $quote, 'order' => $order])
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $adminUrl, 'label' => __('commerce.mail.open_admin')])
@endsection
