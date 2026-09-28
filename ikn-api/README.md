# ikn-api

Backend API PT Industri Karet Nusantara. Laravel **8.83.29** (dipin), PostgreSQL, API-only di bawah `/api/v1`.
Kontrak: `plan/02-api-contract.md` (ringkas) dan `docs/openapi.yaml` (mesin).

## Menjalankan di lokal (Windows, tanpa Docker)

Prasyarat: PHP 8.1+ dengan `pdo_pgsql`, Composer 2, PostgreSQL berjalan di `127.0.0.1:5432`.

```bash
composer install
copy .env.example .env          # isi DB_PASSWORD, lalu:
php artisan key:generate
php artisan migrate --seed      # membuat tabel + data demo company profile
php artisan serve               # http://localhost:8000
```

Database test `ikn_test` harus ada (`CREATE DATABASE ikn_test`). Menjalankan test:

```bash
php artisan test
php artisan test --filter=PageTest
```

Perintah lain:

```bash
php artisan migrate:fresh --seed   # reset + seeder demo (dev saja)
php artisan route:list
```

## Perintah commerce

```bash
php artisan regions:import                 # wilayah Kemendagri dari database/data/wilayah.csv.gz (idempoten)
php artisan stock:rebuild [--product=ID]   # hitung ulang cache stok dari ledger stock_movements
php artisan orders:expire                  # order pending_payment lewat batas waktu -> expired (scheduler: tiap menit)
php artisan orders:remind                  # pengingat bayar (scheduler: tiap 15 menit)
php artisan orders:auto-complete           # delivered -> completed setelah N hari (scheduler: 01:00)
php artisan schedule:work                  # jalankan scheduler di dev (produksi: service scheduler di compose)
php artisan queue:work                     # bila QUEUE_CONNECTION=database
python docs/openapi/merge.py               # gabungkan docs/openapi/*.yaml -> docs/openapi.yaml
python docs/openapi/postman.py             # Postman collection + environment dari openapi.yaml -> ../doc/postman/ (di luar git)
```

## Akun demo (seeder)

| Email | Peran | Modul |
|---|---|---|
| `superadmin@ptikn.com` | super_admin | semua |
| `konten@ptikn.com` | admin | cms, media, news, gallery, certificates, brochures, wbs, messages |
| `buyer@coatingsolutions.co.id` | customer (aktif) | 2 alamat, order demo di semua status |
| `pending@contoh.co.id` | customer (menunggu persetujuan) | – |
| `ditolak@contoh.co.id` | customer (ditolak) | – |

Kata sandi mengikuti `SEED_SUPER_ADMIN_PASSWORD` di `.env` (default `password`).

## Frontend

`ikn-fe` mengakses API lewat Sanctum cookie SPA: `GET /sanctum/csrf-cookie` lalu `POST /api/v1/auth/admin/login`
dengan `credentials: include`. Origin FE harus ada di `CORS_ALLOWED_ORIGINS` dan `SANCTUM_STATEFUL_DOMAINS`.
Berkas publik dilayani dari `/storage/...` (route fallback bila symlink `public/storage` tidak ada).

## Struktur

- `app/Http/Controllers/Api/V1/{Auth,PublicSite,Admin}` — controller tipis.
- `app/Http/Requests` — validasi (Form Request). `app/Http/Resources` — bentuk JSON camelCase.
- `app/Services/Cms/SectionRegistry` + `SectionDefinitions` — skema tipe section (validasi + form admin otomatis).
- `app/Services/Media/MediaService` — satu pintu unggah/hapus berkas (disk `public` / `private`).
- `app/Services/Audit/AuditLogger` — setiap aksi tulis admin dicatat ke `audit_logs`.
- `app/Support/Html` — sanitasi HTML editor (HTMLPurifier whitelist) untuk isi berita dan section rich text; dipakai lewat `I18n::normalizeHtml()`.
- `app/Models/Model` — base model semua entitas; trait `App/Support/StoresDatesInAppTimezone` menyimpan tanggal dalam zona aplikasi (Asia/Jakarta) karena grammar Postgres Laravel 8 menulis timestamp tanpa offset.
- `database/seeders` — seeder idempoten dari mockup FE (`site.ts`, `i18n.ts`, `mock-data.ts`).

## Catatan versi

Laravel 8 sudah EOL; `composer.json` menonaktifkan `audit.block-insecure` agar versi terkunci 8.83.29 dapat dipasang.
PHP lokal 8.2 dipakai untuk pengembangan; image produksi tetap PHP 8.1 sesuai rencana.
