{{-- Layout email bermerek PT IKN. Bahasa mengikuti locale Mailable (users.locale); dipakai BE-1 dan BE-3. --}}
<!DOCTYPE html>
<html lang="{{ $locale ?? app()->getLocale() }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title ?? config('app.name', 'PT Industri Karet Nusantara') }}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
        <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
                <tr>
                    {{-- Warna header mengikuti theme.primary_deep di Pengaturan Situs (kosong = biru tua bawaan) --}}
                    <td style="background-color:{{ app(\App\Services\Cms\SettingsService::class)->get('theme.primary_deep') ?: '#0a3f6b' }};padding:20px 32px;">
                        <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.3px;">PT Industri Karet Nusantara</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding:32px;font-size:15px;line-height:1.6;color:#1f2937;">
                        @yield('content')
                        <p style="margin:28px 0 0;">
                            {{ __('account.mail.regards') }}<br>
                            <strong>{{ __('account.mail.team') }}</strong>
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:16px 32px;background-color:#f9fafb;font-size:12px;line-height:1.5;color:#6b7280;border-top:1px solid #e5e7eb;">
                        {{ __('account.mail.footer') }}
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
