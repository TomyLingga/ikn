# 02 – Kontrak API `ikn-be` (v1)

- Tanggal: 2026-09-21
- Base URL: `https://api.<domain>/api/v1` (dev: `http://localhost:8080/api/v1`)
- Sumber kontrak: path yang sudah dipanggil `api()` di `ikn-fe` (`plan/00-discovery.md` bagian 4). Setiap selisih dicatat di bagian 12.
- Spesifikasi mesin: `ikn-be/docs/openapi.yaml` (ditulis di tiap phase; dokumen ini adalah ringkasan yang dibaca manusia).

---

## 1. Konvensi umum

| Aspek | Aturan |
|---|---|
| Autentikasi | Sanctum cookie SPA. `GET /sanctum/csrf-cookie` (di luar `/api/v1`) sebelum request mutasi; kirim `X-XSRF-TOKEN`, `credentials: include`. |
| Peran | `customer`, `admin`, `super_admin`. Kolom "Akses" di tabel endpoint: `public`, `customer`, `customer.active` (sudah disetujui), `admin[<modul>]`, `super_admin`. |
| Header | `Accept: application/json`, `Accept-Language: id\|en` (default `id`), `Content-Type: application/json` atau `multipart/form-data` untuk upload. |
| Envelope sukses | `{ "data": ... }`; daftar berpaginasi menambah `"meta": { page, perPage, total, lastPage }` dan `"links"`. |
| Envelope error | `{ "message": "...", "code": "SNAKE_CASE", "errors": { "field": ["pesan"] } }`. `errors` hanya untuk 422. |
| Paginasi | `?page=1&perPage=20` (maks 100). Filter `?q=` (ILIKE), `?status=`, `?sort=field&dir=asc\|desc`. |
| Kunci JSON | camelCase (mengikuti tipe di `ikn-fe/lib/types.ts`). |
| Uang | integer rupiah (`185000`), bukan float, bukan string. |
| Waktu | ISO-8601 dengan offset, misalnya `2026-09-21T09:24:00+07:00`. |
| Translatable | objek `{ "id": "...", "en": "..." }`. |
| ID | integer untuk entitas admin; `slug` untuk produk/kategori/berita di endpoint publik; `number` untuk order. |
| Idempotensi | `POST /customer/orders` menerima header `Idempotency-Key` (UUID, opsional): kunci sama dalam 24 jam mengembalikan order yang sama. |
| Versi | prefix `/api/v1`; perubahan yang memutus kontrak masuk `/api/v2`. |

---

## 2. Kode error

| HTTP | `code` | Kapan |
|---|---|---|
| 400 | `BAD_REQUEST` | payload tidak bisa diparse |
| 401 | `UNAUTHENTICATED` | tidak ada sesi |
| 403 | `FORBIDDEN` | role/modul/policy menolak |
| 403 | `ACCOUNT_NOT_APPROVED` | customer `pending`/`rejected`/`inactive` mencoba checkout |
| 403 | `EMAIL_NOT_VERIFIED` | login sebelum verifikasi email |
| 404 | `NOT_FOUND` | resource tidak ada / bukan milik user |
| 409 | `INVALID_TRANSITION` | transisi state order/payment tidak sah |
| 409 | `INSUFFICIENT_STOCK` | stok tidak cukup saat checkout (`meta.items[]`) |
| 409 | `PAYMENT_ALREADY_ACTIVE` | masih ada payment `pending`/`awaiting_verification` |
| 409 | `ORDER_EXPIRED` | upload bukti setelah `paymentDueAt` |
| 409 | `VOUCHER_INVALID` | voucher habis/kedaluwarsa/tidak memenuhi syarat (`meta.reason`) |
| 413 | `FILE_TOO_LARGE` | upload melebihi batas |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | mime tidak diizinkan |
| 419 | `CSRF_TOKEN_MISMATCH` | token XSRF tidak valid |
| 422 | `VALIDATION_ERROR` | Form Request gagal; `errors` diisi |
| 429 | `TOO_MANY_REQUESTS` | rate limit; header `Retry-After` |
| 500 | `SERVER_ERROR` | tidak terduga; `message` generik di produksi |
| 503 | `MAINTENANCE` | `php artisan down` |

---

