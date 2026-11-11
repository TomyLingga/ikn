# Pratinjau untuk klien di PC Windows (Tailscale Funnel)

Situs pratinjau berjalan di PC Windows yang menyala terus dan dibuka klien lewat alamat HTTPS dari Tailscale, misalnya `https://ikn-demo.tail1234.ts.net`. Router tidak perlu dibuka portnya, dan domain tidak diperlukan. Pratinjau ini bukan untuk produksi.

```
Klien → https://ikn-demo.<tailnet>.ts.net → Tailscale Funnel → proxy :8080 → Next.js :3000
                                                                           → Laravel :8000 (/api, /sanctum, /storage)
```

Yang jalan di PC (otomatis saat PC menyala, lewat Task Scheduler "IKN Preview"):

| Proses | Tugas |
|---|---|
| Laravel (`php -S` 127.0.0.1:8000) | API |
| Scheduler (`php artisan schedule:work`) | Pesanan kedaluwarsa, penawaran ongkir CIF, kurs JISDOR harian |
| Next.js versi build (127.0.0.1:3000) | Situs, portal pelanggan, panel admin |
| `proxy.js` (127.0.0.1:8080) | Menyatukan situs dan API di satu alamat, menambah header `noindex` |

Proses yang berhenti dinyalakan lagi dalam 15 detik. Semua hanya mendengar di 127.0.0.1; yang terbuka ke internet hanya Funnel.

## 1. Pasang program di PC (sekali)

1. **Git**: https://git-scm.com/download/win
2. **PHP 8.2 x64 (Thread Safe)**: unduh zip dari https://windows.php.net/download, ekstrak ke `C:\php`, tambahkan `C:\php` ke PATH.
   Salin `php.ini-production` menjadi `php.ini`, lalu ubah:
   - aktifkan (hapus `;`): `extension_dir = "ext"`, `extension=bcmath`, `curl`, `fileinfo`, `gd`, `mbstring`, `openssl`, `pdo_pgsql`, `pgsql`, `zip`, `exif`
   - `upload_max_filesize = 102M`, `post_max_size = 105M`, `memory_limit = 512M`
3. **Composer**: https://getcomposer.org/Composer-Setup.exe (pilih `C:\php\php.exe` saat ditanya).
4. **Node.js 20 LTS**: https://nodejs.org
5. **PostgreSQL 17**: https://www.postgresql.org/download/windows/ dan **catat password user `postgres`**.
6. **Tailscale**: https://tailscale.com/download/windows, lalu login.

Buka PowerShell baru (agar PATH terbaru terbaca) dan cek: `git --version`, `php -v`, `composer -V`, `node -v`, `tailscale status`.

## 2. Siapkan Tailscale (sekali, di https://login.tailscale.com/admin)

1. **Machines**: ubah nama PC menjadi nama yang enak dibaca, misalnya `ikn-demo`. Nama ini menjadi bagian alamat yang dikirim ke klien. Lakukan **sebelum** setup, karena alamat dimasukkan ke hasil build.
2. **DNS**: pastikan **MagicDNS** aktif, lalu aktifkan **HTTPS Certificates**.
3. Funnel diaktifkan saat setup: bila Tailscale mencetak tautan "Funnel is not enabled", buka tautan itu dan setujui.

## 3. Ambil kode (sekali)

Pakai folder tanpa spasi:

```powershell
git clone https://github.com/TomyLingga/ikn.git C:\ikn
```

Bila repo privat, Git meminta login GitHub.

## 4. Jalankan setup (sekali)

PowerShell **Run as administrator**:

```powershell
cd C:\ikn
powershell -ExecutionPolicy Bypass -File deploy\preview\setup.ps1 -DbPassword "PASSWORD_POSTGRES" -AdminPassword "PasswordAdminBaru1"
```

Setup akan:
1. Mengecek program dan extension PHP.
2. Membaca alamat Tailscale PC ini.
3. Membuat database `ikn_preview` (terpisah dari data laptop).
4. Menulis `ikn-api\.env` dan `ikn-fe\.env.production.local` untuk alamat itu.
5. `composer install`, migrasi, `npm ci`, build Next (beberapa menit).
6. Mengisi data demo dan kurs JISDOR setahun (hanya saat database baru).
7. Mendaftarkan task "IKN Preview" (jalan saat PC menyala) dan mematikan sleep saat dicolok listrik.
8. Menyalakan pratinjau dan Tailscale Funnel.

