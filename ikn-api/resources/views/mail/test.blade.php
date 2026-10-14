@extends('mail.layout', ['title' => __('account.mail.test.subject')])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.test.intro') }}</p>
    <p style="margin:0 0 16px;"><strong>{{ __('account.mail.test.ok') }}</strong></p>
    <p style="margin:0;font-size:13px;color:#6b7280;">{{ __('account.mail.test.meta', ['name' => $sender, 'time' => $time, 'via' => $via]) }}</p>
@endsection
