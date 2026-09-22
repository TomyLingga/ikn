# IMPLEMENTATION PLAN – ikn-be + integrasi ikn-fe

- Tanggal: 2026-09-21
- Dasar: `plan/00-answers.md`, `plan/01-architecture.md`, `plan/02-api-contract.md`
- Aturan umum tiap phase:
  - Mulai phase hanya setelah acceptance criteria phase sebelumnya terpenuhi dan di-review.
  - Semua perintah lewat `docker compose exec app ...` (lihat `CLAUDE.md`).
  - Setiap package: `composer require --dry-run` + cek changelog kompatibilitas Laravel 8.83.29 / PHP 8.1, lalu pin versi.
  - Setiap endpoint baru: Form Request, Resource, Policy/middleware, feature test, entri `docs/openapi.yaml`.
  - Test berjalan di Postgres `ikn_test` (bukan SQLite), `RefreshDatabase`.
  - Setelah ubah kode: `graphify update .` di root workspace.
- Definition of Done phase: checklist selesai, test hijau (`php artisan test`), OpenAPI diperbarui, seeder demo masih jalan, `git commit` di repo terkait.

Skill yang dipakai lintas phase: `graphify` (orientasi sebelum membuka file), `code-review` (sebelum commit besar), `security-review` (Phase 1, 8, 12), `run` (verifikasi app), `anthropic-skills:docs`/`docx` (dokumen ke klien bila diminta).

---

## Phase 0 – Scaffold Laravel + Docker dev

**Tujuan:** repo `ikn-be` berdiri, `docker compose up` sehat, Laravel 8.83.29 terhubung ke Postgres 16, test suite jalan di `ikn_test`.

**Checklist**
- [ ] `git init ikn-be`, `.gitattributes` (`* text=auto`, `*.sh text eol=lf`, `*.conf text eol=lf`), `.editorconfig`, `.gitignore` (Laravel + `.env*` kecuali `.env.docker.example`).
- [ ] `docker/php/Dockerfile` multi-stage (`base` php:8.1-fpm + ekstensi `pdo_pgsql pgsql mbstring bcmath intl gd zip exif pcntl opcache`, user `www` uid 1000; `dev` target dengan composer binary; `prod` target `composer install --no-dev`). Cek `php -m` di container.
- [ ] Bootstrap Laravel **di dalam container PHP 8.1**: `docker compose run --rm app composer create-project laravel/laravel:8.6.12 .` (skeleton 8.x), lalu pin `"laravel/framework": "8.83.29"` dan `composer update laravel/framework`. Verifikasi `php artisan --version` = 8.83.29.
- [ ] `docker-compose.yml` dev: `app`, `queue`, `scheduler`, `nginx` (8080), `db` (postgres:16, 5432, init `01-create-test-db.sql` membuat `ikn_test`), `mailpit` (8025/1025), `fe` (build `../ikn-fe`, 3000; boleh di-comment sampai Phase 11). Named volume `vendor`, `pgdata`, `fe_node_modules`.
- [ ] `docker/php/entrypoint.sh` (LF): wait `pg_isready`, `storage:link`, cache jika production, `migrate --force` jika `RUN_MIGRATIONS=true`, `exec "$@"`.
- [ ] `.env.docker.example` lengkap (APP, DB, SESSION, SANCTUM, CORS, MAIL mailpit, QUEUE database, CACHE database, `APP_TIMEZONE=Asia/Jakarta`).
- [ ] Koneksi DB: `DB_CONNECTION=pgsql`, listener `SET TIME ZONE 'UTC'` saat connect; `config/app.php` timezone `Asia/Jakarta`.
- [ ] `phpunit.xml`: `DB_DATABASE=ikn_test`, `DB_HOST=db`; hapus konfigurasi SQLite.
- [ ] Health endpoint `GET /up` (cek DB `SELECT 1`), nginx `default.conf` (`client_max_body_size 20m`, fastcgi ke `app:9000`).
- [ ] Package awal + pin: `laravel/sanctum ^2.15`, dev `phpunit ^9.6`, `nunomaduro/collision ^5.11`, `fakerphp/faker ^1.23`. Jalankan `composer why-not laravel/framework 8.83.29` = kosong.
- [ ] `routes/api.php` prefix `v1`, response envelope + handler exception → format error bagian 2 kontrak (`app/Exceptions/Handler.php`).
- [ ] Middleware `SetLocale` (Accept-Language), `resources/lang/{id,en}`.
- [ ] `Makefile`/`scripts` opsional untuk perintah umum (Windows: gunakan `docker compose exec` langsung).
- [ ] README ikn-be: cara jalan dev, perintah, struktur.

