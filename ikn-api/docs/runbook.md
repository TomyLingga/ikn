# Runbook deploy ikn (VPS Hostinger, Ubuntu 24.04, Docker)

Dokumen operasional untuk tim TI. Arsitektur: `caddy` (80/443, TLS otomatis) → `fe` (Next.js standalone) dan `nginx` → `app` (php-fpm), plus `queue`, `scheduler`, `db` (Postgres 16). Hanya `caddy` yang mem-publish port. Image dibangun GitHub Actions dan disimpan di GHCR; VPS hanya `pull && up -d`.

> Status 2026-09-28: berkas Docker/CI/backup ditulis mengikuti `plan/01-architecture.md` bagian 10 tetapi **belum diuji** di mesin dev karena Docker tidak terpasang (ASUMSI A-27). Uji penuh dilakukan saat provisioning VPS.

## 1. Provisioning VPS (sekali)

```bash
# sebagai root
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && systemctl restart ssh
apt update && apt install -y ufw fail2ban unattended-upgrades ca-certificates curl gnupg rclone
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
timedatectl set-timezone Asia/Jakarta
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
# Docker Engine + compose plugin (repo resmi Docker)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker deploy
```

Docker mem-publish port di luar ufw; karena itu hanya `caddy` yang boleh punya `ports:` (sudah demikian di `docker-compose.prod.yml`).

## 2. Deploy pertama

1. DNS: `A` record `<domain>` dan `api.<domain>` → IP VPS (dan `www`).
2. Di VPS sebagai `deploy`: `mkdir -p /opt/ikn && cd /opt/ikn`, salin `docker-compose.prod.yml`, `Caddyfile`, `docker/nginx/default.conf` (simpan sebagai `nginx.conf`), `docker/scripts/backup.sh`, `docker/scripts/restore.sh`, dan buat `.env.docker` dari `.env.docker.example` (isi rahasia: `APP_KEY` dari `php artisan key:generate --show` di mesin dev, `DB_PASSWORD`/`POSTGRES_PASSWORD`, SMTP, domain) serta `.env.fe` (kosong boleh; `API_INTERNAL_URL` sudah diset compose).
3. Login GHCR: `echo <token-read-packages> | docker login ghcr.io -u <user> --password-stdin`.
4. Jalankan migrasi sekali: `RUN_MIGRATIONS=true docker compose -f docker-compose.prod.yml up -d` lalu setelah sehat: `docker compose -f docker-compose.prod.yml exec app php artisan db:seed --class=UserSeeder` (hanya super admin dari `SEED_*`), dan bila perlu `RegionSeeder`, `CommerceConfigSeeder`.
5. Cek: `curl -fsS https://api.<domain>/up`, buka `https://<domain>`, login admin, ganti password super admin.
6. Set `RUN_MIGRATIONS=false` di `.env.docker` untuk deploy berikutnya (migrasi dijalankan sadar lewat workflow `deploy` input `run_migrations`).

## 3. Update rutin

