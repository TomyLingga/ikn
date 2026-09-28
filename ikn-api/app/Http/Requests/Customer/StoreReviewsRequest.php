<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\Concerns\CommerceAttributes;
use Illuminate\Foundation\Http\FormRequest;

// POST /customer/orders/{number}/reviews: [{ productSlug, rating 1-5, body? }] (list di root) atau { reviews: [...] }.
class StoreReviewsRequest extends FormRequest
{
    use CommerceAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function validationData(): array
    {
        $all = $this->all();

        return array_is_list($all) ? ['reviews' => $all] : $all;
    }

    public function rules(): array
    {
        return [
            'reviews' => ['required', 'array', 'min:1', 'max:100'],
            'reviews.*.productSlug' => ['required', 'string', 'max:160'],
            'reviews.*.rating' => ['required', 'integer', 'min:1', 'max:5'],
            'reviews.*.body' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /** @return array<int, array{productSlug:string, rating:int, body:?string}> */
    public function reviews(): array
    {
        return array_values($this->validated()['reviews']);
    }
}