**Migration:** bawaan Laravel (`users` dimodifikasi di Phase 1), `sessions`, `jobs`, `failed_jobs`, `cache`, `personal_access_tokens`.
**Endpoint:** `GET /up`, `GET /api/v1/ping` → `{data:{ok:true, time}}`.
**Test:** `PingTest` (200, timezone offset +07:00 di `time`), `DatabaseConnectionTest` (`SELECT now()` sukses di `ikn_test`).
**Acceptance:** `docker compose up -d` semua service `healthy`/`running`; `docker compose exec app php artisan migrate` sukses; `docker compose exec app php artisan test` hijau di `ikn_test`; `curl localhost:8080/api/v1/ping` 200; Mailpit UI terbuka; `php -m` memuat semua ekstensi wajib; `php -v` = 8.1.x.
**Skill:** graphify, run.

---

## Phase 1 – Auth, registrasi, approval, RBAC

**Tujuan:** Sanctum cookie SPA berjalan, registrasi → verifikasi email → pending → approve/reject, role dan modul admin ditegakkan.

**Checklist**
- [ ] Migrasi `users` (role, status, permissions jsonb, approved_*, rejection_reason, last_login_at, soft deletes; email lowercase unique), `customer_profiles`, `password_resets`.
- [ ] Model `User` (konstanta ROLE_*, STATUS_*; mutator email lowercase), `CustomerProfile`.
- [ ] Sanctum: `EnsureFrontendRequestsAreStateful`, `config/sanctum.php` stateful domains, `config/cors.php` (`supports_credentials`), `SESSION_DOMAIN`.
- [ ] `RegistrationService`: buat user pending + profil, kirim `VerifyEmail` (queue). `MustVerifyEmail`.
- [ ] Controller Auth: register, login (customer), admin login, logout, me, verify-email (signed), resend, forgot/reset password. Rate limiter `auth` (5/menit), `register` (3/menit).
- [ ] Middleware `EnsureRole`, `EnsureModule` (`ModuleAccess` service, daftar modul di `config/ikn.php`), `EnsureCustomerActive`.
- [ ] Admin: `GET /admin/permissions/self`, `GET /admin/customers?status`, `GET /admin/customers/{id}`, `PUT /admin/customers/{id}/status` (approve/reject/inactive + email), `GET/POST/PUT /admin/users` (super_admin).
- [ ] Account: `GET/PUT /customer/profile`, `PUT /customer/profile/company`, `PUT /customer/profile/password`.
- [ ] Mail: `VerifyEmail`, `AccountApproved`, `AccountRejected`, `ResetPassword` (dua bahasa, mengikuti locale user).
- [ ] `AuditLogger` service + tabel `audit_logs`; dipakai oleh aksi admin di phase ini.
- [ ] Seeder: super admin, admin penjualan (permissions terbatas), customer demo aktif + pending.

**Migration:** `users`, `customer_profiles`, `password_resets`, `audit_logs`.
**Endpoint:** bagian 3, 4 (profil), 11.1 (`permissions/self`), 11.4 kontrak.
**Test:** register → email terkirim (Mail fake) → login sebelum verifikasi `403 EMAIL_NOT_VERIFIED` → verifikasi → login OK → checkout-guard `403 ACCOUNT_NOT_APPROVED` (endpoint dummy) → admin approve → aktif; admin tanpa modul `customers` → 403; super_admin bebas; rate limit login 6x → 429; email disimpan lowercase; audit log terisi saat approve.
**Acceptance:** alur registrasi penuh lewat Mailpit; cookie sesi `httpOnly`; CORS dari `localhost:3000` dengan credentials sukses (uji dengan `curl` + `Origin`); semua test hijau.
**Skill:** graphify, security-review, code-review.

---

## Phase 2 – Master data & media

**Tujuan:** kategori, produk (tanpa stok transaksional), media library, bank account, fee, settings.

