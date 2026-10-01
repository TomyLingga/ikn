<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\PostRequest;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Support\Html;
use App\Support\I18n;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// Berita (kontrak 11.6 news), by id.
class PostController extends ApiController
{
    public function index(Request $request)
    {
        $posts = Post::with(['cover', 'category'])
            ->when($request->query('category'), fn ($q, $id) => $q->where('category_id', (int) $id))
            ->when($request->query('q'), function ($q, $s) {
                $q->where(function ($w) use ($s) {
                    $w->where('title->id', 'ilike', '%'.$s.'%')->orWhere('title->en', 'ilike', '%'.$s.'%');
                });
            })
            ->orderByDesc('published_at')->orderByDesc('id')->get();

        return $this->data(PostResource::collection($posts));
    }

    public function store(PostRequest $request)
    {
        $data = $request->validated();
        $post = Post::create($this->attributes($data, null));

        return $this->created(new PostResource($post->load(['cover', 'category'])));
    }

    public function show(Post $post)
    {
        return $this->data(new PostResource($post->load(['cover', 'category'])));
    }

    public function update(PostRequest $request, Post $post)
    {
        $post->update($this->attributes($request->validated(), $post));

        return $this->data(new PostResource($post->fresh(['cover', 'category'])));
    }

    public function destroy(Post $post)
    {
        $post->delete();

        return $this->deleted();
    }

    private function attributes(array $data, ?Post $existing): array
    {
        $isPublished = (bool) ($data['isPublished'] ?? false);
        $publishedAt = $data['publishedAt'] ?? ($existing->published_at ?? null);
        if ($isPublished && ! $publishedAt) {
            $publishedAt = now();
        }

        return [
            'slug' => $this->slug($data['slug'] ?? null, $data['title']['id'] ?? '', $existing),
            'title' => $data['title'],
            'excerpt' => $this->plainText($data['excerpt'] ?? null),
            'body' => I18n::normalizeHtml($data['body'] ?? null),
            'category_id' => $data['categoryId'] ?? null,
            'author' => isset($data['author']) ? trim($data['author']) ?: null : null,
            'cover_media_id' => $data['coverMediaId'] ?? null,
            'is_published' => $isPublished,
            'published_at' => $publishedAt,
        ];
    }

    /** Ringkasan selalu teks polos (tag HTML dibuang). */
    private function plainText($value): array
    {
        $normalized = I18n::normalize($value);

        return ['id' => Html::text($normalized['id']), 'en' => Html::text($normalized['en'])];
    }

    private function slug(?string $slug, string $title, ?Post $existing): string
    {
        $base = Str::slug($slug ?: $title) ?: 'berita';
        $candidate = $base;
        $i = 2;

        while (Post::where('slug', $candidate)->when($existing, fn ($q) => $q->where('id', '!=', $existing->id))->exists()) {
            $candidate = $base.'-'.$i++;
        }

        return $candidate;
    }
}
