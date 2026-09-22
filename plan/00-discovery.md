# 00 – Discovery: Website Company Profile + E-Commerce PT Industri Karet Nusantara (IKN)

- Tanggal: 2026-09-19
- Status: discovery selesai, menunggu jawaban pertanyaan terbuka (bagian 6) sebelum desain backend
- Sumber: `doc/` (3 file), `ikn-fe/` (mockup Next.js), `graphify-out/` (knowledge graph 886 node / 72 komunitas)
- Tidak ada kode aplikasi yang diubah dan tidak ada paket yang diinstal pada sesi ini

---

## 1. Skill yang tersedia dan rencana pemakaian

Skill project: **tidak ada** (`.claude/` di root hanya berisi `settings.json` untuk hook graphify; `ikn-fe/` tidak punya `.claude/`).

| Skill | Sumber | Relevan | Tahap pemakaian |
|---|---|---|---|
| graphify | global | Ya | Semua tahap. Query graph sebelum membuka file, `graphify update .` setelah ubah kode. Hook PreToolUse sudah aktif. |
| anthropic-skills:xlsx | plugin | Ya | Discovery dan dokumen scope. Sesi ini dependensinya (openpyxl/pandas) tidak ada, jadi konversi memakai skrip stdlib. |
| anthropic-skills:pdf | plugin | Ya | Discovery (user flow), nanti pembuatan invoice PDF bila disetujui. |
| anthropic-skills:docx / pptx | plugin | Ya, nanti | Dokumen SRS / proposal / laporan progres ke klien. |
| anthropic-skills:docs | plugin | Opsional | Dokumen hidup yang bisa dikomentari klien (SRS, API contract). |
| ui-ux-pro-max, ui-styling, design-system | global | Ya, nanti | Tahap penyempurnaan UI setelah backend jadi (form validasi, state loading/error, tabel admin, aksesibilitas). |
| design, brand, banner-design | global | Terbatas | Identitas RUBIN/IKN sudah ada di aset. Dipakai hanya jika klien minta aset visual baru. |
| dataviz | global | Ya, nanti | Dashboard admin dan laporan penjualan (`AdminSalesChart`). |
| slides | global | Ya, nanti | Presentasi hasil discovery / demo ke klien. |
| code-review, simplify, security-review | global | Ya | Tahap implementasi: review PR, khususnya auth, RLS, dan upload file. |
| strix-pentest | global | Ya, pra-rilis | Pentest sebelum go-live, dengan otorisasi tertulis dari klien. |
| run | global | Ya | Verifikasi perubahan di app yang berjalan. |
| update-config, fewer-permission-prompts, keybindings-help, loop, schedule, workflow-authoring, init, claude-api, artifact-*, morning, import-memory, setup-writing-style, skill-creator | global/plugin | Tidak | Tooling harness, tidak terkait domain proyek. |

Catatan: folder `~/.claude/skills/synced/` berisi satu bundle dengan nama ID acak dan tidak saya buka.

---

## 2. Ringkasan ruang lingkup dari `doc/`

### 2.1 `Ruang lingkup.xlsx` (4 sheet, semua item berstatus "Open")

Tabel hasil konversi lengkap ada di Lampiran A.

**Sheet Viewers (situs publik, referensi "Sesuai Mock up")**
Home; About Us (History, Vision and Mission, Contact Us); Business (Resiprene Products, Rubber Articles Products); Media (Gallery, News); Sustainability (Certificate, Our Customers, Brochure Resiprene 35, Brochure Rubber Articles, Whistle Blowing System, Reach Compliance); Fitur Bahasa Indonesia–Inggris.

**Sheet E-commerce (sisi customer)**
Registrasi, Login, Profil Customer, Home, Company Profil, Product Catalog (Detail, Search, Category), Shopping Cart, Check out, Payment (Invoice), History Order, Tracking Order, Review Product.

**Sheet Catalog (detail halaman katalog)**
Informasi produk: gambar, nama, kategori, harga, status stok. Pendukung: jumlah ulasan, spesifikasi. Tombol: lihat detail, tambah ke keranjang. Filter/search: kategori, nama. Pagination.

