@extends('mail.layout', ['title' => __('commerce.mail.proforma.subject', ['label' => $label, 'number' => $order->number])])

@section('content')
    @php
        $date = fn ($value) => $value ? $value->format('d M Y') : null;
        $rows = array_filter([
            __('commerce.mail.proforma.vessel') => $proforma->vessel_name,
            __('commerce.mail.proforma.voyage') => $proforma->voyage,
            __('commerce.mail.proforma.etd') => $date($proforma->etd),
            __('commerce.mail.proforma.eta') => $date($proforma->eta),
            __('commerce.mail.proforma.port_of_loading') => $proforma->port_of_loading,
            __('commerce.mail.proforma.port_of_discharge') => $proforma->port_of_discharge,
            __('commerce.mail.proforma.payment_terms') => $proforma->payment_terms,
            __('commerce.mail.proforma.valid_until') => $date($proforma->valid_until),
            __('commerce.mail.proforma.notes') => $proforma->notes,
        ], fn ($value) => $value !== null && $value !== '');
    @endphp
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $order->customerPic() ?: $order->customerName()]) }}</p>
    <p style="margin:0 0 16px;">{{ __($proforma->revision > 1 ? 'commerce.mail.proforma.intro_revised' : 'commerce.mail.proforma.intro', ['label' => $label]) }}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-collapse:collapse;font-size:14px;">
        <tr>
            <td style="padding:6px 0;color:#6b7280;width:45%;">{{ __('commerce.mail.order_label') }}</td>
            <td style="padding:6px 0;font-weight:bold;">{{ $order->number }}</td>
        </tr>
        @foreach ($rows as $rowLabel => $value)
        <tr>
            <td style="padding:6px 0;color:#6b7280;vertical-align:top;">{{ $rowLabel }}</td>
            <td style="padding:6px 0;white-space:pre-line;">{{ $value }}</td>
        </tr>
        @endforeach
    </table>
    @include('mail.partials.button', ['url' => $url, 'label' => __('commerce.mail.view_order')])
@endsection
