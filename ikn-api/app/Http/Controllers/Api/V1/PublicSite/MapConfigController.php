<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Services\Geo\MapConfigService;

/**
 * Lapisan tile siap pakai untuk semua peta di FE (ASUMSI A-98): { provider, fallback, layers }.
 * Publik karena peta footer, Kontak, dan beranda tampil untuk tamu. Hasilnya di-cache MapConfigService dan
 * dikosongkan saat pengaturan grup maps disimpan.
 */
class MapConfigController extends ApiController
{
    public function show(MapConfigService $maps)
    {
        return $this->data($maps->config());
    }
}
