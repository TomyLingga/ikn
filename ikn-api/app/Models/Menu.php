<?php

namespace App\Models;

class Menu extends Model
{
    public const LOCATION_HEADER = 'header';
    public const LOCATION_FOOTER = 'footer';
    public const LOCATIONS = [self::LOCATION_HEADER, self::LOCATION_FOOTER];

    protected $fillable = ['location'];

    public function items()
    {
        return $this->hasMany(MenuItem::class)->orderBy('sort_order')->orderBy('id');
    }
}
