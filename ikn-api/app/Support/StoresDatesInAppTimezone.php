<?php

namespace App\Support;

use Illuminate\Support\Carbon;

// Grammar Postgres Laravel menulis timestamp tanpa offset (ASUMSI A-33), jadi setiap nilai tanggal
// harus dikonversi ke zona aplikasi dulu. Tanpa ini, input "2026-09-22T03:45:00Z" tersimpan sebagai
// 03:45 Asia/Jakarta (meleset 7 jam) karena Eloquent memformat Carbon di zona asalnya.
trait StoresDatesInAppTimezone
{
    /**
     * @param  mixed  $value
     * @return string|null
     */
    public function fromDateTime($value)
    {
        if (empty($value)) {
            return $value;
        }

        return Carbon::instance($this->asDateTime($value))
            ->setTimezone(config('app.timezone'))
            ->format($this->getDateFormat());
    }
}
