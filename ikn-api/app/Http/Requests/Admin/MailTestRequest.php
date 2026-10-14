<?php

namespace App\Http\Requests\Admin;

use App\Services\Cms\SettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST /admin/site-settings/mail-test: kirim email uji ke `to` memakai `mail` dari form (belum disimpan) atau
// pengaturan tersimpan bila `mail` tidak dikirim. `mail.password` boleh SECRET_MASK = pakai password tersimpan.
class MailTestRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'to' => ['required', 'email', 'max:190'],
            'mail' => ['nullable', 'array'],
            'mail.mode' => ['nullable', Rule::in(SettingsService::MAIL_MODES)],
            'mail.host' => ['required_if:mail.mode,smtp', 'nullable', 'string', 'max:255'],
            'mail.port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'mail.encryption' => ['nullable', Rule::in(SettingsService::MAIL_ENCRYPTIONS)],
            'mail.username' => ['nullable', 'string', 'max:255'],
            'mail.password' => ['nullable', 'string', 'max:255'],
            'mail.from_address' => ['required_if:mail.mode,smtp', 'nullable', 'email', 'max:190'],
            'mail.from_name' => ['nullable', 'string', 'max:120'],
        ];
    }
}
