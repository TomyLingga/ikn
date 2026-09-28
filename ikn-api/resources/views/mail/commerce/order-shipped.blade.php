@extends('mail.layout', ['title' => __('commerce.mail.shipped.subject', ['number' => $order->number])])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __('commerce.mail.shipped.intro') }}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px;">
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.courier') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $order->courier }}</td></tr>
        <tr><td style="padding:4px 16px 4px 0;color:#6b7280;">{{ __('commerce.mail.shipped.tracking') }}</td><td style="padding:4px 0;font-weight:bold;">{{ $order->tracking_number }}</td></tr>
    </table>
    @include('mail.commerce.partials.summary', ['order' => $order])
    <p style="margin:0 0 16px;">{{ __('commerce.mail.shipped.confirm') }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
