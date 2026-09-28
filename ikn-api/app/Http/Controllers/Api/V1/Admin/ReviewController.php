<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\UpdateReviewRequest;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use Illuminate\Http\Request;

// Moderasi ulasan (kontrak 11.3, ASUMSI A-13): sembunyikan/tampilkan; rating produk dihitung ulang otomatis.
class ReviewController extends ApiController
{
    public function index(Request $request)
    {
        $query = Review::with(['product', 'user'])
            ->when($request->query('q'), function ($q, $s) {
                $like = '%'.$s.'%';
                $q->where(function ($w) use ($like) {
                    $w->where('body', 'ilike', $like)
                        ->orWhereHas('user', fn ($u) => $u->where('name', 'ilike', $like))
                        ->orWhereHas('product', fn ($p) => $p->withTrashed()->where('name->id', 'ilike', $like)->orWhere('slug', 'ilike', $like));
                });
            })
            ->when($request->query('product'), function ($q, $product) {
                $q->whereHas('product', fn ($p) => $p->withTrashed()->where('slug', $product)->orWhere('id', is_numeric($product) ? (int) $product : 0));
            })
            ->when($request->query('published') !== null && $request->query('published') !== '', function ($q) use ($request) {
                $q->where('is_published', $request->boolean('published'));
            })
            ->orderByDesc('created_at')->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage(20)), ReviewResource::class);
    }

    public function update(UpdateReviewRequest $request, Review $review)
    {
        $review->update(['is_published' => $request->boolean('isPublished')]);

        return $this->data(new ReviewResource($review->fresh(['product', 'user'])));
    }
}
