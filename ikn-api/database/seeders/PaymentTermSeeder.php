<?php

namespace Database\Seeders;

use App\Models\PaymentTerm;
use Illuminate\Database\Seeder;

// Syarat pembayaran ekspor bawaan (ASUMSI A-87). Idempoten per kode; admin bebas mengubah setelahnya.
class PaymentTermSeeder extends Seeder
{
    public function run(): void
    {
        foreach (self::rows() as $row) {
            PaymentTerm::firstOrCreate(['code' => $row['code']], $row);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public static function rows(): array
    {
        return [
            [
                'code' => 'tt_advance', 'market' => PaymentTerm::MARKET_EXPORT, 'is_active' => true, 'sort_order' => 1,
                'name' => ['id' => 'Pembayaran 100% di muka (T/T)', 'en' => '100% T/T in advance'],
                'description' => ['id' => 'Seluruh nilai pesanan ditransfer (telegraphic transfer) sebelum barang dimuat.', 'en' => 'The full order value is transferred (telegraphic transfer) before the goods are loaded.'],
            ],
            [
                'code' => 'tt_30_70', 'market' => PaymentTerm::MARKET_EXPORT, 'is_active' => true, 'sort_order' => 2,
                'name' => ['id' => 'Uang muka 30% T/T, pelunasan 70% terhadap salinan B/L', 'en' => '30% T/T advance, 70% against copy of B/L'],
                'description' => ['id' => 'Uang muka 30% saat pesanan dikonfirmasi; sisa 70% dibayar setelah salinan Bill of Lading dikirim.', 'en' => '30% down payment when the order is confirmed; the remaining 70% is paid after the copy of the Bill of Lading is sent.'],
            ],
        ];
    }
}
