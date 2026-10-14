<?php

namespace Database\Seeders;

use App\Models\CustomerAddress;
use App\Models\CustomerProfile;
use App\Models\Region;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

// Customer demo (aktif + pending + rejected) beserta profil dan alamat. Idempoten.
// Password semua akun demo: "password". Kode wilayah nyata dari database/data/wilayah.csv.gz.
class CustomerSeeder extends Seeder
{
    // Rantai wilayah yang dipakai alamat demo; dibuat bila RegionSeeder belum dijalankan (mis. seed kelas ini saja).
    private const REGIONS = [
        ['31', 'Daerah Khusus Ibukota Jakarta'],
        ['31.75', 'Kota Administrasi Jakarta Timur'],
        ['31.75.06', 'Cakung'],
        ['31.75.06.1007', 'Cakung Barat'],
        ['12', 'Sumatera Utara'],
        ['12.71', 'Kota Medan'],
        ['12.71.06', 'Medan Deli'],
        ['12.71.06.1005', 'Mabar'],
        ['35', 'Jawa Timur'],
        ['35.78', 'Kota Surabaya'],
        ['35.78.03', 'Rungkut'],
        ['35.78.03.1001', 'Kalirungkut'],
        ['14', 'Riau'],
        ['14.71', 'Kota Pekanbaru'],
        ['14.71.01', 'Sukajadi'],
        ['14.71.01.1002', 'Jadirejo'],
    ];

