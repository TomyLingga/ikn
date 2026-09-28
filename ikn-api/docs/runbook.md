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
| Scheduler jalan? | `... logs scheduler` (harus ada `orders:expire` tiap menit) |
| Maintenance | `... exec app php artisan down --secret=<token>` / `php artisan up` |
| Disk | cron `df -h / | awk 'NR==2 && $5+0 > 85 {print}' | mail -s "IKN disk" it@<domain>` |
| Ruang log container | `json-file` max 10 MB × 5 per service (sudah di compose) |
| Cache config setelah ubah `.env.docker` | `... restart app queue scheduler` (entrypoint meng-cache ulang) |

## 6. Email produksi

Gunakan SMTP relay port 587 (Brevo/Mailgun/Postmark). Pasang SPF (`v=spf1 include:<provider> -all`), DKIM (CNAME dari provider), DMARC (`v=DMARC1; p=quarantine; rua=mailto:dmarc@<domain>`) pada domain pengirim `noreply@<domain>`. Uji kirim ke Gmail dan Outlook, cek folder spam. Verifikasi email customer memakai tautan `FRONTEND_URL/login?verified=1` sehingga `FRONTEND_URL` wajib benar.

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
