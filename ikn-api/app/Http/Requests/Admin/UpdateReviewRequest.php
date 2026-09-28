<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use Illuminate\Foundation\Http\FormRequest;

// Moderasi ulasan (ASUMSI A-13): admin hanya menyembunyikan/menampilkan.
class UpdateReviewRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['isPublished' => ['required', 'boolean']];
    }
}
