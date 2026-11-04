<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Section customer_map: pelanggan per negara berubah dari teks dipisah koma menjadi daftar
// { name, logo, geo } agar tiap pelanggan bisa diberi logo dan titik lokasi sendiri.
class ConvertCustomerMapCustomersToList extends Migration
{
    public function up(): void
    {
        $this->rewrite(function ($customers) {
            if (is_array($customers)) {
                return $customers;
            }

            return array_values(array_map(
                fn ($name) => ['name' => $name, 'logo' => null, 'geo' => ['lat' => null, 'lng' => null]],
                array_filter(array_map('trim', explode(',', (string) $customers)), 'strlen')
            ));
        });
    }

    public function down(): void
    {
        $this->rewrite(fn ($customers) => is_array($customers)
            ? implode(', ', array_filter(array_map(fn ($c) => trim((string) ($c['name'] ?? '')), $customers), 'strlen'))
            : $customers);
    }

    private function rewrite(callable $convert): void
    {
        foreach (DB::table('page_sections')->where('type', 'customer_map')->get() as $row) {
            $content = json_decode($row->content, true) ?: [];
            $content['items'] = array_map(function ($item) use ($convert) {
                $item = is_array($item) ? $item : [];
                $item['customers'] = $convert($item['customers'] ?? '');

                return $item;
            }, $content['items'] ?? []);

            DB::table('page_sections')->where('id', $row->id)->update(['content' => json_encode($content)]);
        }
    }
}