**Checklist**
- [ ] Trait `HasTranslations` + cast jsonb; helper `Money`.
- [ ] Migrasi `media`, `categories`, `products` (+ kolom stok cache, promo, weight, is_taxable), `product_images`, `bank_accounts`, `fees`, `settings`, `reviews` (tabel saja).
- [ ] `MediaService`: upload (disk `public`/`private`), validasi mime + ukuran, nama acak, `collection`; `GET /files/{media}` privat dengan Policy + `X-Accel-Redirect`.
- [ ] Admin CRUD: categories, products (+ publish, images), bank-accounts, fees, settings (`GET/PUT`), media.
- [ ] Publik: `GET /catalog/categories`, `/catalog/products`, `/catalog/products/{slug}` (+ reviews kosong dulu), `GET /commerce/config`, `GET /content/settings`.
- [ ] Seeder demo dari `mock-data.ts` dan `supabase-schema.sql` (3 produk, 2 kategori, rekening, fee, settings default: `paymentDueHours=24`, `uniqueCodeEnabled=true`, `taxRate=11`, `priceIncludesTax=true`, `autoCompleteDays=7`).
- [ ] Salin `ikn-fe/supabase-schema.sql` ke `ikn-be/docs/supabase-schema.sql` sebagai arsip referensi.

**Migration:** `media`, `categories`, `products`, `product_images`, `bank_accounts`, `fees`, `settings`, `reviews`.
**Endpoint:** 6, 11.3 (tanpa stock), 11.5 (bank, fees, settings), 11.6 (media).
**Test:** CRUD produk dengan gambar; produk unpublished tidak muncul di publik; pencarian `q` ILIKE case-insensitive; upload mime salah → 415; file privat tanpa hak → 403; settings hanya modul `settings`; harga integer di JSON.
**Acceptance:** halaman katalog mockup bisa dilayani dari API (dicek dengan `curl`); seeder demo idempoten.
**Skill:** graphify, code-review.

---

## Phase 3 – CMS & i18n

**Tujuan:** halaman berbasis section, menu, berita, banner, FAQ, galeri, sertifikat, brosur, logo pelanggan, doc-links; seed dari `lib/site.ts`; validasi dua bahasa.

**Checklist**
- [ ] `SectionRegistry` (tipe + skema konten per tipe, validasi jsonb), `PageRenderer`.
- [ ] Migrasi `pages`, `page_sections`, `menus`, `menu_items`, `posts`, `banners`, `faqs`, `gallery_items`, `certificates`, `brochures`, `customer_logos`, `doc_links`.
- [ ] Admin CRUD semua entitas + reorder section + `/admin/blocks/{key}` alias + `/admin/menus/{location}`.
- [ ] Publik `GET /content/*` (pages, menus, news, gallery, certificates, brochures, customer-logos, banners, faqs, doc-links, blocks alias).
- [ ] Seeder `CmsFromSiteSeeder`: baca nilai dari `ikn-fe/lib/site.ts` dan `lib/i18n.ts` (disalin manual ke PHP array, bukan parsing TS) → pages `home`, `tentang`, `keberlanjutan`, `kontak`, `reach`, menu header/footer, berita/galeri/sertifikat/brosur demo.
- [ ] `resources/lang/{id,en}/validation.php` + atribut; test pesan berubah sesuai `Accept-Language`.

**Migration:** 12 tabel di atas.
**Endpoint:** 7, 11.6 kontrak.
**Test:** halaman draft tidak tampil publik; section `isVisible=false` disaring; tipe section tidak dikenal → 422; reorder; `Accept-Language: en` → pesan validasi Inggris; fallback `en` kosong → isi `id`.
**Acceptance:** `GET /content/pages/tentang` memuat timeline + visi-misi dari seed; `GET /content/menus/header` setara `navTree` mockup.
**Skill:** graphify, code-review.

---

## Phase 4 – Katalog lanjutan + stok ledger

**Tujuan:** `stock_movements` sebagai satu-satunya sumber stok; endpoint stok admin; ulasan.

**Checklist**
- [ ] Migrasi `stock_movements` (unique `idempotency_key`), index `(product_id, created_at)`.
- [ ] `StockLedger` service: `in`, `adjust`, `reserve`, `release`, `commit` dengan `ON CONFLICT DO NOTHING` + update cache hanya jika terinsert; `stock:rebuild` command.
- [ ] `stock_status` diturunkan otomatis (`available<=0` → `out_of_stock`, kecuali `made_to_order` manual).
- [ ] Admin `GET/POST /admin/products/{id}/stock`; ledger berpaginasi.
- [ ] Ulasan: `POST /customer/orders/{n}/reviews` (disiapkan, aktif penuh setelah Phase 7), `GET /catalog/products/{slug}/reviews`, admin moderasi; `rating_avg`/`review_count` diperbarui.
- [ ] Seeder: saldo awal lewat `in`.

