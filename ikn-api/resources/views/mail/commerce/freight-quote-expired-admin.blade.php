@extends('mail.layout', ['title' => __('commerce.mail.freight.expired_admin.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $admin->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.expired_admin.intro', [
        'round' => $quote->round,
        'number' => $order->number,
        'customer' => $order->customerName(),
        'until' => F::dateTime($quote->valid_until),
    ]) }}</p>
    @include('mail.commerce.partials.freight-lines', ['quote' => $quote, 'order' => $order])
    @include('mail.partials.button', ['url' => $adminUrl, 'label' => __('commerce.mail.open_admin')])
@endsection
