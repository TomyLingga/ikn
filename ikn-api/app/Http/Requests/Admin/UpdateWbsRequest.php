<?php

namespace App\Http\Requests\Admin;

use App\Models\WbsReport;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateWbsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', 'required', Rule::in(WbsReport::STATUSES)],
            'adminNotes' => ['sometimes', 'nullable', 'string', 'max:5000'],
        ];
    }
}
