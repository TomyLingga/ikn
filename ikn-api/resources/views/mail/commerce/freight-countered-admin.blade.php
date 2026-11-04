@extends('mail.layout', ['title' => __('commerce.mail.freight.countered_admin.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $admin->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.countered_admin.intro', [
        'customer' => $order->customerName(),
        'amount' => F::money($quote->totalMinor(), $order->currencyCode()),
        'number' => $order->number,
        'previous' => $previous ? F::money($previous->totalMinor(), $order->currencyCode()) : '-',
    ]) }}</p>
    @if ($quote->note)
    <p style="margin:0 0 4px;color:#6b7280;">{{ __('commerce.mail.freight.note') }}</p>
    <p style="margin:0 0 16px;padding:12px 16px;background-color:#f9fafb;border-left:4px solid #9ca3af;white-space:pre-line;">{{ $quote->note }}</p>
    @endif
    @if ($previous)
    @include('mail.commerce.partials.freight-lines', ['quote' => $previous, 'order' => $order])
    @endif
    @include('mail.partials.button', ['url' => $adminUrl, 'label' => __('commerce.mail.open_admin')])
@endsection
