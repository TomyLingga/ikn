@extends('mail.layout', ['title' => __('account.mail.approved.subject')])

@section('content')
    <p style="margin:0 0 16px;">{{ __('account.mail.greeting', ['name' => $user->name]) }}</p>
    <p style="margin:0 0 16px;">{{ __('account.mail.approved.intro', ['company' => $company]) }}</p>
    @include('mail.partials.button', ['url' => $url, 'label' => __('account.mail.approved.button')])
@endsection
