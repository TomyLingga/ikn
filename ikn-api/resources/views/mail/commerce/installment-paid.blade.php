@extends('mail.layout', ['title' => $subjectLine])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ $intro }}</p>
    @include('mail.commerce.partials.installments', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