**Sheet Admin**
Login; Dashboard; Manajemen Category Product; Manajemen Product; Manajemen Customer; Manajemen Order (bisa atur batas waktu pembayaran); Manajemen Akun Bank; Manajemen Tambahan Biaya (ongkir, biaya admin); Manajemen Payment; Laporan Penjualan; Manajemen Menu (Konten video/gambar, News, Certificate, History, Vision and Mission, Contact Us, Gallery, Brochure); Manajemen Whistle Blowing System; Manajemen User (Super Admin dan Admin).

### 2.2 `User Flow E-Commerce.pdf` (1 halaman, 2 diagram)

**Customer:** kunjungi website → lihat katalog → pilih produk → checkout keranjang → isi alamat dan pilih pengiriman → order dibuat (status *Menunggu pembayaran*) → sistem tampilkan informasi (no order, total tagihan, rekening bank, batas waktu pembayaran) → pelanggan transfer → upload bukti pembayaran (status *Menunggu konfirmasi*) → konfirmasi barang diterima → selesai.

**Admin:** terima notifikasi pesanan → verifikasi pembayaran (cek bukti transfer, nominal, rekening tujuan, mutasi rekening) → keputusan *Pembayaran valid?* → YA: status *Dibayar* → proses pesanan (packaging); TIDAK: status *Ditolak + alasan* → pelanggan upload ulang bukti → barang dikirim (*Dikirim*) → pelanggan menerima → status *Selesai*.

Model pembayaran di dokumen ini: **transfer bank manual dengan verifikasi admin**, tanpa payment gateway.

Anomali diagram: cabang "Ditolak → upload ulang" digambar langsung menyatu ke "Barang dikirim", padahal secara logika harus kembali ke "Verifikasi pembayaran". Mockup FE sudah mengimplementasikan loop yang benar (status `awaiting_verification` setelah upload ulang).

### 2.3 `modul_referensi_manajemen_pembayaran.png`

Mockup tabel "Pada Modul Manajemen Pembayaran, admin dapat melihat informasi seperti": kolom No, Invoice, Customer, Metode, Status, Tanggal. Contoh baris: INV001 Andi QRIS **Paid**; INV002 Budi VA BCA **Pending**; INV003 Citra E-Wallet **Expired**; INV004 Dedi Transfer **Failed**.

Model pembayaran di gambar ini: **payment gateway** (QRIS, Virtual Account, E-Wallet) dengan status khas gateway (Pending/Paid/Expired/Failed). Header tabel bergeser satu kolom terhadap datanya (kolom "No" berisi nomor invoice, kolom "Tanggal" kosong), kemungkinan kesalahan layout mockup.

### 2.4 Konflik antar dokumen yang harus diputuskan

| Topik | PDF user flow | PNG referensi | Mockup ikn-fe saat ini |
|---|---|---|---|
| Metode bayar | Transfer manual ke rekening perusahaan | QRIS, VA BCA, E-Wallet, Transfer | Transfer manual (pilih bank dari daftar rekening) |
| Verifikasi | Admin cek bukti transfer | Otomatis (implisit dari status gateway) | Admin accept/reject bukti |
| Status bayar | Menunggu pembayaran / Menunggu konfirmasi / Dibayar / Ditolak | Pending / Paid / Expired / Failed | `unpaid`, `awaiting_confirmation`, `paid`, `rejected`, `expired` |
| Invoice | Tidak disebut | Nomor INV001.. | Section "Invoice" HTML di detail pesanan, nomor order `IKN-YYYYMMDD-NNNNN` |

---

## 3. Peta `ikn-fe`

### 3.1 Stack

