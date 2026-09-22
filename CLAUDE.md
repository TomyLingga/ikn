## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Proyek IKN

Website company profile + e-commerce PT Industri Karet Nusantara.

| Folder | Isi | Repo git |
|---|---|---|
| `ikn-fe/` | Next.js 14 App Router (TypeScript, React 18). Situs publik, dashboard customer, panel admin. | sendiri |
| `ikn-be/` | Laravel **8.83.29** API-only, PHP **8.1** (image Docker), PostgreSQL **16**. Dibuat di Phase 0. | sendiri |
| `plan/` | `00-discovery.md`, `00-answers.md` (keputusan terkunci), `01-architecture.md`, `02-api-contract.md`, `IMPLEMENTATION_PLAN.md` | – |
| `doc/`, `Images/` | dokumen klien dan aset sumber | – |

Bahasa: balas dalam Bahasa Indonesia; istilah teknis, nama variabel, pesan commit, komentar kode dalam Bahasa Inggris.

## Sumber kebenaran

1. `plan/00-answers.md` = keputusan terkunci. Jangan mengubah keputusan di sana tanpa persetujuan pemilik proyek.
2. `plan/02-api-contract.md` = kontrak API. Setiap endpoint atau field baru dicatat di sini dan di `ikn-be/docs/openapi.yaml` pada phase yang sama.
3. `plan/IMPLEMENTATION_PLAN.md` = urutan kerja. Kerjakan satu phase sampai acceptance criteria terpenuhi sebelum lanjut.
4. ASUMSI (A-n) di `plan/01-architecture.md` boleh diubah, tetapi perubahan dicatat di tabel ASUMSI beserta alasannya.

## Perintah penting (semua lewat Docker, dari folder `ikn-be/`)

Tidak pernah menjalankan `php`, `composer`, atau `artisan` dari PHP lokal Windows.

```bash
docker compose up -d                                   # dev: app, queue, scheduler, nginx:8080, db:5432, mailpit:8025, fe:3000
docker compose ps                                      # semua harus running/healthy
docker compose exec app composer install
docker compose exec app composer require vendor/pkg:^x.y --dry-run   # cek dulu, lalu pin
docker compose exec app php artisan migrate
docker compose exec app php artisan migrate:fresh --seed              # reset + seeder demo (dev saja)
docker compose exec app php artisan test                              # jalan di Postgres ikn_test
docker compose exec app php artisan test --filter=OrderCalculatorTest
docker compose exec app php artisan queue:failed
docker compose exec app php artisan stock:rebuild
docker compose exec app php artisan orders:expire
docker compose exec db psql -U ikn -d ikn
docker compose logs -f app queue scheduler
docker compose run --rm app composer create-project laravel/laravel:8.6.12 .   # hanya Phase 0
```

Produksi (di VPS, folder `/opt/ikn`): `docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`. Tidak pernah build Next.js di VPS.

FE (dev lokal di luar Docker bila perlu, dari `ikn-fe/`): `npm run dev`, `npm run typecheck`, `npm run lint`. Setelah Phase 11 FE hanya butuh `NEXT_PUBLIC_API_URL` (browser) dan `API_INTERNAL_URL` (server).

## Konvensi kode ikn-be

- Laravel 8.83.29 dipin exact di `composer.json`. Package baru: cek kompatibel Laravel 8 + PHP 8.1 (`composer why-not`, changelog), pin versi, catat di `plan/01-architecture.md` bagian 5.
- Struktur: Controller tipis → Form Request (validasi) → Service (logika) → Model. Policy/middleware untuk otorisasi. API Resource untuk output (camelCase).
- Prefix route `/api/v1`. Envelope `{ data }`, error `{ message, code, errors }` (lihat kontrak bagian 1–2).
- Status/enum: string di DB + konstanta di model (`Order::STATUS_PAID`) + `Rule::in(Model::STATUSES)`. Tidak ada enum Postgres, tidak ada `->enum()`.
- Uang: `decimal(15,2)` di DB, integer rupiah di JSON lewat helper `Money`. Tidak ada float.
- Waktu: kolom `timestampTz`; `APP_TIMEZONE=Asia/Jakarta`; koneksi DB `SET TIME ZONE 'UTC'`; output ISO-8601 dengan offset.
- Email: lowercase + unique. Pencarian teks: `ILIKE`.
- JSON: `jsonb` untuk translatable `{id,en}`, `page_sections.content`, `payments.payload`, snapshot order.
- Satu pintu: stok hanya lewat `StockLedger`; transisi order hanya lewat `OrderStateMachine`; hitungan harga hanya lewat `OrderCalculator`; notifikasi lewat `OrderNotifier`.
- Idempotensi: `stock_movements.idempotency_key`, webhook `provider+external_id+event`, `Idempotency-Key` checkout.
- File privat (bukti bayar, lampiran WBS) di disk `private`, diakses lewat `GET /files/{media}` ber-Policy. Tidak pernah di `public/storage`.
- Test: PHPUnit di Postgres `ikn_test`, `RefreshDatabase`. Bukan SQLite. Test wajib: checkout bersamaan, expiry idempoten, tolak-lalu-upload-ulang, webhook ganda.
- Skrip shell: LF (`.gitattributes`), karena pengembangan di Windows.
- Tidak ada Filament, tidak ada dual-write, tidak ada fallback mock di produksi.

## Konvensi kode ikn-fe

- Tetap TypeScript strict, `@/` alias, komponen `components/<Nama>/<Nama>.tsx` + `index.ts`.
- Semua HTTP lewat `lib/api.ts` (`api()` + `ApiError` + `errorMessage()`); RSC publik lewat `lib/server-data.ts` ke `API_INTERNAL_URL`. Tidak ada `fetch` langsung di komponen.
- Status order/payment dan labelnya hanya di `lib/commerce.ts`; nilai mengikuti kontrak.
- Field translatable dari API berbentuk `{id,en}`; pilih bahasa dengan `useLang()`.
- Setelah Phase 11: dilarang mengimpor `supabase*`, `mock-api`, `mock-data`, atau merujuk `/sso/`.

## Aturan kerja per phase

1. Sebelum mulai: baca phase terkait di `plan/IMPLEMENTATION_PLAN.md`, jalankan `graphify query` untuk area yang disentuh, lalu buat daftar file yang akan diubah.
2. Selama phase: satu commit per unit logis dengan pesan `feat(<modul>): ...` / `fix` / `test` / `chore`, Bahasa Inggris, diakhiri baris `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Commit hanya bila diminta.
3. Setiap endpoint: Form Request + Resource + Policy/middleware + feature test + entri OpenAPI + baris di `plan/02-api-contract.md` bila menyimpang dari kontrak.
4. Setiap migrasi: nama deskriptif, `down()` yang benar, tidak mengubah migrasi yang sudah dijalankan di produksi (buat migrasi baru).
5. Sebelum menyatakan phase selesai: `php artisan test` hijau, seeder demo jalan (`migrate:fresh --seed`), `docker compose ps` sehat, acceptance criteria dicentang, `graphify update .` di root.
6. Jangan memulai phase berikutnya sebelum pemilik proyek me-review hasil phase saat ini.
7. Perubahan keputusan terkunci atau kontrak API: berhenti dan tanyakan, jangan asumsikan.
8. Rahasia (`.env`, kredensial SMTP, token gateway) tidak pernah di-commit atau ditulis ke dokumen; hanya nama variabelnya.
