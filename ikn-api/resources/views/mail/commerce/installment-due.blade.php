@extends('mail.layout', ['title' => $subjectLine])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ $intro }}</p>
    @include('mail.commerce.partials.payment-instructions', ['payment' => $payment, 'order' => $order])
    <p style="margin:0 0 8px;"><strong>{{ __('commerce.mail.installment.due_label') }}:</strong> {{ F::dateTime($installment->due_at) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.installment.due.upload') }}</p>
    @include('mail.commerce.partials.installments', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