**Migration:** `stock_movements`.
**Endpoint:** 11.3 stock, reviews.
**Test (Unit `StockLedgerTest`):** `in` menambah; `reserve` menaikkan reserved; `release` dua kali dengan key sama → stok berubah sekali; `commit` menurunkan keduanya; `rebuild` menghasilkan angka sama dengan cache.
**Acceptance:** `available` di katalog publik = `stock - reserved`; tidak ada jalur lain yang mengubah `products.stock_qty` (grep hanya `StockLedger`).
**Skill:** graphify, simplify.

---

## Phase 5 – Alamat & geo

**Tujuan:** alamat bertingkat wilayah Kemendagri, koordinat, proxy Nominatim.

**Checklist**
- [ ] Migrasi `regions` (code PK, parent_code, level, name; index `parent_code`, trigram/ILIKE pada name), `customer_addresses`.
- [ ] Command `regions:import` dari CSV `database/data/wilayah.csv` (sumber ASUMSI A-5, lisensi dicatat), idempoten.
- [ ] Endpoint `/regions`, `/regions/search`.
- [ ] `NominatimClient` (Guzzle): `User-Agent: IKN-Web/1.0 (+https://<domain>; it@<domain>)`, cache (database) 7/30 hari, `RateLimiter` global 1/detik ke upstream, per-IP 60/menit; endpoint `/geo/search`, `/geo/reverse`.
- [ ] CRUD alamat (`recipientName`, `addressLine`, kode 4 level, `postalCode`, `lat/lng`, `note`, `isDefault` tunggal per user).
- [ ] Catatan FE (dikerjakan Phase 11): Leaflet + OSM tile, dynamic import `ssr:false`.

**Migration:** `regions`, `customer_addresses`.
**Endpoint:** 4 (alamat), 5.
**Test:** import wilayah menghasilkan 4 level berantai; `isDefault` hanya satu; kode wilayah harus konsisten (kelurahan anak dari kecamatan yang dikirim) → 422; Nominatim dipanggil sekali untuk query sama (HTTP fake + cache); limit upstream 1/detik.
**Acceptance:** alamat demo lengkap dengan koordinat tersimpan; `GET /regions?parent=` cepat (< 50 ms dengan index).
**Skill:** graphify.

---

## Phase 6 – Ongkir, pajak, diskon

**Tujuan:** `OrderCalculator` lengkap dan teruji; zona ongkir, voucher, promo, pajak, fee.

**Checklist**
- [ ] Migrasi `shipping_zones`, `shipping_zone_regions`, `shipping_rates`, `vouchers`, `voucher_usages`.
- [ ] `ShippingRateCalculator` interface + `ZoneRateCalculator` (zona paling spesifik menang; flat/per_kg/min/free_above).
- [ ] `VoucherService`: validasi, reserve/commit/release kuota (idempoten per order), scope kategori (ASUMSI A-23).
- [ ] `OrderCalculator` (urutan bagian 9 arsitektur), kode unik generator (unik di antara order pending hari itu).
- [ ] Admin CRUD zones/rates/vouchers, alias `GET /admin/shipping-methods`.
- [ ] `POST /cart/quote`.

**Migration:** 5 tabel.
**Endpoint:** 9 (`/cart/quote`), 11.5 (shipping, vouchers).
**Test (Unit `OrderCalculatorTest`):** inklusif vs eksklusif PPN; voucher persen dengan `max_discount`; voucher fixed > subtotal → dibatasi; gratis ongkir di atas ambang; per_kg pembulatan ke atas; min_amount; fee aktif/non-aktif; kode unik 1–999; pembulatan rupiah. Feature: `/cart/quote` menolak produk `quote`, MOQ, voucher kedaluwarsa → `409 VOUCHER_INVALID`.
**Acceptance:** angka di `/cart/quote` untuk data seed cocok dengan perhitungan manual yang didokumentasikan di test.
**Skill:** graphify, simplify, code-review.

---

## Phase 7 – Checkout, order, reservasi stok

**Tujuan:** order dibuat dengan snapshot lengkap, stok ter-reserve aman dari oversell, state machine dan histori.

