@extends('mail.layout', ['title' => __('account.mail.rejected.subject')])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $user->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('account.mail.rejected.intro') }}</p>
    @if ($reason)
        <p style="margin:0 0 4px;font-weight:bold;">{{ __('account.mail.rejected.reason') }}</p>
        <p style="margin:0 0 16px;padding:12px 16px;background-color:#fef2f2;border-left:4px solid #dc2626;">{{ $reason }}</p>
    @endif
    <p style="margin:0 0 16px;">{{ __('account.mail.rejected.contact') }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('account.mail.rejected.button')])
@endsection