## 3. Auth

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | public | set cookie `XSRF-TOKEN` (di luar prefix v1) |
| POST | `/auth/register` | public | daftar customer → status `pending`, kirim email verifikasi (queue) |
| POST | `/auth/login` | public | login customer; `EMAIL_NOT_VERIFIED` bila belum verifikasi |
| POST | `/auth/admin/login` | public | login admin/super_admin; rate limit 5/menit |
| POST | `/auth/logout` | auth | hapus sesi; body `{scope}` diterima dan diabaikan |
| GET | `/auth/me` | auth | user + profil + `accountStatus` + `permissions` (admin) |
| GET | `/auth/verify-email/{id}/{hash}` | signed URL | set `emailVerifiedAt`; redirect ke `FRONTEND_URL/login?verified=1` |
| POST | `/auth/verification/resend` | public (email) | kirim ulang; rate limit 3/jam |
| POST | `/auth/password/forgot` | public | kirim link reset |
| POST | `/auth/password/reset` | public (token) | set password baru |

Contoh `POST /auth/register`
```json
{ "name": "Budi Santoso", "email": "buyer@coatingsolutions.co.id", "password": "Rahasia123", "passwordConfirmation": "Rahasia123",
  "phone": "081234567890", "company": "Coating Solutions Co.", "position": "Procurement Manager", "taxId": "01.234.567.8-901.000" }
```
`201`
```json
{ "data": { "id": 12, "email": "buyer@coatingsolutions.co.id", "status": "pending", "emailVerifiedAt": null },
  "message": "Cek email Anda untuk verifikasi." }
```

Contoh `POST /auth/login` → `200`
```json
{ "data": { "user": { "id": 12, "name": "Budi Santoso", "email": "buyer@coatingsolutions.co.id", "role": "customer",
  "status": "active", "profile": { "company": "Coating Solutions Co.", "taxId": "01.234.567.8-901.000" } } } }
```
Gagal → `422 VALIDATION_ERROR` `{ "errors": { "email": ["Email atau password salah."] } }` (pesan mengikuti `Accept-Language`).

`GET /auth/me` untuk admin menambah `"permissions": ["orders","payments",...]` (`["*"]` untuk super_admin).

---

## 4. Akun customer

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/customer/profile` | customer | profil + `addresses[]` (kompatibel FE) |
| PUT | `/customer/profile` | customer | name, phone, position |
| PUT | `/customer/profile/company` | customer | company, companyEmail, companyPhone, taxId |
| PUT | `/customer/profile/password` | customer | `currentPassword`, `password`, `passwordConfirmation` ⚠ (baru di kontrak) |
| GET | `/customer/addresses` | customer | daftar alamat |
| POST | `/customer/addresses` | customer | buat alamat (lihat skema di bawah) |
| PUT | `/customer/addresses/{id}` | customer | ubah |
| PUT | `/customer/addresses/{id}/primary` | customer | jadikan default |
| DELETE | `/customer/addresses/{id}` | customer | hapus (ditolak bila satu-satunya dan pernah dipakai order aktif) |

Skema alamat (request dan response):
```json
{ "id": 3, "label": "Gudang Utama Jakarta", "recipientName": "Budi Santoso / Gudang", "phone": "081234567890",
  "addressLine": "Jl. Industri Raya No. 45, Kawasan Industri Pulogadung",
  "provinceCode": "31", "regencyCode": "31.75", "districtCode": "31.75.03", "villageCode": "31.75.03.1003",
  "region": { "province": "DKI Jakarta", "regency": "Jakarta Timur", "district": "Cakung", "village": "Jatinegara" },
  "postalCode": "13920", "lat": -6.1834, "lng": 106.9118, "note": "Masuk dari gerbang 2", "isDefault": true }
```

---

## 5. Wilayah dan geo

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/regions?level=province` | public | daftar provinsi |
| GET | `/regions?parent=31` | public | anak dari kode (kabupaten/kecamatan/kelurahan) |
| GET | `/regions/search?q=cakung` | public | ILIKE lintas level, maks 20 |
| GET | `/geo/search?q=...` | auth | proxy Nominatim `search`; cache 7 hari; 1 req/detik ke upstream |
| GET | `/geo/reverse?lat=&lng=` | auth | proxy Nominatim `reverse`; cache 30 hari |

Respons geo dinormalisasi: `{ "data": [ { "displayName": "...", "lat": -6.18, "lng": 106.91, "address": { "road": "...", "village": "...", "postcode": "..." } } ] }`.

---