**Checklist**
- [ ] Migrasi `orders`, `order_items`, `order_status_histories`, `payments` (struktur lengkap, driver manual dipakai Phase 8).
- [ ] `OrderNumberGenerator` (`IKN-YYYYMMDD-NNNNN`, sequence per hari dengan lock), `OrderStateMachine` (tabel transisi + efek samping lewat event), `CheckoutService` (transaksi + `FOR UPDATE` urut id + reserve + voucher + payment pending + histori).
- [ ] `Idempotency-Key` untuk `POST /customer/orders` (tabel `idempotency_keys` atau cache 24 jam).
- [ ] Endpoint customer: list/detail order, cancel (pending_payment), confirm-received, complete; admin: list/detail, status (processing/shipped/delivered/completed), cancel (adjust in bila sudah paid), due (perpanjang).
- [ ] Event/listener: `OrderPlaced` → email customer + admin (queue).
- [ ] Policy: customer hanya order miliknya.

**Migration:** `orders`, `order_items`, `order_status_histories`, `payments`, `idempotency_keys`.
**Endpoint:** 9 (orders), 11.2 (orders, due).
**Test:** **checkout bersamaan** (dua proses/`pcntl_fork` atau dua koneksi DB dalam test dengan stok 1 → tepat satu 201, satu 409, ledger konsisten); snapshot harga tidak berubah saat produk diedit; transisi tidak sah → 409; cancel oleh customer melepas stok dan voucher; admin cancel setelah paid → `adjust in`; `Idempotency-Key` sama → order sama; histori terisi tiap transisi.
**Acceptance:** alur checkout dari seed (Resiprene 100 kg) menghasilkan order dengan total sesuai `/cart/quote`; `stock:rebuild` tidak mengubah angka.
**Skill:** graphify, code-review, security-review.

---

## Phase 8 – Pembayaran: manual, QRIS statis, expiry, kerangka gateway & webhook

**Tujuan:** verifikasi manual end-to-end, expiry otomatis, kerangka driver gateway yang teruji dengan HTTP fake.

**Checklist**
- [ ] Migrasi `payment_methods`, `payment_webhook_logs`; kolom `payments` sudah ada.
- [ ] Contract `PaymentGateway { create, checkStatus, cancel, handleWebhook }`; `ManualDriver` (manual_transfer, qris_static: instruksi + gambar QRIS dari `config.qrisMediaId`); `XenditDriver` kerangka (QRIS dinamis, VA, e-wallet) dengan `Http::fake` contract test, `is_active=false`.
- [ ] `PaymentService`: buat percobaan bayar (tolak `PAYMENT_ALREADY_ACTIVE`), upload bukti (disk private, mime/ukuran), accept/reject (→ `OrderStateMachine`), ganti metode.
- [ ] Endpoint: `GET /payment-methods`, `POST /customer/orders/{n}/proof`, `POST .../payments`, `GET .../payments`, admin payments (list/detail/accept/reject + alias by nomor order), `POST /payments/webhook/{provider}` (signature, idempoten by `provider+external_id+event`, log mentah).
- [ ] `orders:expire` command tiap menit di `Kernel`: `pending_payment` lewat `payment_due_at` → expired (release stok idempoten, release voucher, payment expired, email); `payment_review` dilewati.
- [ ] Admin CRUD `payment-methods`; seeder: manual_transfer aktif, qris_static aktif (gambar placeholder), tiga metode gateway non-aktif.
- [ ] Mail: `PaymentReceived` (admin), `PaymentAccepted`, `PaymentRejected`, `OrderExpired`.

**Migration:** `payment_methods`, `payment_webhook_logs`.
**Endpoint:** 10, 11.2 (payments), 11.5 (payment-methods).
**Test wajib:** tolak bukti → order `pending_payment`, upload ulang membuat payment baru → `payment_review` → accept → `paid` + commit stok + invoice number; **expiry** mengembalikan stok dan kuota voucher, dijalankan dua kali tidak menggandakan; `payment_review` tidak di-expire; upload setelah due → `409 ORDER_EXPIRED`; **webhook ganda** → `duplicate`, efek sekali; signature salah → 401; XenditDriver contract test (create/checkStatus/cancel/handleWebhook dengan payload contoh).
**Acceptance:** demo lengkap: checkout → upload bukti di FE mock (atau curl) → admin accept → status paid; scheduler berjalan di container `scheduler` dan mengekspirasi order uji dalam ≤ 1 menit.
**Skill:** graphify, security-review, code-review.

