<?php

namespace App\Models;

use App\Support\Money;

// Profil customer (satu per user), PK = user_id. Pasar (ASUMSI A-86) dikunci admin saat menyetujui akun;
// negara ISO 3166-1 alpha-2 dan alamat perusahaan dipakai dokumen ekspor.
class CustomerProfile extends Model
{
    protected $table = 'customer_profiles';

    protected $primaryKey = 'user_id';

    public $incrementing = false;

    public const MARKET_LOCAL = 'local';
    public const MARKET_EXPORT = 'export';
    public const MARKETS = [self::MARKET_LOCAL, self::MARKET_EXPORT];

    public const DEFAULT_COUNTRY = 'ID';

    protected $fillable = [
        'user_id', 'company', 'position', 'company_email', 'company_phone', 'tax_id', 'phone',
        'market', 'country_code', 'company_address',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function marketOrDefault(): string
    {
        return $this->market === self::MARKET_EXPORT ? self::MARKET_EXPORT : self::MARKET_LOCAL;
    }

    public function isExport(): bool
    {
        return $this->marketOrDefault() === self::MARKET_EXPORT;
    }

    /** Mata uang pasar: export = USD, local = IDR. */
    public static function currencyFor(string $market): string
    {
        return $market === self::MARKET_EXPORT ? Money::CURRENCY_USD : Money::CURRENCY_IDR;
    }
}
