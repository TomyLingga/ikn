{{-- Rincian baris penawaran ongkir CIF (ASUMSI A-89). Pakai: @include('mail.commerce.partials.freight-lines', ['quote' => $quote, 'order' => $order]) --}}
@php
    use App\Mail\Commerce\OrderMailable as F;
    $currency = $order->currencyCode();
@endphp
@if ($quote)
<p style="margin:16px 0 8px;font-weight:bold;">{{ __('commerce.mail.freight.lines_label') }} ({{ __('commerce.mail.freight.round', ['round' => $quote->round]) }})</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;border-top:1px solid #e5e7eb;">
    @foreach ($quote->normalizedLines() as $line)
    <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">{{ $line['label'] }}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">{{ F::money($line['amount'], $currency) }}</td>
    </tr>
    @endforeach
    <tr>
        <td style="padding:10px 0;font-weight:bold;">{{ __('commerce.mail.freight.total_label') }}</td>
        <td style="padding:10px 0;text-align:right;font-weight:bold;">{{ F::money($quote->totalMinor(), $currency) }}</td>
    </tr>
    @if ($quote->valid_until)
    <tr>
        <td style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.freight.valid_until') }}</td>
        <td style="padding:6px 0;text-align:right;">{{ F::dateTime($quote->valid_until) }}</td>
    </tr>
    @endif
    @if ($quote->note)
    <tr>
        <td style="padding:6px 0;color:#6b7280;vertical-align:top;">{{ __('commerce.mail.freight.note') }}</td>
        <td style="padding:6px 0;text-align:right;white-space:pre-line;">{{ $quote->note }}</td>
    </tr>
    @endif
</table>
@endif