    public function run(): void
    {
        $this->ensureRegions();

        $password = Hash::make('password');
        $approver = User::where('email', config('ikn.seed.super_admin_email'))->value('id');

        // 1. Customer aktif (user sudah dibuat UserSeeder; lengkapi profil + alamat).
        $buyer = User::firstOrCreate(
            ['email' => 'buyer@coatingsolutions.co.id'],
            [
                'name' => 'Budi Santoso',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_ACTIVE,
                'email_verified_at' => now(),
                'approved_at' => now(),
            ]
        );
        $buyer->forceFill(['locale' => 'id', 'approved_by' => $buyer->approved_by ?: $approver])->save();

        CustomerProfile::updateOrCreate(
            ['user_id' => $buyer->id],
            [
                'company' => 'Coating Solutions Co.',
                'position' => 'Procurement Manager',
                'company_email' => 'purchasing@coatingsolutions.co.id',
                'company_phone' => '0215551234',
                'tax_id' => '01.234.567.8-901.000',
                'phone' => '081234567890',
            ]
        );

        $this->address($buyer, 'Gudang Utama Jakarta', [
            'recipient_name' => 'Budi Santoso / Gudang',
            'phone' => '081234567890',
            'address_line' => 'Jl. Industri Raya No. 45, Kawasan Industri Pulogadung',
            'province_code' => '31',
            'regency_code' => '31.75',
            'district_code' => '31.75.06',
            'village_code' => '31.75.06.1007',
            'postal_code' => '13910',
            'lat' => -6.1834000,
            'lng' => 106.9118000,
            'note' => 'Masuk dari gerbang 2, jam operasional 08.00-17.00',
            'is_default' => true,
        ]);

        $this->address($buyer, 'Cabang Medan', [
            'recipient_name' => 'Rina Hasibuan',
            'phone' => '081377788899',
            'address_line' => 'Jl. Yos Sudarso Km. 8,5 No. 12, Kawasan Industri Medan',
            'province_code' => '12',
            'regency_code' => '12.71',
            'district_code' => '12.71.06',
            'village_code' => '12.71.06.1005',
            'postal_code' => '20242',
            'lat' => 3.6713000,
            'lng' => 98.6823000,
            'note' => 'Hubungi satpam sebelum bongkar',
            'is_default' => false,
        ]);

        // 1b. Customer aktif kedua (bahasa Inggris, alamat Surabaya → zona ongkir Jawa) agar daftar, chat, dan
        //     laporan berisi lebih dari satu pelanggan.
        $second = User::firstOrCreate(
            ['email' => 'purchasing@mitrakimia.co.id'],
            [
                'name' => 'Siti Rahma',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_ACTIVE,
                'locale' => 'en',
                'email_verified_at' => now()->subDays(60),
                'approved_at' => now()->subDays(59),
                'approved_by' => $approver,
            ]
        );
        CustomerProfile::updateOrCreate(
            ['user_id' => $second->id],
            [
                'company' => 'PT Mitra Kimia Industri',
                'position' => 'Purchasing Supervisor',
                'company_email' => 'procurement@mitrakimia.co.id',
                'company_phone' => '0318765432',
                'tax_id' => '03.456.789.0-123.000',
                'phone' => '081355566677',
            ]
        );
        $this->address($second, 'Pabrik Surabaya', [
            'recipient_name' => 'Siti Rahma / Gudang Bahan Baku',
            'phone' => '081355566677',
            'address_line' => 'Jl. Rungkut Industri III No. 27, SIER',
            'province_code' => '35',
            'regency_code' => '35.78',
            'district_code' => '35.78.03',
            'village_code' => '35.78.03.1001',
            'postal_code' => '60293',
            'lat' => -7.3312000,
            'lng' => 112.7638000,
            'note' => 'Bongkar di pintu gudang B, konfirmasi H-1',
            'is_default' => true,
        ]);

        // 1c. Customer nonaktif: pernah aktif, dinonaktifkan admin (tidak bisa login/memesan).
        $inactive = User::updateOrCreate(
            ['email' => 'nonaktif@contoh.co.id'],
            [
                'name' => 'Hendra Wijaya',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_INACTIVE,
                'locale' => 'id',
                'email_verified_at' => now()->subDays(120),
                'approved_at' => now()->subDays(119),
                'approved_by' => $approver,
                'rejection_reason' => null,
            ]
        );
        CustomerProfile::updateOrCreate(
            ['user_id' => $inactive->id],
            [
                'company' => 'CV Sumber Rejeki Makmur',
                'position' => 'Direktur',
                'tax_id' => '04.567.890.1-234.000',
                'phone' => '081266677788',
            ]
        );

        // 1d. Customer baru daftar, belum klik tautan verifikasi email.
        $unverified = User::updateOrCreate(
            ['email' => 'belum.verifikasi@contoh.co.id'],
            [
                'name' => 'Rudi Hartono',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_PENDING,
                'locale' => 'id',
                'email_verified_at' => null,
                'approved_at' => null,
                'approved_by' => null,
                'rejection_reason' => null,
            ]
        );
        CustomerProfile::updateOrCreate(
            ['user_id' => $unverified->id],
            [
                'company' => 'PT Riau Agro Lestari',
                'position' => 'Staff Logistik',
                'tax_id' => '05.678.901.2-345.000',
                'phone' => '081277788899',
            ]
        );

        // 2. Customer pending (sudah verifikasi email, menunggu persetujuan admin).
        $pending = User::updateOrCreate(
            ['email' => 'pending@contoh.co.id'],
            [
                'name' => 'Dewi Lestari',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_PENDING,
                'locale' => 'id',
                'email_verified_at' => now(),
                'approved_at' => null,
                'approved_by' => null,
                'rejection_reason' => null,
            ]
        );
        CustomerProfile::updateOrCreate(
            ['user_id' => $pending->id],
            [
                'company' => 'PT Contoh Kimia Nusantara',
                'position' => 'Staff Purchasing',
                'tax_id' => '02.345.678.9-012.000',
                'phone' => '081298765432',
            ]
        );

        // 3. Customer ditolak (dengan alasan).
        $rejected = User::updateOrCreate(
            ['email' => 'ditolak@contoh.co.id'],
            [
                'name' => 'Andi Wijaya',
                'password' => $password,
                'role' => User::ROLE_CUSTOMER,
                'status' => User::STATUS_REJECTED,
                'locale' => 'en',
                'email_verified_at' => now(),
                'approved_at' => null,
                'approved_by' => null,
                'rejection_reason' => 'Data perusahaan tidak dapat diverifikasi (NPWP tidak terdaftar).',
            ]
        );
        CustomerProfile::updateOrCreate(
            ['user_id' => $rejected->id],
            [
                'company' => 'CV Contoh Dagang',
                'position' => 'Owner',
                'tax_id' => '00.000.000.0-000.000',
                'phone' => '081200011122',
            ]
        );
    }

    private function ensureRegions(): void
    {
        foreach (self::REGIONS as [$code, $name]) {
            Region::firstOrCreate(
                ['code' => $code],
                ['parent_code' => Region::parentCodeFor($code), 'level' => Region::levelForCode($code), 'name' => $name]
            );
        }
    }

    private function address(User $user, string $label, array $attributes): void
    {
        CustomerAddress::updateOrCreate(['user_id' => $user->id, 'label' => $label], $attributes);
    }
}
