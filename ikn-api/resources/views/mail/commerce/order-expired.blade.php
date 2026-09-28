@extends('mail.layout', ['title' => __('commerce.mail.expired.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.expired.intro') }}</p>
    @include('mail.commerce.partials.summary', ['order' => $order])
    <p style="margin:0 0 16px;">{{ __('commerce.mail.expired.again') }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
