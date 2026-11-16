@extends('mail.layout', ['title' => __('commerce.mail.payment_received.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $admin->name]) }}</p>
    {{-- Payment termin (ASUMSI A-97): sebut termin mana yang dibayar. --}}
    @if ($payment->installment)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_received.intro_installment', ['customer' => $order->customerName(), 'number' => $order->number, 'method' => $payment->method, 'total' => F::money($payment->amountInt(), $payment->currencyCode()), 'label' => $payment->installment->labelText($locale ?? null)]) }}</p>
    @else
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_received.intro', ['customer' => $order->customerName(), 'number' => $order->number, 'method' => $payment->method, 'total' => F::money($payment->amountInt(), $payment->currencyCode())]) }}</p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $adminUrl, 'label' => __('commerce.mail.open_admin')])
@endsection
