<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\StockMovement;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

// POST /admin/products/{id}/stock: { type: in|adjust, qty, note } (kontrak 11.3). adjust boleh negatif.
class StockMovementRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(StockMovement::ADMIN_TYPES)],
            'qty' => ['required', 'integer', 'not_in:0', 'min:-1000000000', 'max:1000000000'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
