<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\CategoryResource;
use App\Http\Resources\ProductResource;
use App\Http\Resources\ReviewResource;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\Request;

// Katalog publik (kontrak bagian 6): hanya kategori aktif dan produk published.
class CatalogController extends ApiController
{
    public function categories()
    {
        $categories = Category::active()->with('image')
            ->withCount(['products' => fn ($q) => $q->published()])
            ->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(CategoryResource::collection($categories));
    }

    public function products(Request $request)
    {
        $query = Product::published()->with(['category', 'images.media'])
            ->search($request->query('q'))
            ->when($request->query('category'), function ($q, $slug) {
                $q->whereHas('category', fn ($c) => $c->where('slug', $slug)->orWhere('id', is_numeric($slug) ? (int) $slug : 0));
            });

        switch ($request->query('sort')) {
            case 'name':
                $query->orderBy('name->id')->orderBy('id');
                break;
            case 'price':
                $query->orderByRaw('price ASC NULLS LAST')->orderBy('id');
                break;
            case 'newest':
                $query->orderByDesc('created_at')->orderByDesc('id');
                break;
            default:
                $query->orderBy('id');
        }

        return $this->paginated($query->paginate($this->perPage(20)), ProductResource::class);
    }

    public function product(string $slug)
    {
        $product = Product::published()->with(['category', 'images.media'])->where('slug', $slug)->firstOrFail();

        $reviews = $product->reviews()->published()->with('user')->orderByDesc('created_at')->orderByDesc('id')->limit(10)->get();
        $related = Product::published()->with(['category', 'images.media'])
            ->where('category_id', $product->category_id)->where('id', '!=', $product->id)
            ->orderBy('id')->limit(4)->get();

        return $this->data((new ProductResource($product))->resolve() + [
            'reviews' => ReviewResource::collection($reviews)->resolve(),
            'related' => ProductResource::collection($related)->resolve(),
        ]);
    }

    public function reviews(string $slug)
    {
        $product = Product::published()->where('slug', $slug)->firstOrFail();
        $paginator = $product->reviews()->published()->with('user')
            ->orderByDesc('created_at')->orderByDesc('id')
            ->paginate($this->perPage(10));

        return $this->paginated($paginator, ReviewResource::class);
    }
}
