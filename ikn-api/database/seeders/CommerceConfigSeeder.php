<?php

namespace Database\Seeders;

use App\Models\BankAccount;
use App\Models\Category;
use App\Models\Fee;
use App\Models\Media;
use App\Models\PaymentMethod;
use App\Models\ShippingRate;
use App\Models\ShippingZone;
use App\Models\Voucher;
use App\Services\Commerce\CommerceSettings;
use App\Services\Media\MediaService;
use Illuminate\Database\Seeder;

// Rekening bank (MOCK_COMMERCE_CONFIG), biaya admin, zona + tarif ongkir, voucher, metode pembayaran, settings commerce.
// Idempoten: hanya membuat yang belum ada (admin boleh mengubah nilai setelahnya).
class CommerceConfigSeeder extends Seeder
{
    public function run(MediaService $media, CommerceSettings $settings): void
    {
        $this->bankAccounts();
        $this->fees();
        $this->shipping();
        $this->vouchers();
        $this->paymentMethods($media);
        $settings->seedDefaults();
    }

    private function bankAccounts(): void
    {
        $rows = [
            ['Bank BCA', '0123456789', 'PT Industri Karet Nusantara'],
            ['Bank Mandiri', '1060099887766', 'PT Industri Karet Nusantara'],
            ['Bank BNI', '0987654321', 'PT Industri Karet Nusantara'],
        ];
        foreach ($rows as $i => [$bank, $number, $holder]) {
            BankAccount::firstOrCreate(['account_number' => $number], [
                'bank_name' => $bank, 'account_holder' => $holder, 'is_active' => true, 'sort_order' => $i,
            ]);
        }
    }

    private function fees(): void
    {
        if (! Fee::where('type', Fee::TYPE_ADMIN)->exists()) {
            Fee::create(['name' => ['id' => 'Biaya administrasi', 'en' => 'Administration fee'], 'type' => Fee::TYPE_ADMIN, 'amount' => 5000, 'is_active' => true, 'sort_order' => 0]);
        }
    }

    private function shipping(): void
    {
        $zones = [
            [
                'name' => ['id' => 'Sumatera Utara', 'en' => 'North Sumatra'], 'priority' => 10, 'is_default' => false,
                'regions' => [['12', 'province']],
                'rates' => [
                    ['name' => ['id' => 'Reguler', 'en' => 'Regular'], 'type' => 'per_kg', 'base_amount' => 25000, 'per_kg_amount' => 2000, 'min_amount' => 0, 'free_above' => 25000000, 'eta' => ['id' => '2–4 hari', 'en' => '2–4 days']],
                    ['name' => ['id' => 'Ekspres', 'en' => 'Express'], 'type' => 'per_kg', 'base_amount' => 60000, 'per_kg_amount' => 4000, 'min_amount' => 0, 'free_above' => null, 'eta' => ['id' => '1–2 hari', 'en' => '1–2 days']],
                ],
            ],
            [
                'name' => ['id' => 'Jawa', 'en' => 'Java'], 'priority' => 10, 'is_default' => false,
                'regions' => [['31', 'province'], ['32', 'province'], ['33', 'province'], ['34', 'province'], ['35', 'province'], ['36', 'province']],
                'rates' => [
                    ['name' => ['id' => 'Reguler', 'en' => 'Regular'], 'type' => 'per_kg', 'base_amount' => 50000, 'per_kg_amount' => 3500, 'min_amount' => 60000, 'free_above' => null, 'eta' => ['id' => '4–7 hari', 'en' => '4–7 days']],
                    ['name' => ['id' => 'Ekspres', 'en' => 'Express'], 'type' => 'per_kg', 'base_amount' => 120000, 'per_kg_amount' => 6000, 'min_amount' => 150000, 'free_above' => null, 'eta' => ['id' => '2–3 hari', 'en' => '2–3 days']],
                ],
            ],
            [
                'name' => ['id' => 'Indonesia lainnya', 'en' => 'Rest of Indonesia'], 'priority' => 0, 'is_default' => true,
                'regions' => [],
                'rates' => [
                    ['name' => ['id' => 'Kargo reguler', 'en' => 'Regular cargo'], 'type' => 'per_kg', 'base_amount' => 100000, 'per_kg_amount' => 5000, 'min_amount' => 150000, 'free_above' => null, 'eta' => ['id' => '5–10 hari', 'en' => '5–10 days']],
                ],
            ],
        ];

        foreach ($zones as $row) {
            $zone = ShippingZone::where('name->id', $row['name']['id'])->first();
            if (! $zone) {
                $zone = ShippingZone::create(['name' => $row['name'], 'priority' => $row['priority'], 'is_default' => $row['is_default'], 'is_active' => true]);
                foreach ($row['regions'] as [$code, $level]) {
                    $zone->regions()->create(['region_code' => $code, 'level' => $level]);
                }
            }
            foreach ($row['rates'] as $i => $rate) {
                if (! ShippingRate::where('zone_id', $zone->id)->where('name->id', $rate['name']['id'])->exists()) {
                    $zone->rates()->create($rate + ['is_active' => true, 'sort_order' => $i]);
                }
            }
        }
    }