| Item | Nilai |
|---|---|
| Framework | Next.js `^14.2.35`, App Router, TypeScript `^5.7.3` |
| React | 18.3.1 |
| Dependency runtime lain | Hanya `@supabase/supabase-js ^2.112.3` |
| Fetching / state library | Tidak ada (tanpa react-query, SWR, zustand, redux) |
| i18n library | Tidak ada (custom) |
| Middleware Next.js | Tidak ada |
| Script | `dev`, `build`, `start`, `lint`, `typecheck` |
| Env | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`; komentar menyebut `USE_BACKEND` dan `API_ORIGIN` untuk backend Laravel yang "dinonaktifkan" |
| Skema DB | `ikn-fe/supabase-schema.sql` (13 tabel + RLS + seed) |

### 3.2 Daftar route (54: 53 `page.tsx` + 1 `route.ts`)

**Situs publik (`(site)`, tanpa guard)**
`/`, `/tentang`, `/produk`, `/catalog`, `/catalog/[slug]`, `/catalog/kategori/[slug]`, `/berita`, `/berita/[slug]`, `/galeri`, `/unduhan`, `/keberlanjutan`, `/keberlanjutan/pelanggan`, `/keberlanjutan/reach`, `/keberlanjutan/sertifikat`, `/keberlanjutan/whistleblowing`, `/kontak`, `/cart`, `/checkout`.
Legacy redirect: `/akun`, `/akun/pesanan`, `/akun/pesanan/[number]`, `/akun/profil` → `/dashboard/*`.

**Auth (`(auth)`)**
`/login` (mode customer / admin / register via query `mode`), `/register` → redirect `/login?mode=register`.

**Dashboard customer (`(customer)`, guard `CustomerShell` → `CustomerGuard`)**
`/dashboard`, `/dashboard/katalog`, `/dashboard/pesanan`, `/dashboard/pesanan/[number]`, `/dashboard/profil`, `/dashboard/perusahaan`, `/dashboard/alamat`.

**Admin (`(admin)`, guard `AdminShell`, sidebar difilter oleh `GET /admin/permissions/self`)**
`/admin`, `/admin/orders`, `/admin/orders/[number]`, `/admin/payments`, `/admin/products`, `/admin/product-categories`, `/admin/customers`, `/admin/bank-accounts`, `/admin/additional-fees`, `/admin/reports/sales`, `/admin/navigation`, `/admin/content/media`, `/admin/gallery`, `/admin/news`, `/admin/certificates`, `/admin/brochures`, `/admin/history`, `/admin/vision-mission`, `/admin/contact`, `/admin/whistleblowing`, `/admin/users`, `/admin/login` (legacy → `/login`).

**API route**
`/sso/verify` (GET dan POST): stub yang selalu mengembalikan `{ success: true, verified: false }`. Tidak ada logika SSO.

### 3.3 Sumber data saat ini

Ada **dua jalur data yang berbeda** dan **dua sumber kebenaran**:

```
Halaman publik (RSC)
  └─ lib/server-data.ts  ──try──▶ lib/supabase-service.ts (*FromDb)  ──▶ Supabase
                         └─catch─▶ lib/mock-data.ts (MOCK_*)

Halaman client (customer + admin + auth)
  └─ lib/api.ts api()  ──selalu──▶ lib/mock-api.ts handleMockApi()
                                     ├─ baca/tulis localStorage (key ikn_mock_*)
                                     └─ tulis ke Supabase fire-and-forget:
                                        saveOrderToDb(...).catch(() => {})  (31 lokasi)
```

Fakta kunci:
- `api()` **tidak pernah** melakukan HTTP request. Tidak ada base URL, tidak ada `fetch`. Rewrite `/api/*`, `/sanctum/*`, `/storage/*` di `next.config.mjs` (aktif hanya jika `USE_BACKEND=true`) adalah jalur mati.
- Auth (`/auth/login`, `/auth/admin/login`, `/auth/register`, `/auth/me`, `/auth/logout`) sepenuhnya mock. Komentar `AuthProvider` masih menyebut Laravel Sanctum. Supabase Auth tidak dipakai. Sisa `/sanctum/csrf-cookie` ada di mock.
- Data transaksi (order, profil, alamat) hidup di localStorage **per browser**. Admin di browser lain tidak melihat order customer kecuali lewat mirror Supabase, dan mirror itu hanya untuk tulis, tidak dibaca balik oleh halaman client.
- Skema Supabase mengaktifkan RLS tetapi setiap tabel diberi policy `FOR ALL USING (true) WITH CHECK (true)`. Dengan anon key di sisi klien, **semua tabel bisa dibaca dan ditulis siapa pun**.
- Skema tidak punya tabel akun/password. `admin_users` tanpa kredensial; akun customer tidak ada di skema (hanya `customer_profiles`).
- Upload file (`POST /admin/media`, bukti transfer) hanya disimulasikan. Path aset seperti `/storage/*.pdf` tidak punya backend penyimpanan.
- `fetchBlock()` dan `fetchCustomerLogos()` selalu mengembalikan fallback statis, jadi halaman publik History, Visi-Misi, Kontak, dan Logo Pelanggan **tidak membaca hasil edit admin** (`/admin/blocks/*`).

### 3.4 Bentuk data entitas (dari `lib/types.ts` dan `supabase-schema.sql`)

| Entitas (TS) | Field kunci | Tabel Supabase | Catatan |
|---|---|---|---|
| `Category` | slug (PK), name, nameEn, desc | `categories` | Bilingual nama |
| `Product` | slug (PK), code, name/nameEn, category, kind, aliases[], priceMode `fixed\|quote`, price, unit, moq, stock, stockStatus, image, rating, reviewCount, summary/summaryEn, highlights[], specs[][], applications[], solubility[][] | `products` | Spesifikasi sebagai JSONB. `quote` = harga penawaran |
| `Review` | id, product, customer, rating, date, body | `reviews` | Tanpa relasi ke akun customer |
| `CartItem` | slug, name, code, price, unit, image, qty | tidak ada | Hanya localStorage |
| `Order` | number (PK), date, customer{id,name,email,pic}, items[], subtotal, shipping, adminFee, total, status, payment, bank, bankInfo, shippingMethod, address, trackingNo, note, rejectReason, proof{...}, reviewed, dueAt, timeline[] | `orders` | Customer dan item didenormalisasi ke JSONB |
| `OrderStatusKey` | awaiting_payment → awaiting_verification → processing → packing → shipped → delivered → completed; cancelled | kolom `status` | Urutan di `trackingSteps` |
| `PaymentStatusKey` | unpaid, awaiting_confirmation, paid, rejected, expired | kolom `payment` | Tidak ada `failed` |
| `CustomerProfile` | customerId, name, email, phone, company, position, companyEmail, companyPhone, taxId, addresses[] | `customer_profiles` | Alamat sebagai JSONB |
| `Customer` (admin view) | id, name, email, pic, phone, company, orders, status, joined | `customers` | **Duplikasi** dengan `customer_profiles` |
| `AdminUser` | id, name, email, role `super_admin\|admin`, active, permissions[] | `admin_users` | Tanpa password |
| `CommerceConfig` | bankAccounts[], shippingMethods[], additionalFees[], paymentDueHours | `commerce_config` (key `main`) | Satu baris JSONB |
| `NewsItem` | slug, title, date, tag, published, thumb, excerpt | `news` | Skema punya `title_en/excerpt_en/body_en`, tetapi `fetchNews` memetakan `titleEn = title` |
| `GalleryItem` | id, title, type `image\|video`, src, published | `gallery` | Tidak bilingual |
| `Certificate` | id, name, material, desc, file, published | `certificates` | Tidak bilingual |
| `Brochure` | id, title, file, size, published | `brochures` | Tidak bilingual |
| `WbsReport` | id, code, subject, date, status `new\|review\|closed`, anonymous | `wbs_reports` | Tanpa isi laporan/lampiran |
| `MenuItem`, `CustomerLogo`, `DashboardStat`, `SalesPoint` | – | tidak ada | Hanya di FE |

### 3.5 Mekanisme i18n

- Kamus `lib/i18n.ts`: objek `UIStrings` untuk `id` dan `en` (chrome situs: navbar, hero, footer, dashboard, akun) plus `navTree` (mega-menu). Default bahasa `defaultLang`.
- `LanguageProvider` (React Context) menyimpan `lang` di `localStorage('lang')` dan atribut `<html lang>`; dibaca lewat `useLang()`.
- Tidak ada routing locale (`/en/...`). Konten entitas bilingual lewat field paralel (`nameEn`, `summaryEn`). Konten CMS lain (sertifikat, brosur, galeri, blok halaman) hanya satu bahasa.

### 3.6 Fetching dan state

- Halaman publik: async Server Component memanggil `server-data.ts`.
- Halaman client: `useEffect` + `api()`; error dinormalisasi `ApiError` dan ditampilkan lewat `errorMessage()` (god node 114 edge).
- State global lewat Context: `AuthProvider` (`useAuth`: customer, admin, login/register/logout), `CartProvider` (`useCart`, localStorage), `TransactionProvider` (`useTransactions`: orders, checkout, getOrder, uploadProof, submitReview, cancelOrder, confirmReceived), `LanguageProvider`.
- Tabel admin generik `DataTable` dengan pagination client-side; katalog publik `CatalogBrowser` dengan filter, search, sort, pagination client-side dari props.

---

## 4. Halaman FE → data yang dibutuhkan → endpoint API yang diperlukan

Kolom "Endpoint" adalah kontrak yang sudah dipanggil UI sekarang (lewat mock). Backend apa pun yang dipilih harus menyediakan kontrak setara. Tanda ⚠ = dipanggil UI tetapi tidak terlihat di dispatcher mock (perlu verifikasi saat implementasi).

### 4.1 Situs publik

| Halaman | Data yang dibutuhkan | Endpoint / sumber |
|---|---|---|
| `/` | company, stats, capabilities, produk unggulan, video | statis `lib/site.ts` + `fetchGallery` |
| `/tentang` | company, akhlak, misi, timeline | statis `lib/site.ts` (seharusnya `GET /content/blocks/history`, `/vision-mission`) |
| `/produk`, `/catalog`, `/catalog/kategori/[slug]` | Product[], Category[] (filter q, category) | `GET /catalog/products?q&category`, `GET /catalog/categories` |
| `/catalog/[slug]` | Product, Review[], produk terkait, label stok | `GET /catalog/products/{slug}` (produk + ulasan) |
| `/berita`, `/berita/[slug]` | NewsListItem[], NewsDetail (body bilingual) | `GET /content/news`, `GET /content/news/{slug}` |
| `/galeri` | GalleryItem[] | `GET /content/gallery` |
| `/unduhan` | Brochure[] | `GET /content/brochures` |
| `/keberlanjutan/sertifikat` | Certificate[] | `GET /content/certificates` |
| `/keberlanjutan/pelanggan` | CustomerLogo[] | `GET /content/customer-logos` (mock ada, FE belum memakai) |
| `/keberlanjutan`, `/keberlanjutan/reach` | statis | – |
| `/keberlanjutan/whistleblowing` | – | `POST /wbs` ⚠ (mock menangani `/wbs/reports`) |
| `/kontak` | locations, contact | statis; submit form **tidak mengirim apa pun** |
| `/cart` | CartItem[] | localStorage |
| `/checkout` | CommerceConfig (bank, ongkir, biaya, batas waktu), CustomerProfile (alamat) | `GET /commerce/config`, `GET /customer/profile`, `POST /customer/orders` |

### 4.2 Auth dan dashboard customer

| Halaman | Data yang dibutuhkan | Endpoint |
|---|---|---|
| `/login` | sesi customer/admin | `POST /auth/login`, `POST /auth/admin/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/logout` |
| `/dashboard` | Order[] milik customer, statistik | `GET /customer/orders` |
| `/dashboard/katalog` | Product[], Category[] | sama dengan `/catalog` |
| `/dashboard/pesanan` | Order[] + filter status | `GET /customer/orders` |
| `/dashboard/pesanan/[number]` | Order (timeline, proof, invoice) | `GET /customer/orders/{n}`, `POST .../proof` (multipart), `POST .../reviews`, `POST .../cancel`, `POST .../confirm-received` |
| `/dashboard/profil` | CustomerProfile | `GET/PUT /customer/profile`, `PUT /customer/profile/password` ⚠ |
| `/dashboard/perusahaan` | CustomerProfile (company, taxId) | `PUT /customer/profile/company` |
| `/dashboard/alamat` | CustomerAddress[] | `POST /customer/addresses`, `PUT /customer/addresses/{id}`, `PUT .../{id}/primary`, `DELETE .../{id}` |

### 4.3 Admin

| Halaman | Data yang dibutuhkan | Endpoint |
|---|---|---|
| Semua halaman admin | permission modul | `GET /admin/permissions/self` |
| `/admin` | statistik, Order[] terbaru, SalesPoint[] | `GET /admin/dashboard` |
| `/admin/orders`, `/admin/orders/[number]` | Order[] (filter status), Order detail | `GET /admin/orders?status`, `GET /admin/orders/{n}`, `POST .../status`, `POST .../cancel`, `PUT .../due` ⚠ |
| `/admin/payments` | Order[] dengan bukti bayar | `GET /admin/payments`, `POST /admin/payments/{n}/accept`, `POST .../reject` (alasan) |
| `/admin/products` | Product[], Category[] | `GET/POST /admin/products`, `PUT /admin/products/{slug}`, `PUT .../publish`, `DELETE` |
| `/admin/product-categories` | Category[] | `GET/POST /admin/categories`, `PUT/DELETE /admin/categories/{slug}` |
| `/admin/customers` | Customer[], detail + Order[] | `GET /admin/customers`, `GET /admin/customers/{id}` ⚠, `PUT .../{id}/status` ⚠ |
| `/admin/bank-accounts` | BankAccount[] | `GET/POST /admin/bank-accounts`, `PUT/DELETE .../{id}` |
| `/admin/additional-fees` | AdditionalFee[], ShippingMethod[], paymentDueHours | `GET/POST/PUT/DELETE /admin/fees`, `.../shipping-methods`, `GET/PUT /admin/settings` |
| `/admin/reports/sales` | SalesReport (agregasi per bulan/tahun) | `GET /admin/reports/sales?year&month` |
| `/admin/navigation` | DocLink[] | `GET/POST/PUT/DELETE /admin/navigation/doc-links`, `POST /admin/media` |
| `/admin/content/media`, `/admin/gallery` | GalleryItem[] | `GET/POST /admin/gallery`, `PUT/DELETE .../{id}`, `POST /admin/media` (upload) |
| `/admin/news` | NewsItem[] | `GET/POST /admin/news`, `PUT/DELETE .../{slug}` |
| `/admin/certificates` | Certificate[] | `GET/POST /admin/certificates`, `PUT/DELETE .../{id}` |
| `/admin/brochures` | Brochure[] | `GET/POST /admin/brochures`, `PUT/DELETE .../{id}`, `POST /admin/media` |
| `/admin/history`, `/admin/vision-mission`, `/admin/contact` | blok konten | `GET/PUT /admin/blocks/{key}` |
| `/admin/whistleblowing` | konfigurasi file WBS | `GET /admin/wbs/config` ⚠, `POST /admin/wbs/upload` ⚠ (daftar laporan `GET /admin/whistleblowing` ada di mock, belum dipakai UI) |
| `/admin/users` | AdminUser[], HelpGuideConfig | `GET/POST /admin/users`, `PUT /admin/users/{id}`, `GET/POST /admin/help-guide` ⚠ |

Total permukaan API yang dipakai UI: sekitar 70 kombinasi method + path.

---

## 5. Gap

### 5.1 Ada di requirement (`doc/`), belum ada di mockup

1. **Payment gateway** (PNG): metode QRIS/VA/E-Wallet dan status Failed tidak ada. Mockup hanya transfer manual.
2. **Invoice resmi** (xlsx "Payment > Invoice"): hanya section HTML di detail pesanan. Tidak ada nomor invoice terpisah, PPN, atau ekspor PDF.
3. **Notifikasi admin saat order masuk** (PDF): tidak ada mekanisme notifikasi apa pun (email, WhatsApp, in-app).
4. **Batas waktu pembayaran otomatis**: `dueAt` dan `paymentDueHours` ada, tetapi tidak ada proses yang mengubah status ke `expired` atau membatalkan order.
5. **Manajemen Menu** (xlsx): admin hanya mengelola "doc links"; struktur menu `navTree` masih hardcoded di `lib/i18n.ts`.
6. **Hasil edit admin tidak tampil di publik**: History, Visi-Misi, Kontak, dan Logo Pelanggan dibaca dari `lib/site.ts` statis, bukan dari `/content/blocks/*`.
7. **Form kontak** tidak mengirim data (hanya `setSent(true)`).
8. **Manajemen WBS**: admin mengelola konfigurasi/upload file, belum ada daftar dan tindak lanjut laporan masuk; isi laporan dan lampiran tidak ada di skema.
9. **RBAC nyata**: `permissions[]` ada di data, sidebar difilter, tetapi tidak ada penegakan di sisi server.
10. **Bilingual konten CMS**: sertifikat, brosur, galeri, blok halaman satu bahasa; berita punya kolom EN di skema tetapi tidak dipakai.

### 5.2 Ada di mockup, tidak disebut di requirement (perlu konfirmasi apakah dipertahankan)

1. Dark mode (`ThemeToggle`).
2. Profil perusahaan customer (NPWP, email/telepon perusahaan) dan multi-alamat dengan alamat utama.
3. Produk `priceMode: quote` (harga penawaran) dan MOQ.
4. Customer membatalkan pesanan sendiri; konfirmasi barang diterima oleh customer.
5. Admin menonaktifkan customer (`status active/inactive`).
6. Upload "help guide" admin dan konfigurasi file WBS.
7. Laporan penjualan per tahun/bulan dengan grafik.
8. Sisa arsitektur lama: route `/akun/*`, `/register`, `/admin/login` (redirect), `/sso/verify` (stub), `/sanctum/csrf-cookie`, rewrite `USE_BACKEND`.

### 5.3 Gap teknis internal mockup (harus diselesaikan apa pun backendnya)

1. `api()` selalu mock; endpoint bertanda ⚠ di bagian 4 kemungkinan gagal (404) bahkan di mock.
2. RLS terbuka penuh dengan anon key di klien: tidak boleh dipakai di produksi.
3. Tidak ada tabel akun/kredensial di skema; auth mock.
4. Duplikasi `customers` vs `customer_profiles`; `orders.customer` dan `items` didenormalisasi ke JSONB, menyulitkan laporan dan integritas stok.
5. Tidak ada penyimpanan file untuk bukti transfer, brosur, sertifikat, media.
6. Data transaksi per browser (localStorage), tidak bisa dipakai untuk demo multi-pengguna.
7. `.env` berisi kredensial Supabase nyata (hanya nama variabel yang saya baca, nilainya tidak). Pastikan tidak ikut ter-commit.

---

## 6. Pertanyaan terbuka yang memblokir desain (maks. 10)

1. **Platform backend.** Lanjut Supabase-only (RLS ketat + Edge Functions/RPC), hidupkan kembali backend Laravel (jejak `USE_BACKEND`, Sanctum), atau Next.js Route Handlers dengan DB? Sekalian: target hosting (Vercel, VPS klien, on-prem PTPN)?
2. **Model pembayaran.** Transfer manual + verifikasi admin (PDF) atau payment gateway (PNG: QRIS/VA/E-Wallet)? Jika gateway: provider mana (Midtrans, Xendit, lainnya) dan apakah transfer manual tetap dipertahankan sebagai opsi?
3. **Autentikasi.** Supabase Auth, custom JWT/session, atau SSO? Apa maksud route `/sso/verify`, apakah ada rencana integrasi SSO PTPN? Apakah registrasi customer perlu persetujuan admin?
4. **Peran dan izin.** Daftar modul yang bisa diberikan ke role `admin`, siapa yang boleh membuat super admin, dan apakah satu perusahaan customer boleh punya lebih dari satu user?
5. **Invoice dan pajak.** Perlu dokumen invoice resmi (nomor seri, PPN, faktur pajak, PDF unduhan)? Apakah harga produk sudah termasuk PPN? Bagaimana alur produk `quote` (permintaan penawaran, negosiasi, konversi ke order)?
6. **Notifikasi.** Kanal mana (email, WhatsApp, in-app), event mana (order baru ke admin, perubahan status ke customer, pengingat batas waktu), dan provider/akun pengirim milik siapa?
7. **Batas waktu dan stok.** Siapa yang mengubah order ke `expired` (cron/job) dan apa akibatnya (auto-cancel, stok dikembalikan)? Stok dipotong saat order dibuat atau saat pembayaran diterima? MOQ ditegakkan di server?
8. **Penyimpanan file.** Bukti transfer (privat), brosur/sertifikat/media (publik), lampiran WBS: Supabase Storage, S3, atau server klien? Batas ukuran dan tipe file?
9. **Konten CMS dan bahasa.** Konten mana yang wajib bilingual dan dapat diedit admin (history, visi-misi, kontak, REACH, logo pelanggan, struktur menu)? Apakah semua konten statis `lib/site.ts` dipindah ke CMS?
10. **Data awal dan migrasi.** Produk, berita, galeri, dan dokumen dari website lama perlu dimigrasi? Siapa yang menyediakan konten final dan aset (PDF brosur, sertifikat), dan kapan?

---

## Lampiran A – `Ruang lingkup.xlsx` (hasil konversi, kolom kosong dihilangkan)

**Sheet Viewers** (Status semua "Open", Referensi "Sesuai Mock up")

| No | Parent | Child | Notes |
|---|---|---|---|
| 2 | Home | | |
| 3 | About Us | | |
| 4 | | History | |
| 5 | | Vision and Mission | |
| 6 | | Contact Us | |
| 7 | Business | | |
| 8 | | Resiprene Products | |
| 9 | | Rubber Articles Products | |
| 10 | Media | | |
| 11 | | Galery | |
| 12 | | News | |
| 13 | Sustainability | | |
| 14 | | Certificate | |
| 15 | | Our Customers | |
| 16 | | Brochure Resiprene 35 | |
| 17 | | Brochure Rubber Articles | |
| 18 | | Whistle Blowing System | |
| 19 | | Reach Compliance | |
| 20 | Fitur Bahasa | | Indonesia - Inggris |

**Sheet E-commerce** (Status semua "Open")

| No | Parent | Child |
|---|---|---|
| 2 | Registrasi Customer | |
| 3 | Log in | |
| 4 | Profil Customer | |
| 5 | Home | |
| 6 | Company Profil | |
| 7 | Product Catalog | |
| 8 | | Detail Product |
| 9 | | Search Product |
| 10 | | Product Category |
| 11 | | Shopping Cart |
| 12 | | Check out |
| 13 | Payment | |
| 14 | | Invoice |
| 15 | History Order | |
| 16 | Tracking Order | |
| 17 | Review Product | |

**Sheet Catalog** (Status "Open")

| No | Parent | Child |
|---|---|---|
| 2 | Informasi Product | |
| 3 | | Gambar produk |
| 4 | | Nama produk |
| 5 | | Kategori |
| 6 | | Harga |
| 7 | | Status stok |
| 8 | Informasi Pendukung | |
| 9 | | Jumlah ulasan |
| 10 | | Spesifikasi produk |
| 11 | Tombol Aksi | |
| 12 | | Lihat detail |
| 13 | | Tambah ke keranjang |
| 14 | Filter atau search produk | |
| 15 | | Kategori produk |
| 16 | | Nama produk |
| 17 | Informasi Tambahan | |
| 18 | | Pagination |

**Sheet Admin** (Status semua "Open")

| No | Parent | Child | Notes |
|---|---|---|---|
| 2 | Log in | | |
| 3 | Dashboard | | |
| 4 | Manajemen Category Product | | |
| 5 | Manajemen Product | | |
| 6 | Manajemen Customer | | |
| 7 | Manajemen Order | | Bisa atur batas waktu pembayaran |
| 8 | Manajemen Akun Bank | | |
| 9 | Manajemen Tambahan Biaya | | Seperti ongkos kirim, biaya admin dll |
| 10 | Manajemen Payment | | |
| 11 | Laporan Penjualan | | |
| 12 | Manajemen Menu | | |
| 13 | | Konten ( Video dan Gambar) | |
| 14 | | News | |
| 15 | | Certificate | |
| 16 | | History | |
| 17 | | Vision and Mission | |
| 18 | | Contact Us | |
| 19 | | Gallery | |
| 20 | | Brochure | |
| 21 | Manajemen Whistle Blowing System | | |
| 22 | Manajemen User | | Terdapat Super Admin dan Admin |
