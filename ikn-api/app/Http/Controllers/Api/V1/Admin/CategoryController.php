<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\CategoryRequest;
use App\Http\Resources\CategoryResource;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// Kategori produk (kontrak 11.3). Hapus ditolak 409 CATEGORY_IN_USE bila masih ada produk (termasuk yang soft-deleted).
class CategoryController extends ApiController
{
    public function index(Request $request)
    {
        $categories = Category::with('image')
            ->withCount(['products' => fn ($q) => $q->withTrashed()])
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(function ($w) use ($like) {
                    $w->where('name->id', 'ilike', $like)->orWhere('name->en', 'ilike', $like)->orWhere('slug', 'ilike', $like);
                });
            })
            ->orderBy('sort_order')->orderBy('id')->get();

        return $this->data(CategoryResource::collection($categories));
    }

    public function store(CategoryRequest $request)
    {
        $category = Category::create($this->attributes($request->validated(), null));

        return $this->created(new CategoryResource($category->load('image')->loadCount('products')));
    }

    public function update(CategoryRequest $request, Category $category)
    {
        $category->update($this->attributes($request->validated(), $category));

        return $this->data(new CategoryResource($category->fresh('image')->loadCount('products')));
    }

    public function destroy(Category $category)
    {
        if ($category->products()->withTrashed()->exists()) {
            throw ApiException::conflict('CATEGORY_IN_USE', __('catalog.category_in_use'));
        }

        $category->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?Category $existing): array
    {
        $attributes = [
            'slug' => $this->slug($data['slug'] ?? null, $data['name']['id'] ?? '', $existing),
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'image_media_id' => array_key_exists('imageMediaId', $data) ? $data['imageMediaId'] : ($existing->image_media_id ?? null),
        ];
        if (array_key_exists('sortOrder', $data)) {
            $attributes['sort_order'] = (int) ($data['sortOrder'] ?? 0);
        }
        if (array_key_exists('isActive', $data)) {
            $attributes['is_active'] = (bool) $data['isActive'];
        }

        return $attributes;
    }

    private function slug(?string $slug, string $name, ?Category $existing): string
    {
        $base = Str::slug($slug ?: $name) ?: 'kategori';
        $candidate = $base;
        $i = 2;
        while (Category::where('slug', $candidate)->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))->exists()) {
            $candidate = $base.'-'.$i++;
        }

        return $candidate;
    }
}