    private function vouchers(): void
    {
        Voucher::firstOrCreate(['code' => 'IKN10'], [
            'type' => Voucher::TYPE_PERCENT, 'value' => 10, 'min_subtotal' => 5000000, 'max_discount' => 2000000,
            'quota' => 100, 'used_count' => 0, 'per_user_limit' => 2, 'scope' => ['type' => Voucher::SCOPE_ALL],
            'starts_at' => now()->startOfDay(), 'ends_at' => now()->addYear()->endOfDay(), 'is_active' => true,
        ]);

        $resiprene = Category::where('slug', 'resiprene')->first();
        Voucher::firstOrCreate(['code' => 'ONGKIRGRATIS'], [
            'type' => Voucher::TYPE_FIXED, 'value' => 150000, 'min_subtotal' => 0, 'max_discount' => null,
            'quota' => null, 'used_count' => 0, 'per_user_limit' => null,
            'scope' => $resiprene ? ['type' => Voucher::SCOPE_CATEGORY, 'categoryIds' => [$resiprene->id]] : ['type' => Voucher::SCOPE_ALL],
            'starts_at' => now()->startOfDay(), 'ends_at' => now()->addYear()->endOfDay(), 'is_active' => true,
        ]);
    }

    private function paymentMethods(MediaService $media): void
    {
        $qris = MediaSeeder::find('qris-placeholder.png');
        if (! $qris && is_file(database_path('seeders/assets/rubin-logo.png'))) {
            $qris = $media->importFromPath(database_path('seeders/assets/rubin-logo.png'), 'qris', Media::DISK_PUBLIC, 'qris-placeholder.png');
        }

        $rows = [
            [
                'code' => 'manual_transfer', 'type' => PaymentMethod::TYPE_MANUAL_TRANSFER, 'driver' => PaymentMethod::DRIVER_MANUAL, 'is_active' => true, 'sort_order' => 0,
                'name' => ['id' => 'Transfer Bank Manual', 'en' => 'Manual Bank Transfer'],
                'instructions' => ['id' => 'Transfer sesuai total tagihan (termasuk kode unik) ke salah satu rekening di bawah, lalu unggah bukti transfer sebelum batas waktu pembayaran.', 'en' => 'Transfer the exact total (including the unique code) to one of the accounts below, then upload the transfer receipt before the payment deadline.'],
                'config' => [],
            ],
            [
                'code' => 'qris_static', 'type' => PaymentMethod::TYPE_QRIS_STATIC, 'driver' => PaymentMethod::DRIVER_MANUAL, 'is_active' => true, 'sort_order' => 1,
                'name' => ['id' => 'QRIS', 'en' => 'QRIS'],
                'instructions' => ['id' => 'Pindai kode QRIS dengan aplikasi pembayaran Anda, bayar sesuai total tagihan, lalu unggah bukti pembayaran.', 'en' => 'Scan the QRIS code with your payment app, pay the exact total, then upload the payment receipt.'],
                'config' => $qris ? ['qrisMediaId' => $qris->id] : [],
            ],
            [
                'code' => 'qris_dynamic', 'type' => PaymentMethod::TYPE_QRIS_DYNAMIC, 'driver' => PaymentMethod::DRIVER_XENDIT, 'is_active' => false, 'sort_order' => 2,
                'name' => ['id' => 'QRIS Dinamis', 'en' => 'Dynamic QRIS'],
                'instructions' => ['id' => 'Pindai kode QR yang dibuat khusus untuk order ini; pembayaran terverifikasi otomatis.', 'en' => 'Scan the QR code generated for this order; payment is verified automatically.'],
                'config' => ['channelCode' => 'QRIS'],
            ],
            [
                'code' => 'virtual_account', 'type' => PaymentMethod::TYPE_VIRTUAL_ACCOUNT, 'driver' => PaymentMethod::DRIVER_XENDIT, 'is_active' => false, 'sort_order' => 3,
                'name' => ['id' => 'Virtual Account', 'en' => 'Virtual Account'],
                'instructions' => ['id' => 'Transfer ke nomor virtual account yang diterbitkan untuk order ini; pembayaran terverifikasi otomatis.', 'en' => 'Transfer to the virtual account number issued for this order; payment is verified automatically.'],
                'config' => ['bankCode' => 'BCA', 'feeFixed' => 4000],
            ],
            [
                'code' => 'ewallet', 'type' => PaymentMethod::TYPE_EWALLET, 'driver' => PaymentMethod::DRIVER_XENDIT, 'is_active' => false, 'sort_order' => 4,
                'name' => ['id' => 'E-Wallet', 'en' => 'E-Wallet'],
                'instructions' => ['id' => 'Bayar lewat aplikasi e-wallet; pembayaran terverifikasi otomatis.', 'en' => 'Pay through your e-wallet app; payment is verified automatically.'],
                'config' => ['channelCode' => 'ID_OVO', 'feePercent' => 1.5],
            ],
        ];

        foreach ($rows as $row) {
            PaymentMethod::firstOrCreate(['code' => $row['code']], $row);
        }
    }
}
