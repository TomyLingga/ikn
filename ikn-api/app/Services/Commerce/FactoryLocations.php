<?php

namespace App\Services\Commerce;

use App\Models\FactoryLocation;
use App\Models\Product;
use Illuminate\Support\Collection;

/**
 * Daftar lokasi pabrik (ASUMSI A-90), dimuat sekali per request/job (binding scoped di AppServiceProvider) agar
 * resource produk dan kalkulator ongkir tidak query per produk. Model FactoryLocation mengosongkan cache saat disimpan/dihapus.
 */
class FactoryLocations
{
    /** @var Collection<int, FactoryLocation>|null */
    private ?Collection $cache = null;

    /** @return Collection<int, FactoryLocation> urut sort_order, id */
    public function all(): Collection
    {
        return $this->cache ??= FactoryLocation::orderBy('sort_order')->orderBy('id')->get();
    }

    /** Pabrik bawaan (urutan pertama); null hanya bila tabel kosong. */
    public function default(): ?FactoryLocation
    {
        return $this->all()->first();
    }

    /** Pabrik dengan id ini; null/tidak ada = pabrik bawaan. */
    public function find(?int $id): ?FactoryLocation
    {
        return ($id ? $this->all()->firstWhere('id', $id) : null) ?? $this->default();
    }

    public function forProduct(Product $product): ?FactoryLocation
    {
        return $this->find($product->factory_location_id ? (int) $product->factory_location_id : null);
    }

    public function forget(): void
    {
        $this->cache = null;
    }
}
