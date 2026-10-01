<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\PostCategoryRequest;
use App\Http\Resources\PostCategoryResource;
use App\Models\PostCategory;
use App\Support\I18n;
use Illuminate\Support\Str;

// Kategori berita (modul news). Menghapus kategori melepas berita di dalamnya (category_id -> null), bukan menghapus berita.
class PostCategoryController extends ApiController
{
    public function index()
    {
        return $this->data(PostCategoryResource::collection(PostCategory::withCount('posts')->ordered()->get()));
    }

    public function store(PostCategoryRequest $request)
    {
        $category = PostCategory::create($this->attributes($request->validated(), null));

        return $this->created(new PostCategoryResource($category->loadCount('posts')));
    }

    public function update(PostCategoryRequest $request, PostCategory $newsCategory)
    {
        $newsCategory->update($this->attributes($request->validated(), $newsCategory));

        return $this->data(new PostCategoryResource($newsCategory->fresh()->loadCount('posts')));
    }

    public function destroy(PostCategory $newsCategory)
    {
        $newsCategory->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?PostCategory $existing): array
    {
        $name = I18n::normalize($data['name']);

        return [
            'name' => $name,
            'slug' => $this->slug($data['slug'] ?? null, $name['id'], $existing),
            'sort_order' => $data['sortOrder'] ?? ($existing->sort_order ?? 0),
        ];
    }

    private function slug(?string $slug, string $name, ?PostCategory $existing): string
    {
        $base = Str::slug($slug ?: $name) ?: 'kategori';
        $candidate = $base;
        $i = 2;

        while (PostCategory::where('slug', $candidate)->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))->exists()) {
            $candidate = $base.'-'.$i++;
        }

        return $candidate;
    }
}