## 6. Katalog publik

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/catalog/categories` | public | kategori aktif |
| GET | `/catalog/products?q&category&sort&page&perPage` | public | hanya `isPublished`; `sort=name\|price\|newest` |
| GET | `/catalog/products/{slug}` | public | produk + `reviews[]` + `related[]` |
| GET | `/catalog/products/{slug}/reviews?page` | public | ulasan tayang |

Bentuk produk (superset tipe `Product` FE):
```json
{ "slug": "resiprene-35", "code": "RSP-35", "name": { "id": "Resiprene 35", "en": "Resiprene 35" },
  "category": { "slug": "resiprene", "name": { "id": "Resiprene", "en": "Resiprene" } }, "kind": "Cyclised Natural Rubber",
  "priceMode": "fixed", "price": 185000, "promoPrice": null, "unit": "kg", "moq": 25, "weightGram": 1000,
  "stock": 1200, "available": 1175, "stockStatus": "in_stock", "isTaxable": true,
  "images": [ { "id": 7, "url": "https://api.<domain>/storage/products/rsp-35.jpg", "sort": 0 } ],
  "summary": { "id": "...", "en": "..." }, "highlights": { "id": ["..."], "en": ["..."] },
  "specs": [["Softening Point","125–145 °C"]], "applications": { "id": ["..."], "en": ["..."] },
  "solubility": [["White spirit","Sempurna"]], "ratingAvg": 4.5, "reviewCount": 2 }
```

---

## 7. Konten publik (CMS)

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/content/pages/{slug}` | public | halaman + `sections[]` yang `isVisible`, hanya `published` |
| GET | `/content/menus/{location}` | public | pohon menu `header`/`footer` |
| GET | `/content/settings` | public | setting `isPublic` (kontak perusahaan, sosial, dll) |
| GET | `/content/news?page&tag` | public | berita tayang |
| GET | `/content/news/{slug}` | public | detail + body |
| GET | `/content/gallery` | public | |
| GET | `/content/certificates` | public | |
| GET | `/content/brochures` | public | |
| GET | `/content/customer-logos` | public | |
| GET | `/content/banners` | public | |
| GET | `/content/faqs` | public | |
| GET | `/content/doc-links?category` | public | tautan dokumen (WBS, REACH) |
| GET | `/content/blocks/{key}` | public | **alias kompatibilitas** ke section `history`/`vision-mission`/`contact` |

Contoh `GET /content/pages/tentang`
```json
{ "data": { "slug": "tentang", "title": { "id": "Tentang Kami", "en": "About Us" }, "seo": { "title": {..}, "description": {..} },
  "sections": [
    { "id": 4, "type": "timeline", "sort": 0, "content": { "items": [ { "year": "1990", "title": { "id": "...", "en": "..." } } ] } },
    { "id": 5, "type": "vision_mission", "sort": 1, "content": { "vision": {..}, "missions": {..} } } ] } }
```

---

## 8. WBS dan kontak

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/wbs` | public | multipart: subject, body, reporterName?, reporterContact?, isAnonymous, attachment? (pdf/jpg/png ≤ 10 MB); rate limit 5/jam; respons `{ "code": "WBS-202609-0012" }` |
| GET | `/wbs/{code}` | public | status laporan by kode (tanpa isi) |
| POST | `/contact` | public | name, email, phone?, subject, message, `type: contact\|quote`, `productSlug?`; email ke admin |

---

## 9. Keranjang, checkout, order (customer)

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/commerce/config` | public | metode bayar aktif, rekening bank aktif, fee aktif, `paymentDueHours`, pajak, `uniqueCodeEnabled` (kompatibel FE) |
| POST | `/cart/quote` | customer | validasi item dan hitung total tanpa membuat order |
| GET | `/customer/orders?status&page` | customer | daftar order milik sendiri |
| POST | `/customer/orders` | customer.active | checkout (reserve stok); `Idempotency-Key` opsional |
| GET | `/customer/orders/{number}` | customer | detail + `items`, `payments`, `timeline`, `invoiceNumber` |
| POST | `/customer/orders/{number}/proof` | customer | multipart `file` (jpg/png/pdf ≤ 5 MB), `paymentId?`; membuat payment baru jika yang aktif `rejected` |
| POST | `/customer/orders/{number}/cancel` | customer | hanya `pending_payment` |
| POST | `/customer/orders/{number}/confirm-received` | customer | `shipped → delivered` |
| POST | `/customer/orders/{number}/complete` | customer | `delivered → completed` (opsional; otomatis 7 hari) |
| POST | `/customer/orders/{number}/reviews` | customer | `[{ productSlug, rating, body }]`, hanya `completed` |
| GET | `/customer/orders/{number}/payments` | customer | histori percobaan bayar |
| GET | `/files/{mediaId}` | pemilik/admin | unduh file privat (bukti bayar) |