---

## Phase 9 – Pengiriman & notifikasi

**Tujuan:** alur setelah paid sampai completed, semua email transaksional, auto-complete.

**Checklist**
- [ ] Transisi `processing → shipped` wajib `courier` + `trackingNumber` (disimpan di order dan `meta` histori); `shipped → delivered` (admin atau customer); `delivered → completed` (customer atau `orders:auto-complete` harian setelah `autoCompleteDays`).
- [ ] `OrderNotifier` (satu titik untuk semua kanal): email `OrderShipped`, `OrderDelivered`, `OrderCompleted`, pengingat batas waktu (`orders:remind` 2 jam sebelum due, sekali).
- [ ] Template email dua bahasa (locale user), layout konsisten, tautan ke FE (`FRONTEND_URL`).
- [ ] Antrean: retry 3x, `failed_jobs` dipantau (`queue:failed` di runbook).

**Migration:** tidak ada baru (kolom sudah di Phase 7).
**Endpoint:** 11.2 status (nilai `shipped/delivered/completed`), 9 (`confirm-received`, `complete`).
**Test:** shipped tanpa resi → 422; customer konfirmasi diterima; auto-complete setelah N hari (travel time Carbon); setiap transisi mengirim email yang benar (Mail fake, assertQueued); pengingat tidak dikirim dua kali.
**Acceptance:** timeline order di `GET /customer/orders/{n}` memuat kurir + resi; Mailpit menampilkan seluruh rangkaian email untuk satu order demo.
**Skill:** graphify.

---

## Phase 10 – Dashboard, laporan, audit

**Tujuan:** endpoint dashboard dan laporan penjualan sesuai `DashboardData`/`SalesReport` mockup; audit log lengkap.

**Checklist**
- [ ] `GET /admin/dashboard?year` (stats: order hari ini, menunggu verifikasi, pendapatan bulan ini, customer pending; `recentOrders`, `salesChart` per bulan).
- [ ] `GET /admin/reports/sales` (filter tahun/bulan/rentang, agregasi dari `paid_at`, `?format=csv`).
- [ ] Audit log untuk semua controller admin yang menulis (cek dengan test bahwa setiap route `admin/*` non-GET menulis `audit_logs`), `GET /admin/audit-logs` (super_admin).
- [ ] `GET /admin/contact-messages`, `PUT .../read`; `POST /contact` publik + email admin.
- [ ] WBS: `POST /wbs` (lampiran privat), `GET /wbs/{code}`, admin list/detail/update, `wbs/config` + `wbs/upload`, `help-guide`.
- [ ] Index DB untuk laporan (`orders(paid_at, status)`).

**Migration:** `contact_messages`, `wbs_reports` (bila belum), index.
**Endpoint:** 8, 11.1, 11.6 (whistleblowing, contact-messages), 11.4 (help-guide).
**Test:** angka dashboard cocok dengan seed (order paid vs expired tidak dihitung); CSV valid; route admin tulis tanpa audit → test gagal; WBS anonim tidak menyimpan identitas; rate limit `POST /wbs`.
**Acceptance:** halaman `/admin` dan `/admin/reports/sales` mockup bisa dilayani tanpa perubahan bentuk data selain envelope.
**Skill:** graphify, dataviz (bila grafik perlu disesuaikan di Phase 11).

---

## Phase 11 – Integrasi FE per modul, pencabutan Supabase, hapus /sso/verify

**Tujuan:** `ikn-fe` berbicara hanya ke `ikn-be`; tidak ada Supabase, mock store, mock dispatcher, rewrite lama, atau `/sso/verify`.

