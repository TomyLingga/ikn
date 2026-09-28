# Dataset wilayah

`wilayah.csv.gz` = kode wilayah Kemendagri (Kepmendagri No 300.2.2-2138 Tahun 2025), kolom `code,name`.
Sumber: https://github.com/cahyadsn/wilayah (`db/wilayah.sql`, lisensi MIT), dikonversi 2026-09-28.
Level diturunkan dari jumlah segmen kode: `11` provinsi, `11.01` kabupaten/kota, `11.01.01` kecamatan, `11.01.01.2001` desa/kelurahan; `parent_code` = kode tanpa segmen terakhir.
Impor: `php artisan regions:import` (idempoten, dipanggil RegionSeeder).
