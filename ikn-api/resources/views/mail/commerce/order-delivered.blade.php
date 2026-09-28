@extends('mail.layout', ['title' => __('commerce.mail.delivered.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.delivered.intro') }}</p>
    @if ($autoCompleteDays > 0)
    <p style="margin:0 0 16px;color:#6b7280;">{{ __('commerce.mail.delivered.auto', ['days' => $autoCompleteDays]) }}</p>
    @endif
    @include('mail.commerce.partials.summary', ['order' => $order])
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
