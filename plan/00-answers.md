# 00 – Jawaban Discovery dan Keputusan Terkunci

- Tanggal: 2026-09-21
- Menjawab: `plan/00-discovery.md` bagian 6 (pertanyaan terbuka)
- Status: keputusan pemilik proyek, menjadi acuan `01-architecture.md`, `02-api-contract.md`, dan `IMPLEMENTATION_PLAN.md`
- Isi di bawah disalin apa adanya dari instruksi pemilik proyek. Pertanyaan discovery yang tidak dijawab di sini diselesaikan dengan default yang paling mudah diubah dan ditandai **ASUMSI** di `01-architecture.md`.

---

## JAWABAN DISCOVERY

1. Platform: Laravel 8.83.29 + PostgreSQL, API-only, satu-satunya sumber kebenaran.
   Supabase TIDAK dipakai lagi sama sekali.
2. Pembayaran: sekarang diverifikasi manual oleh admin berdasarkan bukti bayar yang dikirim
   customer, dengan batas waktu (expired) yang mengembalikan stok. QRIS dan payment gateway
   disiapkan strukturnya sekarang, diaktifkan nanti.
3. Auth: Sanctum. TIDAK ada SSO; route /sso/verify dihapus dari ikn-fe.
4. Pertanyaan discovery lain yang belum saya jawab: pilih default yang paling mudah diubah,
   tandai sebagai ASUMSI di 01-architecture.md, dan jangan berhenti menunggu.

---

## KEPUTUSAN TERKUNCI

### Stack & struktur
- Laravel Framework 8.83.29 (pin di composer.json), folder ikn-be/, git repo sendiri.
- PHP mengikuti image Docker (8.1), bukan PHP lokal. Setiap package WAJIB dicek kompatibel
  dengan Laravel 8.83.29 + PHP 8.1 sebelum composer require, lalu pin versinya.
- REST API /api/v1, Form Request, API Resource, Policy, service layer.
- Auth Sanctum. Pilih mode cookie SPA (jika FE dan API satu domain induk) atau bearer token,
  dan jelaskan alasannya. Role: super_admin, admin, customer.

### Database: PostgreSQL 16 (pin major version di image)
- Kolom JSON pakai jsonb: konten translatable, konten page_sections, payload payments,
  snapshot order.
- Uang pakai numeric(15,2) atau integer, tidak pernah float.
- Status/enum disimpan sebagai string + konstanta di model (BUKAN enum Postgres / ->enum()).
- Email disimpan lowercase + unique. Pencarian teks pakai ILIKE.
- Aplikasi timezone Asia/Jakarta, database menyimpan UTC.
- Test dijalankan di database Postgres terpisah (ikn_test), BUKAN SQLite.

### Migrasi dari mockup
- Mockup sudah punya halaman admin -> backend API-only. Tidak pakai Filament.
- Supabase dicabut total di Phase 11: client, package, env NEXT_PUBLIC_SUPABASE_*, file
  skema SQL (arsipkan ke docs/ sebagai referensi), mock store localStorage, dan mock
  dispatcher. Tidak ada dual-write, tidak ada fallback ke mock di produksi.
- Kontrak API mengikuti method + path + bentuk data yang SUDAH dipakai `api()` di ikn-fe
  (tabel halaman -> endpoint di discovery), di bawah base /api/v1. Setiap penyimpangan
  dicatat beserta alasannya. Endpoint bertanda ⚠ wajib masuk kontrak.
- 13 tabel Supabase dan mock data adalah REFERENSI untuk ERD dan sumber seeder demo, bukan
  skema yang disalin apa adanya.
- lib/site.ts menjadi seed awal CMS. Halaman publik History, Visi-Misi, Kontak, dan Logo
  Pelanggan wajib membaca dari API, bukan konstanta statis.
- Isi fungsi `api()` diganti HTTP client sungguhan di satu titik, diaktifkan per modul.
- Daftar jejak backend Laravel lama di repo (flag env, route, komentar). Nilai apakah
  kontraknya bisa dipakai ulang.

### Docker (dev & produksi)
- ikn-be/Dockerfile multi-stage: stage build (composer install, --no-dev untuk prod) ->
  runtime php:8.1-fpm. JANGAN 8.2+. Ekstensi: pdo_pgsql, pgsql, mbstring, bcmath, intl, gd,
  zip, exif, pcntl, opcache. Jalan sebagai user non-root.
- Satu image, tiga peran: app (php-fpm), queue (`php artisan queue:work`), scheduler
  (`php artisan schedule:work`). Service lain: nginx, db (postgres:16), mailpit (khusus dev),
  fe (build dari ../ikn-fe, Next.js output standalone; versi Node ikuti package.json).
- ikn-be/docker-compose.yml = dev: bind mount source, vendor/ dan node_modules/ pakai named
  volume, mailpit aktif, port db dibuka, database ikn_test dibuat lewat init script.
- ikn-be/docker-compose.prod.yml = produksi: tanpa bind mount, image hasil build, port db
  TIDAK dibuka, hanya nginx yang expose, restart unless-stopped, healthcheck (pg_isready)
  + depends_on condition: service_healthy.
