<?php

namespace App\Models;

use App\Support\HasTranslations;

class MenuItem extends Model
{
    use HasTranslations;

    protected $fillable = ['menu_id', 'parent_id', 'key', 'label', 'description', 'url', 'sort_order', 'is_active'];

    protected $translatable = ['label', 'description'];

    protected $casts = ['is_active' => 'boolean', 'sort_order' => 'integer'];

    public function menu()
    {
        return $this->belongsTo(Menu::class);
    }

    public function children()
    {
        return $this->hasMany(MenuItem::class, 'parent_id')->orderBy('sort_order')->orderBy('id');
    }
}