Di akhir, alamat pratinjau dicetak. `-AdminPassword` mengganti password `superadmin@ptikn.com` pada data awal. Bila dikosongkan, passwordnya `password`.

## 5. Cek

Buka alamat itu dari HP memakai **data seluler** (bukan Wi-Fi yang sama dengan PC):
- beranda dan gambar tampil;
- masuk sebagai admin dan pelanggan demo;
- buka satu halaman produk dan keranjang.

## 6. Update setelah ada perubahan dari laptop

Di laptop: commit dan push ke GitHub. Di PC (PowerShell administrator):

```powershell
cd C:\ikn
powershell -ExecutionPolicy Bypass -File deploy\preview\update.ps1
```

Skrip menghentikan pratinjau, `git pull`, menjalankan migrasi, build ulang, lalu menyalakan lagi. Data pratinjau (akun klien, pesanan uji) tetap ada.
Tambahkan `-Fresh` untuk mengembalikan semua data ke data demo. Semua yang dibuat klien ikut terhapus.

## 7. Perintah lain

| Perlu | Perintah (PowerShell administrator, dari `C:\ikn`) |
|---|---|
| Matikan sementara | `powershell -ExecutionPolicy Bypass -File deploy\preview\stop.ps1` |
| Matikan dan tutup alamat publik | `... stop.ps1 -Unpublish` |
| Nyalakan lagi | `... start.ps1` (tambah `-Publish` bila tadi `-Unpublish`) |
| Lihat log | folder `deploy\preview\logs` (`supervisor.log`, `api.err.log`, `fe.log`, `scheduler.log`) |
| Ganti nama PC di Tailscale | ubah di admin console, lalu jalankan `setup.ps1` lagi dengan parameter yang sama |

## 8. Perlu disadari

- **Siapa pun yang tahu alamatnya bisa membuka situs dan masuk dengan akun demo.** Password akun demo lain (`konten@`, `penjualan@`, pelanggan demo) tetap `password`. Bagikan alamat hanya ke klien; ganti password akun admin lewat panel admin bila perlu.
- **Email tidak terkirim** kecuali SMTP diisi di Admin → Pengaturan Situs → Notifikasi email. Tanpa itu, pendaftaran akun baru tidak bisa diverifikasi; arahkan klien memakai akun demo.
- **Mesin pencari**: setiap respons diberi header `X-Robots-Tag: noindex`, jadi pratinjau tidak masuk Google.
- **PC mati = situs mati.** Setelah listrik kembali atau Windows Update restart, pratinjau menyala sendiri (tidak perlu login Windows).
- API berjalan dengan server bawaan PHP (satu request sekaligus). Cukup untuk beberapa orang yang melihat bersamaan, tidak untuk banyak pengunjung.

## 9. Masalah umum

| Gejala | Penyebab dan tindakan |
|---|---|
| Alamat tidak bisa dibuka sama sekali | Funnel belum aktif: `tailscale funnel status`. Jalankan `tailscale funnel --bg 8080`, setujui tautan bila muncul. |
| "Server web/API sedang dinyalakan ulang" | Proses baru restart; tunggu 20 detik. Bila terus, lihat `logs\fe.err.log` / `logs\api.err.log`. |
| Masuk akun gagal, langsung keluar lagi | Alamat di `.env` tidak sama dengan alamat yang dibuka (nama PC diganti). Jalankan `setup.ps1` lagi. |
| Gambar tidak tampil | `logs\api.err.log`; pastikan `extension=gd` dan `fileinfo` aktif. |
| Kurs JISDOR kosong | Bank Indonesia menolak request. Coba lagi nanti: `php artisan rates:fetch --from=2025-11-01` dari `C:\ikn\ikn-api`. |
| Setup gagal di "Tidak bisa masuk ke PostgreSQL" | Password `postgres` salah atau service PostgreSQL mati (Services → postgresql-x64-17). |
