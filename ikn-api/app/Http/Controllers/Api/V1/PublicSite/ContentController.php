<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\BrochureResource;
use App\Http\Resources\CertificateResource;
use App\Http\Resources\CustomerLogoResource;
use App\Http\Resources\GalleryItemResource;
use App\Http\Resources\PostResource;
use App\Http\Resources\PostSummaryResource;
use App\Models\Brochure;
use App\Models\Certificate;
use App\Models\CustomerLogo;
use App\Models\GalleryItem;
use App\Models\Post;
use Illuminate\Http\Request;

// Daftar konten publik (kontrak 7): hanya yang terbit/aktif.
class ContentController extends ApiController
{
    public function news(Request $request)
    {
        $posts = Post::published()->with('cover')
            ->when($request->query('tag'), fn ($q, $t) => $q->where('tag', $t))
            ->orderByDesc('published_at')->orderByDesc('id')
            ->limit(min(100, (int) $request->query('limit', 50) ?: 50))
            ->get();

        return $this->data(PostSummaryResource::collection($posts));
    }

    public function newsDetail(string $slug)
    {
        $post = Post::published()->with('cover')->where('slug', $slug)->firstOrFail();
        // Berita terkait: tag sama lebih dulu, lalu yang terbaru; maksimal 3.
        $related = Post::published()->with('cover')->where('id', '!=', $post->id)
            ->when($post->tag, fn ($q, $tag) => $q->orderByRaw('CASE WHEN tag = ? THEN 0 ELSE 1 END', [$tag]))
            ->orderByDesc('published_at')->orderByDesc('id')->limit(3)->get();

        return $this->data((new PostResource($post))->resolve() + ['related' => PostSummaryResource::collection($related)->resolve()]);
    }

    public function gallery()
    {
        return $this->data(GalleryItemResource::collection(
            GalleryItem::published()->with('media')->orderBy('sort_order')->orderByDesc('id')->get()
        ));
    }

    public function certificates()
    {
        return $this->data(CertificateResource::collection(
            Certificate::published()->with('media')->orderBy('sort_order')->orderBy('id')->get()
        ));
    }

    public function brochures()
    {
        return $this->data(BrochureResource::collection(
            Brochure::published()->with('media')->orderBy('sort_order')->orderBy('id')->get()
        ));
    }

    public function customerLogos()
    {
        return $this->data(CustomerLogoResource::collection(
            CustomerLogo::active()->with('media')->orderBy('sort_order')->orderBy('id')->get()
        ));
    }
}