Contoh `POST /cart/quote` dan `POST /customer/orders` (body sama)
```json
{ "items": [ { "productSlug": "resiprene-35", "qty": 100 } ],
  "addressId": 3, "shippingRateId": 2, "paymentMethodCode": "manual_transfer", "bankAccountId": 1,
  "voucherCode": "IKN10", "note": "Kirim jam kerja" }
```
`POST /cart/quote` → `200`
```json
{ "data": { "items": [ { "productSlug": "resiprene-35", "name": {..}, "qty": 100, "unitPrice": 185000, "lineTotal": 18500000, "available": 1175 } ],
  "subtotal": 18500000, "discountTotal": 1850000, "voucher": { "code": "IKN10", "type": "percent", "value": 10 },
  "shipping": { "rateId": 2, "label": {..}, "amount": 150000, "weightGram": 100000, "eta": {..} },
  "feeTotal": 5000, "taxRate": 11, "priceIncludesTax": true, "taxTotal": 1650000, "uniqueCode": 0, "grandTotal": 16805000,
  "warnings": [] } }
```
`POST /customer/orders` → `201`
```json
{ "data": { "number": "IKN-20260921-00043", "status": "pending_payment", "paymentStatus": "pending",
  "paymentDueAt": "2026-09-22T09:24:00+07:00", "grandTotal": 16805217, "uniqueCode": 217,
  "payment": { "id": 51, "method": "manual_transfer", "status": "pending", "amount": 16805217,
    "instructions": { "id": "Transfer ke ...", "en": "Transfer to ..." },
    "bankAccount": { "bankName": "Bank BCA", "accountNumber": "0123456789", "accountHolder": "PT Industri Karet Nusantara" } },
  "items": [ ... ], "shippingAddress": { ... }, "timeline": [ { "status": "pending_payment", "at": "2026-09-21T09:24:00+07:00" } ] } }
```
Stok kurang → `409 INSUFFICIENT_STOCK`
```json
{ "message": "Stok tidak mencukupi.", "code": "INSUFFICIENT_STOCK", "meta": { "items": [ { "productSlug": "sepatu-boots", "requested": 400, "available": 350 } ] } }
```

Contoh `POST /customer/orders/{number}/proof` (multipart) → `200`
```json
{ "data": { "order": { "number": "IKN-20260921-00043", "status": "payment_review", "paymentStatus": "awaiting_verification" },
  "payment": { "id": 51, "status": "awaiting_verification", "proof": { "mediaId": 88, "originalName": "bukti.jpg", "mime": "image/jpeg", "size": 245000, "uploadedAt": "..." } } } }
```
Ditolak sebelumnya lalu upload ulang → membuat `payment` baru (`id` baru), yang lama tetap `rejected` dengan `rejectReason`.

Bentuk `Order` (superset tipe FE):
```json
{ "number": "IKN-20260921-00043", "invoiceNumber": null, "date": "2026-09-21T09:24:00+07:00",
  "status": "pending_payment", "paymentStatus": "pending",
  "customer": { "id": 12, "name": "Coating Solutions Co.", "email": "buyer@...", "pic": "Budi Santoso", "taxId": "..." },
  "items": [ { "productSlug": "resiprene-35", "name": {..}, "code": "RSP-35", "qty": 100, "unit": "kg", "unitPrice": 185000, "discountAmount": 18500, "lineTotal": 18500000 } ],
  "subtotal": 18500000, "discountTotal": 1850000, "shippingTotal": 150000, "feeTotal": 5000, "taxTotal": 1650000, "uniqueCode": 217, "grandTotal": 16805217,
  "shippingMethod": { "label": {..}, "eta": {..} }, "shippingAddress": { "label": "...", "recipientName": "...", "phone": "...", "addressLine": "...", "region": {..}, "postalCode": "..." },
  "courier": null, "trackingNumber": null, "note": "...", "paymentDueAt": "...", "paidAt": null,
  "payments": [ ... ], "timeline": [ { "status": "pending_payment", "at": "...", "note": null } ], "canCancel": true, "canUploadProof": true, "canReview": false }
```

