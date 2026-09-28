<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

// Wilayah Kemendagri 4 level (ASUMSI A-5). Kode bertitik: "31" → "31.75" → "31.75.06" → "31.75.06.1007".
class Region extends Model
{
    public const LEVEL_PROVINCE = 'province';
    public const LEVEL_REGENCY = 'regency';
    public const LEVEL_DISTRICT = 'district';
    public const LEVEL_VILLAGE = 'village';
    public const LEVELS = [self::LEVEL_PROVINCE, self::LEVEL_REGENCY, self::LEVEL_DISTRICT, self::LEVEL_VILLAGE];

    // Pola kode: 2 digit provinsi, .2 digit kab/kota, .2 digit kecamatan, .4 digit desa/kelurahan.
    public const CODE_PATTERN = '/^\d{2}(\.\d{2}){0,2}(\.\d{4})?$/';

    protected $table = 'regions';

    protected $primaryKey = 'code';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = ['code', 'parent_code', 'level', 'name'];

    /** Level diturunkan dari jumlah segmen kode; null bila kode tidak valid. */
    public static function levelForCode(string $code): ?string
    {
        if (! preg_match(self::CODE_PATTERN, $code)) {
            return null;
        }

        return self::LEVELS[substr_count($code, '.')] ?? null;
    }

    /** Kode induk = kode tanpa segmen terakhir; null untuk provinsi. */
    public static function parentCodeFor(string $code): ?string
    {
        $pos = strrpos($code, '.');

        return $pos === false ? null : substr($code, 0, $pos);
    }

    /** Semua kode leluhur dari provinsi ke bawah (tanpa kode sendiri). */
    public static function ancestorCodes(string $code): array
    {
        $codes = [];
        $parent = self::parentCodeFor($code);

        while ($parent !== null) {
            array_unshift($codes, $parent);
            $parent = self::parentCodeFor($parent);
        }

        return $codes;
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_code', 'code');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_code', 'code')->orderBy('name');
    }

    public function scopeLevel(Builder $query, string $level): Builder
    {
        return $query->where('level', $level);
    }

    public function scopeChildrenOf(Builder $query, string $parentCode): Builder
    {
        return $query->where('parent_code', $parentCode);
    }

    public function scopeSearch(Builder $query, string $term): Builder
    {
        $escaped = addcslashes($term, '%_\\');

        return $query->where('name', 'ILIKE', '%'.$escaped.'%');
    }

    /** Leluhur terurut dari provinsi (dimuat sekali per pemanggilan). */
    public function ancestors(): Collection
    {
        $codes = self::ancestorCodes($this->code);

        if ($codes === []) {
            return new Collection();
        }

        return self::query()->whereIn('code', $codes)->get()->sortBy(fn (Region $r) => strlen($r->code))->values();
    }

    /** Nama leluhur dari provinsi ke bawah, mis. ["Daerah Khusus Ibukota Jakarta", "Kota Administrasi Jakarta Timur"]. */
    public function pathNames(): array
    {
        return $this->ancestors()->pluck('name')->all();
    }
}
