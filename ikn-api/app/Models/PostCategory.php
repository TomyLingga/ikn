<?php

namespace App\Models;

use App\Support\HasTranslations;

// Kategori berita (mis. Berita Perusahaan, Produk, Kemitraan). Dikelola admin modul news.
class PostCategory extends Model
{
    use HasTranslations;

    protected $fillable = ['slug', 'name', 'sort_order'];

    protected $translatable = ['name'];

    protected $casts = ['sort_order' => 'integer'];

    public function posts()
    {
        return $this->hasMany(Post::class, 'category_id');
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }
}
