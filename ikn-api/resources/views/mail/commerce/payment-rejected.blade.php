@extends('mail.layout', ['title' => __('commerce.mail.payment_rejected.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    {{-- Termin lanjutan (ASUMSI A-97): batas bayar order tidak berlaku, cukup unggah ulang di halaman pesanan. --}}
    @php $balance = $payment->isBalancePayment(); @endphp
    @if ($payment->installment)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_rejected.intro_installment', ['label' => $payment->installment->labelText($locale ?? null)]) }}</p>
    @else
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_rejected.intro') }}</p>
    @endif
    <p style="margin:0 0 4px;color:#6b7280;">{{ __('commerce.mail.payment_rejected.reason') }}</p>
    <p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;">{{ $reason }}</p>
    @if ($balance)
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_rejected.retry_installment') }}</p>
    @else
    <p style="margin:0 0 16px;">{{ __('commerce.mail.payment_rejected.retry', ['due' => F::dateTime($order->payment_due_at)]) }}</p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