---

## 10. Pembayaran

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/payment-methods` | public | metode aktif + instruksi + (untuk `qris_static`) URL gambar QRIS |
| POST | `/customer/orders/{number}/payments` | customer | buat percobaan bayar baru dengan metode lain (misalnya ganti ke QRIS); menolak `PAYMENT_ALREADY_ACTIVE` |
| POST | `/payments/webhook/{provider}` | public (signature) | idempoten; log ke `payment_webhook_logs`; respons selalu `200 {received:true}` kecuali signature invalid `401` |

Contoh webhook (Xendit, kerangka) `POST /payments/webhook/xendit` header `x-callback-token: ...`
```json
{ "id": "qr_123", "external_id": "IKN-20260921-00043-51", "status": "SUCCEEDED", "amount": 16805217, "paid_at": "2026-09-21T03:00:00Z" }
```
→ `200 { "data": { "received": true, "result": "processed" } }`; kedua kalinya `"result": "duplicate"`.

---

## 11. Admin

Semua `admin[...]` di bawah `auth:sanctum` + role admin + modul. Semua aksi tulis dicatat ke `audit_logs`.

### 11.1 Umum
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/permissions/self` | admin | `{ "modules": [...] }` |
| GET | `/admin/dashboard?year` | admin[dashboard] | stats, order terbaru, `salesChart[]` (kompatibel `DashboardData` FE) |
| GET | `/admin/reports/sales?year&month&from&to` | admin[reports] | agregasi + daftar order; `?format=csv` unduh |
| GET | `/admin/audit-logs?page&user&action` | super_admin | |

### 11.2 Order dan pembayaran
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/orders?status&q&page` | admin[orders] | |
| GET | `/admin/orders/{number}` | admin[orders] | |
| POST | `/admin/orders/{number}/status` | admin[orders] | `{ "status": "processing\|shipped\|delivered\|completed", "note"?, "courier"?, "trackingNumber"? }` (untuk `shipped` wajib kurir + resi) |
| POST | `/admin/orders/{number}/cancel` | admin[orders] | `{ "reason" }` |
| PUT | `/admin/orders/{number}/due` | admin[orders] | `{ "paymentDueAt" }` atau `{ "extendHours": 24 }` ⚠ (baru di kontrak) |
| GET | `/admin/payments?status&page` | admin[payments] | daftar payment (bukan order) + order ringkas; default `awaiting_verification` |
| GET | `/admin/payments/{id}` | admin[payments] | detail + URL bukti privat |
| POST | `/admin/payments/{id}/accept` | admin[payments] | → order `paid` |
| POST | `/admin/payments/{id}/reject` | admin[payments] | `{ "reason" }` → order `pending_payment` |
| POST | `/admin/orders/{number}/payments/accept` | admin[payments] | **alias kompatibilitas** untuk FE yang memakai nomor order: accept payment aktif |
| POST | `/admin/orders/{number}/payments/reject` | admin[payments] | alias, `{ "reason" }` |

Contoh `POST /admin/payments/51/accept` → `200`
```json
{ "data": { "payment": { "id": 51, "status": "paid", "verifiedBy": { "id": 2, "name": "Admin Penjualan" }, "verifiedAt": "..." },
  "order": { "number": "IKN-20260921-00043", "status": "paid", "invoiceNumber": "INV/2026/09/00021", "paidAt": "..." } } }
