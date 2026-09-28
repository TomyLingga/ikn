<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ProductRequest;
use App\Http\Requests\Admin\PublishProductRequest;
use App\Http\Resources\AdminProductResource;
use App\Models\Product;
use App\Models\ProductImage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

// Produk (kontrak 11.3): CRUD + publish + gambar (images[] mediaId berurutan). Stok hanya lewat StockController/StockLedger.
class ProductController extends ApiController
{
    public function index(Request $request)
    {
        $query = Product::with(['category', 'images.media'])
            ->search($request->query('q'))
            ->when($request->query('category'), function ($q, $category) {
                $q->whereHas('category', fn ($c) => $c->where('slug', $category)->orWhere('id', is_numeric($category) ? (int) $category : 0));
            })
            ->when($request->query('published') !== null && $request->query('published') !== '', function ($q) use ($request) {
                $q->where('is_published', $request->boolean('published'));
            })
            ->when($request->boolean('trashed'), fn ($q) => $q->withTrashed())
            ->orderBy('id');

        return $this->paginated($query->paginate($this->perPage(20)), AdminProductResource::class);
    }

    public function store(ProductRequest $request)
    {
        $data = $request->validated();

        $product = DB::transaction(function () use ($data) {
            $product = Product::create($this->attributes($data, null));
            $this->syncImages($product, $data['images'] ?? []);

            return $product;
        });

        return $this->created(new AdminProductResource($product->fresh(['category', 'images.media'])));
    }

    public function show(Product $product)
    {
        return $this->data(new AdminProductResource($product->load(['category', 'images.media'])));
    }

    public function update(ProductRequest $request, Product $product)
    {
        $data = $request->validated();

        DB::transaction(function () use ($product, $data) {
            $product->update($this->attributes($data, $product));
            if (array_key_exists('images', $data)) {
                $this->syncImages($product, $data['images'] ?? []);
            }
        });

        return $this->data(new AdminProductResource($product->fresh(['category', 'images.media'])));
    }

    public function destroy(Product $product)
    {
        $product->delete(); // soft delete: ledger dan order_items tetap merujuk produk

        return $this->deleted();
    }

    public function publish(PublishProductRequest $request, Product $product)
    {
        $product->update(['is_published' => $request->boolean('isPublished')]);

        return $this->data(new AdminProductResource($product->fresh(['category', 'images.media'])));
    }

    private function attributes(array $data, ?Product $existing): array
    {
        $priceMode = $data['priceMode'];
        $isFixed = $priceMode === Product::PRICE_MODE_FIXED;

        $attributes = [
            'slug' => $this->slug($data['slug'] ?? null, $data['name']['id'] ?? '', $existing),
            'code' => trim($data['code']),
            'category_id' => (int) $data['categoryId'],
            'name' => $data['name'],
            'kind' => isset($data['kind']) ? trim($data['kind']) ?: null : null,
            'summary' => $data['summary'] ?? null,
            'highlights' => $data['highlights'] ?? [],
            'specs' => $this->pairs($data['specs'] ?? []),
            'applications' => $data['applications'] ?? [],
            'solubility' => $this->pairs($data['solubility'] ?? []),
            'aliases' => array_values(array_filter(array_map(fn ($a) => trim((string) $a), $data['aliases'] ?? []), fn ($a) => $a !== '')),
            'price_mode' => $priceMode,
            'price' => $isFixed ? (int) ($data['price'] ?? 0) : null,
            'promo_price' => $isFixed && isset($data['promoPrice']) ? (int) $data['promoPrice'] : null,
            'promo_starts_at' => $isFixed ? ($data['promoStartsAt'] ?? null) : null,
            'promo_ends_at' => $isFixed ? ($data['promoEndsAt'] ?? null) : null,
            'unit' => isset($data['unit']) && trim($data['unit']) !== '' ? trim($data['unit']) : ($existing->unit ?? 'pcs'),
            'moq' => (int) ($data['moq'] ?? ($existing->moq ?? 1)),
            'weight_gram' => (int) ($data['weightGram'] ?? ($existing->weight_gram ?? 1000)),
            'is_taxable' => array_key_exists('isTaxable', $data) ? (bool) $data['isTaxable'] : ($existing->is_taxable ?? true),
            'is_published' => array_key_exists('isPublished', $data) ? (bool) $data['isPublished'] : ($existing->is_published ?? false),
        ];

        // Status stok: made_to_order diatur manual; nilai lain diturunkan otomatis dari available (Product::saving).
        if (array_key_exists('stockStatus', $data) && $data['stockStatus'] !== null) {
            $attributes['stock_status'] = $data['stockStatus'];
        } elseif (! $existing) {
            $attributes['stock_status'] = Product::STOCK_OUT_OF_STOCK;
        }

        return $attributes;
    }

    /** [[k,v]] dengan pasangan kosong dibuang. */
    private function pairs(array $rows): array
    {
        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $k = trim((string) ($row[0] ?? ''));
            $v = trim((string) ($row[1] ?? ''));
            if ($k !== '' || $v !== '') {
                $out[] = [$k, $v];
            }
        }

        return $out;
    }

    /** Sinkronkan gambar: urutan = sort_order; media yang tidak ada di daftar dilepas (media-nya tidak dihapus). */
    private function syncImages(Product $product, array $mediaIds): void
    {
        $mediaIds = array_values(array_unique(array_map('intval', $mediaIds)));

        ProductImage::where('product_id', $product->id)->whereNotIn('media_id', $mediaIds ?: [0])->delete();

        foreach ($mediaIds as $sort => $mediaId) {
            ProductImage::updateOrCreate(
                ['product_id' => $product->id, 'media_id' => $mediaId],
                ['sort_order' => $sort]
            );
        }
    }

    private function slug(?string $slug, string $name, ?Product $existing): string
    {
        $base = Str::slug($slug ?: $name) ?: 'produk';
        $candidate = $base;
        $i = 2;
        while (Product::withTrashed()->where('slug', $candidate)->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))->exists()) {
            $candidate = $base.'-'.$i++;
        }

        return $candidate;
    }
}
