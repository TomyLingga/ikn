@extends('mail.layout', ['title' => __('account.mail.reset.subject')])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $user->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('account.mail.reset.intro') }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('account.mail.reset.button')])
    <p style="margin:0 0 8px;">{{ __('account.mail.reset.expires', ['minutes' => $minutes]) }}</p>
    <p style="margin:0;color:#6b7280;">{{ __('account.mail.reset.ignore') }}</p>
@endsection
