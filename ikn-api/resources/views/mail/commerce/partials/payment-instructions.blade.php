{{-- Instruksi bayar dari payments.payload (driver manual). Pakai: @include(..., ['payment' => $payment, 'order' => $order]) --}}
@php
    use App\Mail\Commerce\OrderMailable as F;
    $lang = $locale ?? app()->getLocale();
    $payload = $payment?->payload ?? [];
    $instructions = $payload['instructions'] ?? null;
    $instructionText = is_array($instructions) ? ($instructions[$lang] ?? $instructions['id'] ?? '') : (string) $instructions;
    $bank = $payload['bankAccount'] ?? null;
@endphp
@if ($payment)
<div style="margin:16px 0;padding:16px;background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;">
    <p style="margin:0 0 8px;font-weight:bold;">{{ __('commerce.mail.placed.instructions') }}</p>
    @if ($instructionText !== '')
    <p style="margin:0 0 12px;">{{ $instructionText }}</p>
    @endif
    @if ($bank)
    <p style="margin:0 0 4px;color:#6b7280;">{{ __('commerce.mail.placed.bank') }}</p>
    <p style="margin:0 0 12px;font-weight:bold;">{{ $bank['bankName'] ?? '' }} {{ $bank['accountNumber'] ?? '' }}<br>a.n. {{ $bank['accountHolder'] ?? '' }}</p>
    @endif
    @if (! empty($payload['qrisImageUrl']))
    <p style="margin:0 0 12px;"><img src="{{ $payload['qrisImageUrl'] }}" alt="QRIS" style="max-width:240px;height:auto;"></p>
    @endif
    @if (! empty($payload['accountNumber']))
    <p style="margin:0 0 12px;font-weight:bold;">{{ $payload['bankCode'] ?? '' }} VA {{ $payload['accountNumber'] }}</p>
    @endif
    @if (! empty($payload['checkoutUrl']))
    <p style="margin:0 0 12px;"><a href="{{ $payload['checkoutUrl'] }}" style="color:#15803d;">{{ $payload['checkoutUrl'] }}</a></p>
    @endif
    <p style="margin:0 0 4px;color:#6b7280;">{{ (int) $order->unique_code > 0 ? __('commerce.mail.placed.amount') : __('commerce.mail.placed.amount_plain') }}</p>
    <p style="margin:0;font-size:20px;font-weight:bold;color:#14532d;">{{ F::money($payment->amountInt()) }}</p>
</div>
@endif
