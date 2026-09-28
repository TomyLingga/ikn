<?php

namespace App\Models;

// Wilayah cakupan zona ongkir: kode Kemendagri + level (tanpa FK keras ke regions, lihat migrasi).
class ShippingZoneRegion extends Model
{
    public const LEVEL_PROVINCE = 'province';
    public const LEVEL_REGENCY = 'regency';
    public const LEVEL_DISTRICT = 'district';
    public const LEVEL_VILLAGE = 'village';
    public const LEVELS = [self::LEVEL_PROVINCE, self::LEVEL_REGENCY, self::LEVEL_DISTRICT, self::LEVEL_VILLAGE];

    /** Level paling spesifik menang (arsitektur bagian 9). */
    public const SPECIFICITY = [
        self::LEVEL_VILLAGE => 4,
        self::LEVEL_DISTRICT => 3,
        self::LEVEL_REGENCY => 2,
        self::LEVEL_PROVINCE => 1,
    ];

    protected $fillable = ['zone_id', 'region_code', 'level'];

    public function zone()
    {
        return $this->belongsTo(ShippingZone::class, 'zone_id');
    }
}
