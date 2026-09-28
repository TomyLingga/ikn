<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\Product;
use App\Support\I18n;
use App\Support\I18nList;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ProductRequest extends FormRequest
{
    use CatalogAttributes;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $product = $this->route('product');

        return array_merge([
            'slug' => ['nullable', 'string', 'max:160', Rule::unique('products', 'slug')->ignore($product?->id)],
            'code' => ['required', 'string', 'max:64', Rule::unique('products', 'code')->ignore($product?->id)],
            'categoryId' => ['required', 'integer', 'exists:categories,id'],
            'kind' => ['nullable', 'string', 'max:120'],
            'specs' => ['nullable', 'array', 'max:60'],
            'specs.*' => ['array', 'size:2'],
            'specs.*.*' => ['nullable', 'string', 'max:300'],
            'solubility' => ['nullable', 'array', 'max:60'],
            'solubility.*' => ['array', 'size:2'],
            'solubility.*.*' => ['nullable', 'string', 'max:300'],
            'aliases' => ['nullable', 'array', 'max:40'],
            'aliases.*' => ['string', 'max:120'],
            'priceMode' => ['required', Rule::in(Product::PRICE_MODES)],
            'price' => ['nullable', 'integer', 'min:0', 'max:9999999999999', 'required_if:priceMode,'.Product::PRICE_MODE_FIXED],
            'promoPrice' => ['nullable', 'integer', 'min:0', 'max:9999999999999'],
            'promoStartsAt' => ['nullable', 'date'],
            'promoEndsAt' => ['nullable', 'date', 'after_or_equal:promoStartsAt'],
            'unit' => ['nullable', 'string', 'max:32'],
            'moq' => ['nullable', 'integer', 'min:1', 'max:1000000000'],
            'weightGram' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'stockStatus' => ['nullable', Rule::in(Product::STOCK_STATUSES)],
            'isTaxable' => ['nullable', 'boolean'],
            'isPublished' => ['nullable', 'boolean'],
            'images' => ['nullable', 'array', 'max:20'],
            'images.*' => ['integer', 'distinct', 'exists:media,id'],
        ], I18n::rules('name', true, 200), I18n::rules('summary', false, 3000), I18nList::rules('highlights'), I18nList::rules('applications'));
    }
}
