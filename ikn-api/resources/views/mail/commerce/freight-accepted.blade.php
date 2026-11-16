@extends('mail.layout', ['title' => __('commerce.mail.freight.accepted.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.freight.accepted.intro', ['total' => F::money($order->shippingTotalInt(), $order->currencyCode()), 'due' => F::dateTime($order->payment_due_at)]) }}</p>
    @include('mail.commerce.partials.freight-lines', ['quote' => $quote, 'order' => $order])
    @include('mail.commerce.partials.summary', ['order' => $order])
    @if ($payment && ($first = $order->firstInstallment()))
    <p style="margin:0 0 16px;">{{ __('commerce.mail.installment.placed_intro', ['label' => $first->labelText($locale ?? null), 'amount' => F::money($first->amountInt(), $first->currencyCode())]) }}</p>
    @endif
    @include('mail.commerce.partials.payment-instructions', ['payment' => $payment, 'order' => $order])
    @include('mail.commerce.partials.installments', ['order' => $order])
    <p style="margin:0 0 8px;"><strong>{{ __('commerce.mail.due_label') }}:</strong> {{ F::dateTime($order->payment_due_at) }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
