<?php

namespace App\Http\Requests\Admin;

use App\Http\Requests\Concerns\CatalogAttributes;
use App\Models\Media;
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

    /** images[] boleh foto atau video dari media library (disk public); thumbnail wajib foto di dalam daftar itu. */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            $ids = array_map('intval', (array) $this->input('images', []));
            $thumbnailId = $this->input('thumbnailMediaId');
            if ($ids === [] && $thumbnailId === null) {
                return;
            }

            $media = Media::whereIn('id', $ids)->get()->keyBy('id');
            foreach ($ids as $i => $id) {
                $item = $media->get($id);
                if (! $item || ! $item->isPublic() || ! ($item->isImage() || $item->isVideo())) {
                    $validator->errors()->add("images.$i", __('catalog.product_media_invalid'));
                }
            }

            if ($thumbnailId !== null) {
                $thumbnail = $media->get((int) $thumbnailId);
                if (! $thumbnail || ! $thumbnail->isImage()) {
                    $validator->errors()->add('thumbnailMediaId', __('catalog.product_thumbnail_invalid'));
                }
            }
        });
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
            'lengthCm' => ['nullable', 'numeric', 'min:0.1', 'max:100000'],
            'widthCm' => ['nullable', 'numeric', 'min:0.1', 'max:100000'],
            'heightCm' => ['nullable', 'numeric', 'min:0.1', 'max:100000'],
            'stockStatus' => ['nullable', Rule::in(Product::STOCK_STATUSES)],
            'isTaxable' => ['nullable', 'boolean'],
            'isPublished' => ['nullable', 'boolean'],
            'images' => ['nullable', 'array', 'max:20'],
            'images.*' => ['integer', 'distinct', 'exists:media,id'],
            // Foto yang menjadi thumbnail; harus salah satu dari images[] dan berupa gambar (ASUMSI A-72).
            'thumbnailMediaId' => ['nullable', 'integer'],
        ], I18n::rules('name', true, 200), I18n::rules('summary', false, 3000), I18nList::rules('highlights'), I18nList::rules('applications'));
    }
}
