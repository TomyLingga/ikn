<?php

namespace App\Models;

use App\Support\HasTranslations;

class ShippingZone extends Model
{
    use HasTranslations;

    protected $fillable = ['name', 'is_active', 'is_default', 'priority'];

    protected $translatable = ['name'];

    protected $casts = ['is_active' => 'boolean', 'is_default' => 'boolean', 'priority' => 'integer'];

    public function regions()
    {
        return $this->hasMany(ShippingZoneRegion::class, 'zone_id');
    }

    public function rates()
    {
        return $this->hasMany(ShippingRate::class, 'zone_id')->orderBy('sort_order')->orderBy('id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