```
Transisi tidak sah → `409 INVALID_TRANSITION { "meta": { "from": "paid", "to": "paid" } }`.

### 11.3 Katalog dan stok
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET/POST | `/admin/categories` | admin[categories] | |
| PUT/DELETE | `/admin/categories/{id}` | admin[categories] | hapus ditolak bila masih ada produk |
| GET/POST | `/admin/products?q&category&published&page` | admin[products] | POST menerima `images[]` (mediaId) |
| GET/PUT/DELETE | `/admin/products/{id}` | admin[products] | DELETE = soft delete |
| PUT | `/admin/products/{id}/publish` | admin[products] | `{ "isPublished": true }` |
| GET | `/admin/products/{id}/stock` | admin[stock] | ledger berpaginasi + `stock`, `reserved`, `available` |
| POST | `/admin/products/{id}/stock` | admin[stock] | `{ "type": "in\|adjust", "qty": 50, "note" }` |
| GET/PUT | `/admin/reviews`, `/admin/reviews/{id}` | admin[products] | sembunyikan/tampilkan |

### 11.4 Customer dan user
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/admin/customers?status&q&page` | admin[customers] | `status=pending` untuk antrean persetujuan |
| GET | `/admin/customers/{id}` | admin[customers] | profil + alamat + `orders[]` ringkas ⚠ (baru di kontrak) |
| PUT | `/admin/customers/{id}/status` | admin[customers] | `{ "status": "active\|rejected\|inactive", "reason"? }`; `active` dari `pending` = approve (email) ⚠ |
| GET/POST | `/admin/users` | super_admin | admin/super_admin |
| PUT | `/admin/users/{id}` | super_admin | name, role, `permissions[]`, `active`, password? |
| GET/POST | `/admin/help-guide` | admin[users] | konfigurasi panduan (file media) ⚠ (baru di kontrak) |

### 11.5 Pengaturan commerce
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET/POST | `/admin/bank-accounts`; PUT/DELETE `/admin/bank-accounts/{id}` | admin[bank_accounts] | |
| GET/POST | `/admin/payment-methods`; PUT `/admin/payment-methods/{id}` | admin[payment_methods] | `config` (unggah gambar QRIS via `mediaId`), `isActive`, `sortOrder` |
| GET/POST | `/admin/fees`; PUT/DELETE `/admin/fees/{id}` | admin[fees] | |
| GET/POST | `/admin/shipping-zones`; PUT/DELETE `/admin/shipping-zones/{id}` | admin[shipping] | `regions[] { code, level }` |
| GET/POST | `/admin/shipping-zones/{id}/rates`; PUT/DELETE `/admin/shipping-rates/{id}` | admin[shipping] | |
| GET | `/admin/shipping-methods` | admin[shipping] | **alias kompatibilitas**: daftar rate lintas zona (FE lama) |
| GET/POST | `/admin/vouchers`; PUT/DELETE `/admin/vouchers/{id}` | admin[vouchers] | |
| GET/PUT | `/admin/settings` | admin[settings] | `{ "paymentDueHours": 24, "uniqueCodeEnabled": true, "taxRate": 11, "priceIncludesTax": true, "autoCompleteDays": 7, ... }` |

