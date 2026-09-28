@extends('mail.layout', ['title' => __('commerce.mail.placed_admin.subject', ['number' => $order->number])])

@section('content')
    @php use App\Mail\Commerce\OrderMailable as F; @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $admin->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.placed_admin.intro', ['customer' => $order->customerName(), 'total' => F::money($order->grandTotalInt()), 'due' => F::dateTime($order->payment_due_at)]) }}</p>
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $adminUrl, 'label' => __('commerce.mail.open_admin')])
@endsection