**Checklist (urutan modul mengikuti kesiapan backend)**
- [ ] `lib/api.ts`: implementasi HTTP client (`fetch`, `credentials: 'include'`, `X-XSRF-TOKEN`, `Accept-Language` dari `useLang`, unwrap `data`, map error ke `ApiError`), base `NEXT_PUBLIC_API_URL`. Flag per modul `NEXT_PUBLIC_API_MODULES` sementara untuk fallback mock selama transisi di dev (dihapus di akhir phase).
- [ ] `lib/server-data.ts`: ganti Supabase+mock dengan fetch ke `API_INTERNAL_URL` (RSC), cache `revalidate` per endpoint.
- [ ] Modul 1 Auth: `AuthProvider` → csrf-cookie + `/auth/*`; halaman login menampilkan status pending/rejected; halaman verifikasi email.
- [ ] Modul 2 Katalog & konten publik: `fetchProducts/Categories/News/Gallery/Certificates/Brochures/CustomerLogos` → API; **History, Visi-Misi, Kontak, Logo Pelanggan membaca `GET /content/pages/*`/`/content/customer-logos`** bukan `lib/site.ts`; `lib/site.ts` dipangkas menjadi konstanta non-konten (ikon, dsb.).
- [ ] Modul 3 Akun & alamat: form alamat dengan dropdown wilayah bertingkat + peta Leaflet/OSM (`leaflet ^1.9`, `react-leaflet ^4`, dynamic import `ssr:false`), pencarian via `/geo/search`.
- [ ] Modul 4 Keranjang & checkout: `POST /cart/quote` untuk ringkasan, body checkout baru (`addressId`, `shippingRateId`, `paymentMethodCode`, `voucherCode`), tampilkan kode unik dan instruksi bayar; pilihan QRIS statis (gambar).
- [ ] Modul 5 Order customer: status baru di `lib/commerce.ts` (`orderStatus`, `paymentStatus`, `trackingSteps`), upload bukti, ganti metode, riwayat payment, cetak invoice (print CSS + `invoiceNumber`).
- [ ] Modul 6 Admin order & payment: daftar payment per percobaan, accept/reject by payment id (alias by nomor tetap didukung), perpanjang due, ship dengan kurir + resi.
- [ ] Modul 7 Admin katalog/stok: CRUD by `id`, ledger stok, moderasi ulasan.
- [ ] Modul 8 Admin CMS: editor section (isi, urutan, tampil/sembunyi) untuk pages; halaman lama blocks tetap jalan lewat alias; menu, banner, FAQ, doc-links, media library.
- [ ] Modul 9 Admin commerce: zona/tarif ongkir (halaman baru menggantikan `shipping-methods`), voucher, metode bayar, settings pajak/kode unik.
- [ ] Modul 10 Admin customers (approve/reject), users, WBS, contact messages, dashboard, laporan.
- [ ] Pencabutan Supabase: hapus `lib/supabase.ts`, `lib/supabase-service.ts`, `lib/mock-api.ts`, `lib/mock-data.ts` (data dipindah ke seeder), `@supabase/supabase-js` dari `package.json`, env `NEXT_PUBLIC_SUPABASE_*`, `supabase-schema.sql` (sudah diarsipkan ke `ikn-be/docs/`), `USE_BACKEND`/`API_ORIGIN` rewrite, komentar Laravel lama, `/sanctum` mock.
- [ ] Hapus `app/sso/verify/route.ts`; hapus route legacy `/akun/*`, `/register`, `/admin/login` redirect shim bila tidak lagi dirujuk (cek Navbar/AccountNav).
- [ ] `next.config.mjs`: `output: 'standalone'`; `package.json`: `engines.node >= 20`; `.env.example` baru: `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`.
- [ ] Typecheck + lint bersih; `graphify update .`.

**Migration:** tidak ada (backend).
**Endpoint:** tidak ada baru; bila FE membutuhkan field tambahan, tambahkan ke Resource dan catat di kontrak.
**Test:** `npm run typecheck`; smoke manual per modul lewat compose dev (`fe` service aktif); grep memastikan tidak ada `supabase|mock-api|localStorage.*ikn_mock|/sso/` tersisa; skenario end-to-end: register → verifikasi (Mailpit) → approve → checkout → upload bukti → accept → ship → complete.
**Acceptance:** `ikn-fe` berjalan penuh dengan `NEXT_PUBLIC_API_URL` saja; `package.json` tanpa Supabase; halaman History/Visi-Misi/Kontak/Logo berubah saat diedit dari admin.
**Skill:** graphify, ui-ux-pro-max, ui-styling (state loading/error/form), dataviz (grafik admin), code-review, run.

---

## Phase 12 – Hardening & deploy

**Tujuan:** produksi di VPS Hostinger dengan `docker-compose.prod.yml`, CI/CD GHCR, backup teruji, runbook.