### 11.6 CMS dan media
| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/admin/media` | admin[media] | multipart `file`, `collection`; respons `{ id, url, mime, size }` |
| GET/DELETE | `/admin/media`, `/admin/media/{id}` | admin[media] | hapus ditolak bila masih dirujuk |
| GET/POST | `/admin/pages`; GET/PUT `/admin/pages/{id}` | admin[cms] | |
| GET/POST | `/admin/pages/{id}/sections`; PUT/DELETE `/admin/sections/{id}`; PUT `/admin/pages/{id}/sections/reorder` | admin[cms] | `type` divalidasi terhadap registry |
| GET/PUT | `/admin/blocks/{history\|vision-mission\|contact}` | admin[cms] | **alias kompatibilitas** ke section terkait |
| GET/PUT | `/admin/menus/{location}` | admin[cms] | pohon lengkap |
| GET/POST | `/admin/news`; PUT/DELETE `/admin/news/{id}` | admin[news] | |
| GET/POST | `/admin/gallery`; PUT/DELETE `/admin/gallery/{id}` | admin[gallery] | |
| GET/POST | `/admin/certificates`; PUT/DELETE `/admin/certificates/{id}` | admin[certificates] | |
| GET/POST | `/admin/brochures`; PUT/DELETE `/admin/brochures/{id}` | admin[brochures] | |
| GET/POST | `/admin/customer-logos`; PUT/DELETE `/admin/customer-logos/{id}` | admin[cms] | |
| GET/POST | `/admin/banners`; PUT/DELETE `/admin/banners/{id}` | admin[cms] | |
| GET/POST | `/admin/faqs`; PUT/DELETE `/admin/faqs/{id}` | admin[cms] | |
| GET/POST | `/admin/navigation/doc-links`; PUT/DELETE `/admin/navigation/doc-links/{id}` | admin[cms] | |
| GET | `/admin/whistleblowing?status&page`; GET `/admin/whistleblowing/{id}`; PUT `/admin/whistleblowing/{id}` | admin[wbs] | status + catatan |
| GET | `/admin/wbs/config`; POST `/admin/wbs/upload` | admin[wbs] | dokumen SOP WBS ⚠ (baru di kontrak; disimpan sebagai doc-link kategori `wbs`) |
| GET | `/admin/contact-messages?page`; PUT `/admin/contact-messages/{id}/read` | admin[cms] | |

---

## 12. Tabel selisih terhadap path yang dipakai `api()` di `ikn-fe`

Legenda: **Sama** = method+path+bentuk kompatibel (hanya prefix `/api/v1` dan envelope `data`); **Diubah** = ada perubahan yang butuh penyesuaian FE di Phase 11; **Baru** = belum ada di mock, ditambahkan.

| FE (mock) | API v1 | Status | Alasan |
|---|---|---|---|
| semua | `/api/v1/...` + envelope `{data}` | Diubah (global) | Versi API dan paginasi/meta. `api()` baru meng-unwrap `data` di satu titik, jadi pemanggil tidak berubah. |
| semua field bilingual `name`/`nameEn` | `name: {id,en}` | Diubah (global) | Satu bentuk untuk semua konten CMS, toggle bahasa tanpa refetch, form admin butuh dua bahasa. Adapter di `api()` memetakan `{id,en}` → `name`/`nameEn` untuk tipe lama selama transisi. |
| status order `awaiting_payment`, `awaiting_verification`, `packing` | `pending_payment`, `payment_review`, (dihapus), + `paid`, `expired` | Diubah | KEPUTUSAN state machine baru. `lib/commerce.ts` `orderStatus`/`trackingSteps` diperbarui. |
| status payment `unpaid`, `awaiting_confirmation` | `pending`, `awaiting_verification`, + `failed`, `cancelled` | Diubah | KEPUTUSAN daftar status payment. |
| `GET /sanctum/csrf-cookie` (mock 204) | sama, nyata | Sama | Sanctum cookie SPA. |
| `POST /auth/login`, `/auth/admin/login`, `/auth/register`, `GET /auth/me`, `POST /auth/logout` | sama | Sama | `register` sekarang mengembalikan status `pending` dan tidak langsung login. |
| – | `GET /auth/verify-email/...`, `POST /auth/verification/resend`, `/auth/password/*` | Baru | Verifikasi email dan reset password (KEPUTUSAN alur registrasi). |
| `GET/PUT /customer/profile`, `PUT /customer/profile/company` | sama | Sama | |
| `PUT /customer/profile/password` ⚠ | sama | Baru | Dipanggil UI, tidak ada di mock. |
| `GET/POST /customer/addresses`, `PUT/DELETE .../{id}`, `PUT .../{id}/primary` | sama | Diubah (bentuk) | Field baru: kode wilayah, `postalCode`, `lat`, `lng`, `note`, `recipientName` (dulu `recipient`), `addressLine` (dulu `line`). |
| `GET /commerce/config` | sama | Sama (superset) | Menambah `paymentMethods`, pajak, `uniqueCodeEnabled`; `shippingMethods` dihapus dari sini karena ongkir per alamat (pakai `POST /cart/quote`). |
| – | `POST /cart/quote` | Baru | Ongkir/diskon/pajak dihitung server sebelum checkout. |
| `GET/POST /customer/orders` | sama | Diubah (body) | Body checkout memakai `addressId`, `shippingRateId`, `paymentMethodCode`, `voucherCode`, bukan salinan alamat/ongkir dari klien (snapshot dibuat server). |
| `GET /customer/orders/{n}`, `POST .../proof`, `.../cancel`, `.../confirm-received`, `.../reviews` | sama | Sama | `proof` membuat payment baru bila sebelumnya ditolak. |
| – | `POST /customer/orders/{n}/complete`, `GET .../payments`, `POST .../payments` | Baru | Konfirmasi selesai, histori bayar, ganti metode bayar. |
| `POST /wbs` ⚠ (mock: `/wbs/reports`) | `POST /wbs` | Baru | Mengikuti path yang dipanggil UI; mock salah path. |
| `/kontak` submit (tidak ada request) | `POST /contact` | Baru | Gap discovery 5.1.7. |
| `GET /admin/permissions/self`, `GET /admin/dashboard` | sama | Sama | |
| `GET /admin/orders`, `GET .../{n}`, `POST .../status`, `POST .../cancel` | sama | Diubah (nilai status) | Nama status baru; `shipped` wajib kurir + resi. |
| `PUT /admin/orders/{n}/due` ⚠ | sama | Baru | Dipanggil UI (perpanjang batas waktu). |
| `GET /admin/payments`, `POST /admin/payments/{number}/accept\|reject` | `GET /admin/payments` (per payment) + `POST /admin/payments/{id}/...` + alias `POST /admin/orders/{number}/payments/accept\|reject` | Diubah | Satu order bisa punya banyak payment (KEPUTUSAN). Alias by nomor order menjaga FE lama berjalan. |
| `GET/POST /admin/products`, `PUT /admin/products/{slug}`, `PUT .../publish` | by `{id}` | Diubah | Slug bisa diubah admin; id stabil. FE menyimpan `id` dari daftar. |
| `GET/POST /admin/categories`, `PUT/DELETE .../{slug}` | by `{id}` | Diubah | sama seperti produk. |
| – | `GET/POST /admin/products/{id}/stock`, `/admin/reviews` | Baru | Ledger stok (KEPUTUSAN), moderasi ulasan. |
| `GET /admin/customers` | sama | Sama (superset) | filter `status=pending`. |
| `GET /admin/customers/{id}` ⚠, `PUT .../status` ⚠ | sama | Baru | Dipanggil UI; `status` juga alur approve/reject (KEPUTUSAN). |
| `GET/POST /admin/bank-accounts`, `PUT/DELETE .../{id}` | sama | Sama | |
| `GET/POST/PUT/DELETE /admin/fees` | sama | Sama | |
| `GET/POST/PUT/DELETE /admin/shipping-methods` | `/admin/shipping-zones` + `/admin/shipping-rates`; `GET /admin/shipping-methods` alias baca | Diubah | Ongkir per zona wilayah (KEPUTUSAN). Halaman admin ongkir dirombak di Phase 11. |
| `GET/PUT /admin/settings` | sama (superset) | Sama | Tambah pajak, kode unik, auto-complete. |
| – | `/admin/payment-methods`, `/admin/vouchers` | Baru | KEPUTUSAN metode bayar dan diskon. |
| `GET /admin/reports/sales` | sama | Sama | Tambah `?format=csv`. |
| `GET/POST/PUT/DELETE /admin/navigation/doc-links` | sama | Sama | |
| `POST /admin/media` | sama | Sama | Respons `{id,url}`; entitas merujuk `mediaId`, bukan URL bebas. |
| `/admin/gallery`, `/admin/news`, `/admin/certificates`, `/admin/brochures` (+ `PUT/DELETE` by id/slug) | sama, by `{id}` | Diubah (bentuk) | Field translatable `{id,en}`, file lewat `mediaId`. `news` by id, bukan slug. |
| `GET/PUT /admin/blocks/{history\|vision-mission\|contact}` | sama (alias) | Sama | Alias ke `page_sections`; editor section penuh lewat `/admin/pages`. |
| – | `/admin/pages`, `/admin/sections`, `/admin/menus`, `/admin/banners`, `/admin/faqs`, `/admin/customer-logos`, `/content/pages/{slug}`, `/content/menus`, ... | Baru | CMS berbasis blok (KEPUTUSAN); halaman publik membaca API. |
| `GET /admin/wbs/config` ⚠, `POST /admin/wbs/upload` ⚠ | sama | Baru | Dipanggil UI. |
| `GET /admin/whistleblowing` (mock) | sama + `{id}` | Sama (superset) | Daftar dan tindak lanjut laporan. |
| `GET/POST /admin/users`, `PUT .../{id}` | sama (super_admin) | Sama | |
| `GET/POST /admin/help-guide` ⚠ | sama | Baru | Dipanggil UI. |
| `GET /content/news`, `/content/gallery`, `/content/certificates`, `/content/brochures`, `/content/customer-logos` | sama | Sama | Menggantikan `server-data.ts` → Supabase/mock. |
| `GET /catalog/products`, `/catalog/categories`, `/catalog/products/{slug}` | sama | Sama (superset) | Tambah `available`, `weightGram`, `images[]`. |
| `/sso/verify` | dihapus | Dihapus | KEPUTUSAN. |
| `/sanctum/csrf-cookie` mock, `USE_BACKEND` rewrite | route nyata; rewrite dihapus | Diubah | Lihat `01-architecture.md` bagian 2. |
