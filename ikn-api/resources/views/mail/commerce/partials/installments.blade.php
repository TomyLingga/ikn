{{-- Jadwal termin order (ASUMSI A-97); kosong untuk order tanpa termin. Pakai: @include('mail.commerce.partials.installments', ['order' => $order]) --}}
@php
    use App\Mail\Commerce\OrderMailable as F;
    use App\Models\OrderInstallment as Row;
    $lang = $locale ?? app()->getLocale();
    $rows = $order->installmentRows();
    $progress = $order->paymentProgress();
@endphp
@if ($rows->isNotEmpty())
<p style="margin:16px 0 8px;font-weight:bold;">{{ __('commerce.mail.installment.schedule_label') }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;font-size:14px;border-top:1px solid #e5e7eb;">
    @foreach ($rows as $row)
    @php
        if ($row->status === Row::STATUS_SCHEDULED) {
            $state = __('commerce.mail.installment.billed_on.'.$row->trigger);
        } elseif ($row->status === Row::STATUS_PAID) {
            $state = __('commerce.mail.installment.status.paid').($row->paid_at ? ', '.F::dateTime($row->paid_at) : '');
        } elseif ($row->status === Row::STATUS_DUE) {
            $state = __('commerce.mail.installment.status.'.($row->isOverdue() ? 'overdue' : 'due')).($row->due_at ? ', '.__('commerce.mail.installment.due_label').' '.F::dateTime($row->due_at) : '');
        } else {
            $state = __('commerce.mail.installment.status.'.$row->status);
        }
    @endphp
    <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">{{ $row->labelText($lang) }} ({{ $row->percentNumber() }}%)<br><span style="color:#6b7280;font-size:12px;">{{ $state }}</span></td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">{{ F::money($row->amountInt(), $row->currencyCode()) }}</td>
    </tr>
    @endforeach
    <tr><td style="padding:6px 0;color:#6b7280;">{{ __('commerce.mail.installment.paid_total') }}</td><td style="padding:6px 0;text-align:right;">{{ F::money($progress['paidTotal'], $progress['currency']) }}</td></tr>
    <tr><td style="padding:6px 0;font-weight:bold;">{{ __('commerce.mail.installment.outstanding') }}</td><td style="padding:6px 0;text-align:right;font-weight:bold;">{{ F::money($progress['outstandingTotal'], $progress['currency']) }}</td></tr>
</table>
@endif
