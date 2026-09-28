{{-- Tombol aksi email + tautan cadangan. Pakai: @include('mail.partials.button', ['url' => ..., 'label' => ...]) --}}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
        <td style="border-radius:6px;background-color:#16a34a;">
            <a href="{{ $url }}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:6px;">{{ $label }}</a>
        </td>
    </tr>
</table>
<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">{{ __('account.mail.button_fallback') }}</p>
<p style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="{{ $url }}" style="color:#15803d;">{{ $url }}</a></p>
