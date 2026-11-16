@extends('mail.layout', ['title' => __('commerce.mail.payment_accepted.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    {{-- Order bertermin (ASUMSI A-97): yang diterima baru termin pertama; sisa tagihan mengikuti jadwal. --}}
    @php
        $first = $order->firstInstallment();
        $partial = $first && $order->hasUnpaidInstallments();
    @endphp
    @if ($partial)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_accepted.intro_installment', ['label' => $first->labelText($locale ?? null), 'amount' => \App\Mail\Commerce\OrderMailable::money($first->amountInt(), $first->currencyCode())]) }}</p>
    @else
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_accepted.intro') }}</p>
    @endif
    @if ($order->invoice_number)
    <p style="margin:0 0 16px;"><strong>{{ __('commerce.mail.payment_accepted.invoice', ['invoice' => $order->invoice_number]) }}</strong></p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.commerce.partials.installments', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