- Named volume untuk data Postgres dan storage/app. Sertakan script backup (pg_dump + arsip
  storage) dan cara restore.
- .env tidak di-bake ke image. Sediakan .env.docker.example; secret tidak di-commit.
- FE butuh DUA alamat API: NEXT_PUBLIC_API_URL (dipakai browser, build-time lewat build
  args) dan API_INTERNAL_URL (dipakai fetch sisi server Next.js di dalam jaringan Docker,
  mis. http://nginx). Jangan pakai satu variabel untuk keduanya.
- Entrypoint: tunggu db siap, storage:link, config/route cache (prod). Migrasi otomatis hanya
  jika RUN_MIGRATIONS=true. File .sh wajib LF (atur .gitattributes), karena dev di Windows.
- Target produksi: VPS Hostinger (KVM, self-managed), Ubuntu 24.04 LTS, Docker Engine +
  compose plugin. BUKAN shared/cloud hosting. Tidak ada SELinux, tidak perlu :z.
- VPS kosong tanpa reverse proxy -> tambahkan service caddy di docker-compose.prod.yml
  sebagai satu-satunya pintu masuk (80/443, TLS otomatis Let's Encrypt):
  <domain> -> fe, api.<domain> -> nginx. HANYA caddy yang publish port. Service lain tanpa
  `ports:` sama sekali, karena port yang di-publish Docker menembus aturan ufw.
- FE dan API satu domain induk (<domain> + api.<domain>) -> Sanctum mode cookie SPA layak
  dipakai. Atur SESSION_DOMAIN, SANCTUM_STATEFUL_DOMAINS, dan CORS dengan credentials.
- Image di-build di GitHub Actions lalu push ke GHCR. VPS hanya menjalankan
  `docker compose pull && docker compose up -d`. Jangan build Next.js di VPS (RAM terbatas).
  Sediakan fallback terdokumentasi: build di server dengan swap aktif.
- Anggaran resource: asumsikan 2 vCPU / 4-8 GB RAM. Set limit memori per service, opcache
  aktif, pm.max_children php-fpm dihitung dari RAM, shared_buffers Postgres disesuaikan.
- Email: JANGAN kirim langsung dari VPS (port 25 sering diblokir dan reputasi IP VPS buruk,
  email verifikasi bisa masuk spam). Pakai SMTP relay / transactional email provider via
  port 587, kredensial di .env. Runbook memuat setup SPF, DKIM, DMARC domain pengirim.
- Hardening VPS masuk runbook Phase 12: user deploy non-root, SSH key only (password login
  mati), ufw 22/80/443, fail2ban, unattended-upgrades, rotasi log container, alert disk.
- Backup: pg_dump + arsip storage harian via cron, disalin KE LUAR server (object storage),
  retensi 7 harian + 4 mingguan, dengan prosedur uji restore. Snapshot VPS dari provider
  bukan pengganti backup ini.
- Scaffold Laravel di Phase 0 dijalankan DI DALAM container PHP 8.1, bukan image composer:2.
- Semua perintah artisan/composer/test dijalankan via `docker compose exec app ...`.

### Fitur: akun & alamat
- Registrasi: daftar -> verifikasi email -> status pending -> admin approve/reject (dengan
  alasan) -> baru bisa order. Email via queue.
- Alamat customer: banyak alamat; label, nama penerima, no HP, alamat lengkap,
  provinsi/kab/kec/kel (seed dataset wilayah kode Kemendagri), kode pos, lat, lng, catatan,
  is_default.
- Peta GRATIS tanpa API key: Leaflet + tile OpenStreetMap di FE. Search/reverse geocode lewat
  proxy backend ke Nominatim (cache, rate limit 1 req/detik, User-Agent jelas).

### Fitur: stok & reservasi
- Tabel stock_movements sebagai ledger (in, adjust, reserve, release, commit). Stok tidak
  pernah berubah tanpa baris ledger.
- Checkout me-RESERVE stok dalam satu transaksi DB dengan row lock (SELECT ... FOR UPDATE)
  agar tidak oversell saat dua customer checkout bersamaan.
- Stok di-RELEASE saat order expired atau cancelled. Stok di-COMMIT saat paid.
- Release harus idempoten: dijalankan dua kali tidak menambah stok dua kali.

### Fitur: order
- Snapshot alamat, harga, pajak, diskon, ongkir saat checkout.
- State machine: pending_payment -> payment_review -> paid -> processing -> shipped ->
  delivered -> completed (+ cancelled, expired). Tabel order_status_histories untuk timeline
  tracking (catatan, kurir, no resi).
- payment_due_at per order. Default dari setting admin (mis. 24 jam); admin bisa
  memperpanjang per order (endpoint ini sudah dipanggil UI).
- Scheduler tiap menit: order pending_payment yang lewat payment_due_at -> expired + release
  stok + email ke customer. Order berstatus payment_review TIDAK di-expire otomatis karena
  sedang menunggu admin.
- Bukti ditolak admin -> payment rejected, order kembali ke pending_payment; customer boleh
  upload ulang selama belum lewat batas waktu.
- Semua transisi HANYA lewat satu service OrderStateMachine, dipanggil baik oleh aksi admin
  maupun webhook gateway, supaya efek samping (stok, email, histori) selalu sama.

### Fitur: pembayaran
- payment_methods dikelola admin: code, type (manual_transfer, qris_static, qris_dynamic,
  virtual_account, ewallet), driver, is_active, config jsonb, instruksi translatable, urutan.
- AKTIF sekarang: manual_transfer (rekening bank dikelola admin) dan qris_static (admin
  upload gambar QRIS merchant; customer scan, upload bukti, admin verifikasi; alurnya sama
  dengan transfer manual dan tidak butuh gateway).
- DISIAPKAN dengan is_active=false: qris_dynamic, virtual_account, ewallet lewat driver
  gateway.
- Contract PaymentGateway: create, checkStatus, cancel, handleWebhook. ManualDriver
  diimplementasi penuh. XenditDriver berupa kerangka + contract test dengan HTTP fake, belum
  dipakai produksi. Endpoint /api/v1/payments/webhook/{provider} sudah ada: verifikasi
  token/signature, idempoten, simpan payload mentah ke payment_webhook_logs.
- Tabel payments: satu order bisa punya banyak percobaan bayar. Kolom netral-gateway:
  method, provider, external_id (unique per provider), amount, status, expires_at, paid_at,
  payload jsonb, proof_file, verified_by, verified_at, reject_reason.
- Status payment: pending, awaiting_verification, paid, rejected, expired, failed, cancelled.
- Bukti bayar: validasi mime + ukuran, simpan di disk PRIVATE, diakses lewat endpoint
  ber-policy (hanya pemilik order dan admin), bukan public storage.
- Opsional, bisa dimatikan dari setting: kode unik 3 digit pada total transfer manual untuk
  memudahkan admin mencocokkan mutasi rekening.

### Fitur: ongkir, pajak, diskon
- Ongkir beda per alamat: shipping_zones + shipping_rates (mapping wilayah -> tarif flat /
  per kg / minimum / gratis ongkir di atas X), dikelola admin. Interface
  ShippingRateCalculator agar nanti bisa diganti RajaOngkir/Biteship.
- Diskon: voucher (kode, persen/nominal, min belanja, maks potongan, kuota, limit per user,
  periode) + harga promo produk/kategori. Kuota voucher dikembalikan saat order expired.
- Pajak: tarif PPN, harga inklusif/eksklusif, flag taxable per produk.
- Semua hitungan di satu service OrderCalculator dengan unit test.

### Fitur: CMS & bahasa
- CMS berbasis blok, lebih sederhana dari WordPress: pages (slug, status draft/publish, SEO)
  + page_sections (type, urutan, konten jsonb, is_visible), menu, site settings, berita,
  banner, FAQ, media library. Tipe section mengikuti section yang ADA di mockup: admin bisa
  ubah isi, urutan, tampil/sembunyi, tapi tidak bisa merusak desain.
- Bilingual id/en: kolom translatable jsonb, header Accept-Language, fallback id, pesan
  validasi dua bahasa.

### Lintas modul
- Feature test PHPUnit per modul, dokumentasi OpenAPI, seeder demo yang cocok dengan mockup,
  audit log aksi admin, rate limit endpoint auth.
- Test wajib untuk: checkout bersamaan (tidak oversell), expiry (stok + kuota voucher
  kembali, idempoten), tolak bukti lalu upload ulang, webhook ganda (idempoten).

### OUTPUT yang diminta
- plan/01-architecture.md : keputusan + ASUMSI + ERD (mermaid) + diagram state order dan
  payment + alur reservasi stok + diagram service Docker (dev dan prod)
- plan/02-api-contract.md : endpoint per modul, contoh request/response, kode error, dan
  tabel selisih terhadap path yang dipakai `api()` di ikn-fe
- plan/IMPLEMENTATION_PLAN.md : phase berurutan, masing-masing berisi tujuan, checklist task,
  migration, endpoint, test, acceptance criteria, dan skill yang dipakai.
  Urutan: 0 scaffold + Docker dev (selesai jika `docker compose up` sehat dan koneksi
  Postgres terbukti jalan) -> 1 auth & approval -> 2 master data & media -> 3 CMS & i18n
  -> 4 katalog + stok (ledger) -> 5 alamat & geo -> 6 ongkir/pajak/diskon -> 7 cart,
  checkout, reservasi stok -> 8 pembayaran (manual + qris_static + expiry + kerangka gateway
  & webhook) -> 9 pengiriman & notifikasi -> 10 dashboard & audit -> 11 integrasi FE per
  modul + pencabutan Supabase + hapus /sso/verify -> 12 hardening & deploy
  (docker-compose.prod.yml, Dockerfile ikn-fe, runbook deploy + rollback + backup/restore).
- CLAUDE.md di root: konvensi kode, perintah penting (semua via docker compose exec), aturan
  kerja per phase.