**Checklist**
- [ ] `docker-compose.prod.yml`: caddy (satu-satunya `ports:` 80/443, `Caddyfile` `<domain>`→fe, `api.<domain>`→nginx, header keamanan, HSTS), fe, nginx, app, queue, scheduler, db (healthcheck, `depends_on: service_healthy`), `restart: unless-stopped`, limit memori, volume `pgdata`/`storage`/`caddy_data`, tanpa bind mount, tanpa port db.
- [ ] `ikn-fe/Dockerfile` multi-stage node:20-alpine standalone, `ARG NEXT_PUBLIC_API_URL`, user non-root; `API_INTERNAL_URL` runtime env.
- [ ] Tuning: `www.conf` `pm.max_children` dari `PHP_PM_MAX_CHILDREN`, opcache prod, Postgres `shared_buffers`/`effective_cache_size`/`max_connections` lewat `command:` flags.
- [ ] GitHub Actions: `ikn-be` (test di Postgres service → build → push GHCR), `ikn-fe` (typecheck → build dengan build arg → push). Tag `sha` + `latest`; deploy job SSH `docker compose pull && up -d` dengan `IKN_BE_TAG`/`IKN_FE_TAG`.
- [ ] Skrip: `docker/scripts/backup.sh` (pg_dump -Fc + tar storage + rclone, retensi 7 harian/4 mingguan), `restore.sh`, cron host 02:00 WIB, uji restore ke DB sementara.
- [ ] Email produksi: SMTP relay 587 (provider dipilih), SPF/DKIM/DMARC domain pengirim, uji ke Gmail/Outlook tidak masuk spam.
- [ ] Runbook `ikn-be/docs/runbook.md`: provisioning VPS (user `deploy` non-root, SSH key only, ufw 22/80/443, fail2ban, unattended-upgrades, Docker Engine + compose plugin, timezone, swap 2 GB), deploy pertama (`RUN_MIGRATIONS=true` sekali, seeder produksi minimal), update rutin, rollback (pin tag), backup/restore, rotasi log container (`json-file` max-size), alert disk (`df` cron → email), fallback build di server, `queue:failed` dan `queue:retry`, `php artisan down/up`.
- [ ] Hardening aplikasi: `APP_DEBUG=false`, `APP_KEY` dari secret, `SESSION_SECURE_COOKIE=true`, CORS produksi, rate limit final, `security-review` atas auth/upload/webhook, uji `strix-pentest` bila diotorisasi klien.
- [ ] Checklist go-live: domain + DNS (`<domain>`, `api.<domain>`), sertifikat otomatis terbit, `GET /up` 200 lewat caddy, backup pertama sukses dan diverifikasi restore.

**Migration:** tidak ada.
**Endpoint:** tidak ada.
**Test:** pipeline CI hijau; `docker compose -f docker-compose.prod.yml config` valid; `docker compose ... ps` semua healthy; restore ke DB `ikn_restore_test` menghasilkan jumlah baris sama; `curl https://api.<domain>/up`; port scan dari luar hanya 22/80/443 terbuka.
**Acceptance:** situs dan API live via HTTPS; deploy ulang lewat `pull && up -d` tanpa downtime terasa; backup harian ada di object storage; runbook dijalankan sekali penuh oleh orang selain penulis.
**Skill:** graphify, security-review, strix-pentest (dengan otorisasi), run.

---

## Ringkasan urutan dan keterkaitan

| Phase | Bergantung pada | Output utama |
|---|---|---|
| 0 | – | repo, Docker dev, Laravel 8.83.29 di PHP 8.1, test di `ikn_test` |
| 1 | 0 | Sanctum SPA, registrasi+approval, RBAC, audit dasar |
| 2 | 1 | produk/kategori/media/bank/fee/settings, katalog publik |
| 3 | 2 | CMS blok + i18n, seed dari `site.ts` |
| 4 | 2 | ledger stok, ulasan |
| 5 | 1 | wilayah, alamat, geo proxy |
| 6 | 2, 4, 5 | ongkir/pajak/diskon, `OrderCalculator`, `/cart/quote` |
| 7 | 4, 5, 6 | checkout + reservasi + state machine + histori |
| 8 | 7 | pembayaran manual/QRIS statis, expiry, kerangka gateway + webhook |
| 9 | 8 | pengiriman, notifikasi, auto-complete |
| 10 | 9 | dashboard, laporan, audit penuh, WBS, kontak |
| 11 | 10 | FE terintegrasi, Supabase dicabut, `/sso/verify` dihapus |
| 12 | 11 | produksi VPS, CI/CD, backup, runbook |
