@extends('mail.layout', ['title' => __('account.mail.verify.subject')])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $user->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('account.mail.verify.intro') }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('account.mail.verify.button')])
    <p style="margin:0 0 8px;">{{ __('account.mail.verify.expires', ['minutes' => $minutes]) }}</p>
    <p style="margin:0 0 8px;">{{ __('account.mail.verify.next') }}</p>
    <p style="margin:0;color:#6b7280;">{{ __('account.mail.verify.ignore') }}</p>
@endsection
