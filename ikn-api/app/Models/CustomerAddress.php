<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;

// Alamat pengiriman customer. Nama wilayah dibaca dari relasi ke regions (4 level).
class CustomerAddress extends Model
{
    protected $table = 'customer_addresses';

    protected $fillable = [
        'user_id', 'label', 'recipient_name', 'phone', 'address_line',
        'province_code', 'regency_code', 'district_code', 'village_code',
        'postal_code', 'lat', 'lng', 'note', 'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
    ];

    public const REGION_RELATIONS = ['province', 'regency', 'district', 'village'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function province()
    {
        return $this->belongsTo(Region::class, 'province_code', 'code');
    }

    public function regency()
    {
        return $this->belongsTo(Region::class, 'regency_code', 'code');
    }

    public function district()
    {
        return $this->belongsTo(Region::class, 'district_code', 'code');
    }

    public function village()
    {
        return $this->belongsTo(Region::class, 'village_code', 'code');
    }

    public function scopeDefault(Builder $query): Builder
    {
        return $query->where('is_default', true);
    }

    /** Nama wilayah 4 level: { province, regency, district, village } (null bila kode tidak dikenal). */
    public function regionNames(): array
    {
        $this->loadMissing(self::REGION_RELATIONS);

        return [
            'province' => $this->province?->name,
            'regency' => $this->regency?->name,
            'district' => $this->district?->name,
            'village' => $this->village?->name,
        ];
    }

    public function latFloat(): ?float
    {
        return $this->lat === null ? null : (float) $this->lat;
    }

    public function lngFloat(): ?float
    {
        return $this->lng === null ? null : (float) $this->lng;
    }

    /**
     * Snapshot untuk orders.shipping_address (kontrak bagian 9): bentuk beku tanpa id/isDefault,
     * agar order tetap utuh walau alamat diubah/dihapus. Dipakai BE-3 (CheckoutService).
     */
    public function toSnapshot(): array
    {
        return [
            'label' => $this->label,
            'recipientName' => $this->recipient_name,
            'phone' => $this->phone,
            'addressLine' => $this->address_line,
            'provinceCode' => $this->province_code,
            'regencyCode' => $this->regency_code,
            'districtCode' => $this->district_code,
            'villageCode' => $this->village_code,
            'region' => $this->regionNames(),
            'postalCode' => $this->postal_code,
            'lat' => $this->latFloat(),
            'lng' => $this->lngFloat(),
            'note' => $this->note,
        ];
    }
}