- Push ke `main` → workflow `ikn-api` (test di Postgres, build, push) dan `ikn-fe` (typecheck, lint, build dengan `NEXT_PUBLIC_API_URL` dari GitHub Variables) → jalankan workflow `deploy` (input tag `sha` atau `latest`, `run_migrations` bila ada migrasi baru).
- Manual di VPS: `cd /opt/ikn && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.
- Rollback: set `IKN_API_TAG`/`IKN_FE_TAG` ke sha sebelumnya di `.env.docker`, lalu `up -d`. Migrasi tidak di-rollback otomatis; gunakan backup bila skema berubah.
- Phase E2 (cara serah terima): deploy API dan FE dalam satu kali `up -d` dengan `run_migrations`. Migrasi `delivery_terms` mengisi Loco sebagai term bawaan (Franco nonaktif); bundel FE lama tidak mengirim `deliveryTermCode` dan tidak bisa memilih tarif zona, jadi API baru dengan FE lama membuat semua checkout menjadi ambil di pabrik. Bila Franco harus tetap bawaan, aktifkan dan naikkan urutannya di Admin > Pengiriman > Cara serah terima setelah migrasi.

## 4. Backup dan restore

- `backup.sh` dijalankan cron host jam 02:00 WIB: `pg_dump -Fc` + `tar storage/app` → `/var/backups/ikn` → `rclone sync` ke object storage (remote `r2:ikn-backup`, ASUMSI A-20). Retensi 7 harian + 4 mingguan.
- Uji restore bulanan: `./restore.sh /var/backups/ikn/daily/db-<stamp>.dump` (restore ke `ikn_restore_test`, tampilkan jumlah baris, tidak mengubah produksi).
- Restore sungguhan: `./restore.sh db.dump storage.tar.gz --apply` (menghentikan app/queue/scheduler sementara).
- Snapshot VPS provider bukan pengganti backup ini.

## 5. Operasional harian

| Kebutuhan | Perintah |
|---|---|
| Status container | `docker compose -f docker-compose.prod.yml ps` |
| Log API | `docker compose -f docker-compose.prod.yml logs -f --tail=200 app` |
| Antrean gagal | `... exec app php artisan queue:failed` / `queue:retry all` |
| Scheduler jalan? | `... logs scheduler` (harus ada `orders:expire` tiap menit, `orders:remind` dan `orders:freight-expire` tiap 15 menit, `orders:auto-complete` 01:00, `rates:fetch` tiap jam 10:00-17:00 hari kerja) |
| Kurs JISDOR kosong/basi | `... exec app php artisan rates:fetch` (opsi `--from=Y-m-d --to=Y-m-d`, `--dry-run`); terjadwal hari kerja tiap jam 10:00-17:00 WIB. Bila BI menutup koneksi, isi `JISDOR_USER_AGENT` di `.env.docker` dengan domain dan email nyata lalu restart `scheduler` |
| Maintenance | `... exec app php artisan down --secret=<token>` / `php artisan up` |
| Disk | cron `df -h / | awk 'NR==2 && $5+0 > 85 {print}' | mail -s "IKN disk" it@<domain>` |
| Ruang log container | `json-file` max 10 MB × 5 per service (sudah di compose) |
| Cache config setelah ubah `.env.docker` | `... restart app queue scheduler` (entrypoint meng-cache ulang) |

### 5.1 Ekspor (E1-E5)

Fitur ekspor (kurs JISDOR, cara serah terima, order USD, proforma, penawaran ongkir CIF; ASUMSI A-84..A-89) menambah hal berikut pada operasional.

- **Env baru** `JISDOR_USER_AGENT` (lihat `.env.docker.example`): isi dengan domain dan alamat email kontak yang nyata, misalnya `IKN-Web/1.0 (+https://www.ptikn.co.id; it@ptikn.co.id)`. Web service BI menutup koneksi tanpa User-Agent yang jelas, jadi `rates:fetch` akan gagal diam-diam (tercatat di log) bila nilai contoh dibiarkan. `JISDOR_BASE_URL` tidak perlu diubah.
- **Scheduler** kini juga harus memperlihatkan di `logs scheduler`: `rates:fetch` tiap jam pada 10:00-17:00 WIB hari kerja (Senin-Jumat; akhir pekan memang kosong) dan `orders:freight-expire` tiap 15 menit (menandai penawaran ongkir kedaluwarsa dan membatalkan order `awaiting_freight` yang melewati `freightQuoteMaxDays`). Pemeriksaan manual: `... exec app php artisan rates:fetch --dry-run`. `orders:freight-expire` tidak punya opsi `--dry-run`; untuk memeriksa order yang menunggu ongkir, buka tab "Penawaran ongkir" di Order admin.
- **Migrasi yang ditambahkan sejak 2026-11-02** (jalankan lewat workflow `deploy` dengan `run_migrations`): `2026_11_02_000010_create_exchange_rates_table`, `2026_11_02_000020_create_delivery_terms_table`, `2026_11_02_000030_add_delivery_term_to_orders_table`, `2026_11_03_000010_add_market_to_customer_profiles_table`, `2026_11_03_000020_add_price_usd_to_products_table`, `2026_11_03_000030_add_currency_and_payment_term_to_orders_table`, `2026_11_03_000040_add_currency_to_order_items_table`, `2026_11_03_000050_add_currency_and_received_fields_to_payments_table`, `2026_11_03_000060_add_currency_to_fees_table`, `2026_11_03_000070_add_currency_and_swift_to_bank_accounts_table`, `2026_11_03_000080_add_tax_profile_to_delivery_terms_table`, `2026_11_03_000090_create_payment_terms_table`, `2026_11_03_000100_create_order_proformas_table`, `2026_11_03_000110_add_destination_port_to_orders_table`, `2026_11_03_000120_create_order_freight_quotes_table`, `2026_11_04_000010_create_factory_locations_table` (migrasi data: dua pabrik dari pengaturan lama `pickup_*`/`shipping_origin_*`, lalu kunci lama dihapus; ASUMSI A-90), `2026_11_04_000020_add_factory_location_id_to_products_table` (produk lama tetap null = pabrik pertama; atur pabrik Resiprene di form produk).
- **Data bawaan tanpa seeder.** Migrasi `create_delivery_terms_table` mengisi baris Loco (aktif), Franco (nonaktif), FOB Belawan dan CIF bila tabel kosong, `add_delivery_term_to_orders_table` mem-backfill order lama ke `franco`, `add_tax_profile_to_delivery_terms_table` menandai FOB/CIF `export`, dan `create_payment_terms_table` mengisi `tt_advance` dan `tt_30_70` bila tabel kosong. Order lama otomatis `currency = IDR`, profil customer lama `market = local`, `country_code = ID`. Jadi produksi **tidak** menjalankan `DeliveryTermSeeder`, `PaymentTermSeeder`, `CommerceDemoSeeder`, `DemoCasesSeeder`, `CustomerSeeder`, `CatalogSeeder` (semuanya data demo); seeder yang boleh dijalankan di produksi tetap hanya `UserSeeder`, dan bila perlu `RegionSeeder` serta `CommerceConfigSeeder` (lihat bagian 2). Pengaturan ekspor (`exportTaxRate`, `exportPaymentDueHours`, `freightQuoteValidDays`, `freightQuoteMaxDays`, titik ambil Loco) dibuat dengan nilai bawaan oleh `SettingsService` dan diubah admin di Pengaturan Checkout / Ongkir.
- **Deploy FE dan API bersamaan** dalam satu `up -d` dengan `run_migrations`. API baru dengan bundel FE lama: checkout tidak mengirim `deliveryTermCode` sehingga semua order lokal menjadi Loco (lihat bagian 3), customer ekspor tidak bisa memilih syarat bayar (422 `paymentTermCode`), dan angka USD tampil tanpa format mata uang. FE baru dengan API lama: field `currency`, `deliveryTerm`, `paymentTerm`, `byCurrency`, `exportKpis` kosong sehingga blok ekspor dan label mata uang tidak muncul. Setelah deploy: cek `/admin/shipping` tab Serah terima (Franco aktifkan bila masih dipakai), `/admin/bank-accounts` punya rekening USD aktif ber-SWIFT sebelum customer ekspor pertama disetujui, dan `/admin/reports/exchange-rates` terisi setelah `rates:fetch` pertama.

## 6. Email produksi

Admin dapat memasang SMTP webmail perusahaan (cPanel/Hostinger: `smtp.<domain>` atau `smtp.hostinger.com`, port 465 SSL, username = alamat email penuh) di **Pengaturan Situs → Notifikasi email**, lalu menekan "Kirim email uji"; nilai itu menimpa `MAIL_*` tanpa restart (worker antrean menerapkannya sebelum tiap job). `MAIL_*` di `.env.docker` hanya dipakai pada mode "Ikuti konfigurasi server". Alternatif: SMTP relay port 587 (Brevo/Mailgun/Postmark). Pasang SPF (`v=spf1 include:<provider> -all`), DKIM (CNAME dari provider), DMARC (`v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`) pada domain pengirim `noreply@<domain>`. Uji kirim ke Gmail dan Outlook, cek folder spam. Verifikasi email customer memakai tautan `FRONTEND_URL/login?verified=1` sehingga `FRONTEND_URL` wajib benar.

## 7. Hardening aplikasi

`APP_DEBUG=false`, `APP_KEY` dari secret, `SESSION_SECURE_COOKIE=true`, `SESSION_DOMAIN=.<domain>`, `SANCTUM_STATEFUL_DOMAINS` dan `CORS_ALLOWED_ORIGINS` hanya domain resmi, rate limit sudah di kode (login 5/menit, register 3/menit, form publik 5/jam, geo 60/menit), webhook gateway hanya diterima dengan token callback yang cocok. Bukti bayar dan lampiran WBS ada di disk `private` (tidak pernah dilayani nginx). Jalankan `security-review` sebelum go-live; uji penetrasi hanya dengan otorisasi tertulis klien.

## 8. Fallback build di server

Bila GHCR tidak bisa dipakai: aktifkan swap (langkah 1), lalu `docker compose -f docker-compose.prod.yml build` dengan `build:` sementara ditambahkan pada service `app`/`fe` (context `../ikn-api`, `../ikn-fe`, `--build-arg NEXT_PUBLIC_API_URL=...`). Build Next.js butuh ±2 GB RAM.

## 9. Checklist go-live

- [ ] DNS `<domain>`, `www`, `api.<domain>` mengarah ke VPS; sertifikat terbit (lihat `docker compose logs caddy`).
- [ ] `GET https://api.<domain>/up` 200; login admin; `/admin/settings` berisi nilai pajak/jatuh tempo yang benar; rekening bank dan metode bayar aktif sesuai.
- [ ] Email verifikasi sampai ke inbox (bukan spam).
- [ ] Backup pertama sukses dan diuji restore ke `ikn_restore_test`.
- [ ] Port scan dari luar: hanya 22/80/443 terbuka.
- [ ] Password super admin bawaan sudah diganti; akun demo (`konten@`, `buyer@`, `pending@`, `ditolak@`) dihapus atau dinonaktifkan.
