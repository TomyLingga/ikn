<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\ContactMessage;
use App\Models\Media;
use App\Models\Post;
use App\Models\Product;
use App\Models\User;
use App\Models\WbsReport;
use App\Services\Audit\AuditLogger;
use App\Services\Media\MediaService;
use App\Services\Stock\StockLedger;
use App\Services\Wbs\WbsCodeGenerator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Kasus demo di luar order (dijalankan setelah CommerceDemoSeeder):
 * - laporan WBS di tiga status (baru/anonim, ditinjau, ditutup + lampiran),
 * - pesan kontak (belum dibaca, permintaan penawaran produk, sudah dibaca),
 * - stok: opname minus → stok rendah di dashboard, pindah stok → stok habis, produksi masuk,
 * - audit log contoh aksi admin (produk, pembayaran, pengaturan, stok, berita).
 * Idempoten: tiap bagian dilewati bila datanya sudah ada.
 */
class DemoCasesSeeder extends Seeder
{
    public function run(MediaService $media, StockLedger $ledger, AuditLogger $audit): void
    {
        $now = now();
        $super = User::where('email', config('ikn.seed.super_admin_email'))->first() ?? User::admins()->orderBy('id')->first();
        $sales = User::where('email', 'penjualan@ptikn.com')->first() ?? $super;
        $content = User::where('email', 'konten@ptikn.com')->first() ?? $super;

        try {
            $this->wbsReports($now, $media, $super);
            $this->contactMessages($now);
            $this->stock($now, $ledger, $sales);
            $this->auditLogs($now, $audit, $super, $sales, $content);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function wbsReports(Carbon $now, MediaService $media, ?User $admin): void
    {
        if (WbsReport::exists()) {
            return;
        }

        // Ditutup (40 hari lalu) + lampiran PDF di disk private.
        $this->at($now->copy()->subDays(40)->setTime(8, 20), function () use ($media, $admin) {
            $tmp = tempnam(sys_get_temp_dir(), 'ikn').'.pdf';
            file_put_contents($tmp, MediaSeeder::placeholderPdf('Lampiran laporan WBS (contoh)'));
            try {
                $attachment = $media->importFromPath($tmp, 'wbs', Media::DISK_PRIVATE, 'bukti-laporan.pdf');
            } finally {
                @unlink($tmp);
            }
            $this->report([
                'subject' => 'Dugaan mark-up harga pembelian suku cadang',
                'body' => 'Saya menemukan selisih harga antara penawaran vendor dan nilai yang tercatat pada pembelian suku cadang mesin press bulan lalu. Dokumen pembanding terlampir.',
                'reporter_name' => 'Mitra Vendor (identitas dirahasiakan)',
                'reporter_contact' => 'vendor.mitra@proton.me',
                'is_anonymous' => false,
                'attachment_media_id' => $attachment->id,
                'status' => WbsReport::STATUS_CLOSED,
                'handled_by' => $admin?->id,
                'admin_notes' => 'Telah diverifikasi tim audit internal; selisih berasal dari biaya pengiriman yang belum tercantum pada penawaran. Laporan ditutup, pelapor sudah diberi tahu.',
            ]);
        });

        // Sedang ditinjau (10 hari lalu).
        $this->at($now->copy()->subDays(10)->setTime(15, 40), fn () => $this->report([
            'subject' => 'Pelanggaran K3 di area gudang bahan kimia',
            'body' => 'Beberapa kali saya melihat pekerja menangani pelarut tanpa APD lengkap dan ventilasi gudang B tidak dinyalakan saat shift malam.',
            'reporter_name' => 'Karyawan Produksi',
            'reporter_contact' => '081266600011',
            'is_anonymous' => false,
            'status' => WbsReport::STATUS_REVIEW,
            'handled_by' => $admin?->id,
            'admin_notes' => 'Diteruskan ke Kabag K3 untuk inspeksi mendadak minggu ini.',
        ]));

        // Baru masuk, anonim (2 hari lalu).
        $this->at($now->copy()->subDays(2)->setTime(21, 5), fn () => $this->report([
            'subject' => 'Dugaan pungutan liar di gerbang pabrik',
            'body' => 'Sopir truk ekspedisi mengeluhkan adanya permintaan "uang parkir" di luar ketentuan oleh oknum petugas gerbang pada jam bongkar muat malam hari.',
            'reporter_name' => null,
            'reporter_contact' => null,
            'is_anonymous' => true,
            'status' => WbsReport::STATUS_NEW,
        ]));
    }

    private function report(array $attributes): WbsReport
    {
        return DB::transaction(fn () => WbsReport::create(['code' => app(WbsCodeGenerator::class)->next()] + $attributes));
    }

    private function contactMessages(Carbon $now): void
    {
        if (ContactMessage::exists()) {
            return;
        }

        // Permintaan penawaran dari halaman produk (belum dibaca, 3 jam lalu).
        $this->at($now->copy()->subHours(3), fn () => ContactMessage::create([
            'type' => ContactMessage::TYPE_QUOTE, 'name' => 'Rizky Pratama', 'email' => 'rizky@catnusantara.co.id', 'phone' => '+6281288899900',
            'subject' => 'Penawaran Resiprene 35 untuk 5 ton/bulan',
            'message' => 'Kami produsen cat anti-karat di Bekasi dan membutuhkan Resiprene 35 sekitar 5 ton per bulan. Mohon penawaran harga, lead time, dan spesifikasi teknis (CoA) terbaru.',
            'meta' => ['productSlug' => 'resiprene-35', 'ip' => '114.124.1.10', 'userAgent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'],
        ]));

        // Pesan kontak umum (belum dibaca, kemarin).
        $this->at($now->copy()->subDay()->setTime(10, 25), fn () => ContactMessage::create([
            'type' => ContactMessage::TYPE_CONTACT, 'name' => 'Maria Tan', 'email' => 'maria.tan@asiarubbertrade.com', 'phone' => '+6596221122',
            'subject' => 'Distributor untuk pasar Singapura',
            'message' => 'We are interested in becoming a distributor for Resiprene products in Singapore and Malaysia. Could you share your distributor requirements and export price list?',
            'meta' => ['ip' => '203.116.4.21', 'userAgent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/605.1.15'],
        ]));

        // Pesan lama yang sudah dibaca (15 hari lalu).
        $this->at($now->copy()->subDays(15)->setTime(14, 50), fn () => ContactMessage::create([
            'type' => ContactMessage::TYPE_CONTACT, 'name' => 'Agus Salim', 'email' => 'agus.salim88@gmail.com', 'phone' => '081377711122',
            'subject' => 'Lowongan kerja operator produksi',
            'message' => 'Selamat siang, apakah PT IKN sedang membuka lowongan operator produksi di Tanjung Morawa? Saya berpengalaman 5 tahun di pabrik karet.',
            'meta' => ['ip' => '36.72.8.4', 'userAgent' => 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Mobile'],
            'read_at' => now()->addDay(),
        ]));
    }

    /** Stok rendah (dashboard), stok habis (katalog "Stok habis"), dan mutasi masuk dari produksi. */
    private function stock(Carbon $now, StockLedger $ledger, ?User $admin): void
    {
        $packing = Product::where('slug', 'packing-pintu-rebusan')->first();
        if ($packing && ! $packing->stockMovements()->where('note', 'like', 'Stock opname%')->exists()) {
            $available = max(0, (int) $packing->stock_qty - (int) $packing->reserved_qty);
            $target = 8; // di bawah ambang stok rendah dashboard (maks(moq×10, 50))
            if ($available > $target) {
                $this->at($now->copy()->subDays(5)->setTime(16, 10), fn () => $ledger->adjust($packing, $target - $available, 'Stock opname: '.($available - $target).' pcs rusak (retak), dikeluarkan dari stok', $admin));
            }
        }

        $kampak = Product::where('slug', 'sarung-kampak')->first();
        if ($kampak && ! $kampak->stockMovements()->where('note', 'like', 'Dipindahkan ke stok proyek%')->exists()) {
            $available = max(0, (int) $kampak->stock_qty - (int) $kampak->reserved_qty);
            if ($available > 0) {
                $this->at($now->copy()->subDays(7)->setTime(11, 30), fn () => $ledger->adjust($kampak, -$available, 'Dipindahkan ke stok proyek PTPN III (stok toko habis, menunggu produksi)', $admin));
            }
        }

        $ring = Product::where('slug', 'rubber-ring')->first();
        if ($ring && ! $ring->stockMovements()->where('note', 'like', 'Produksi batch%')->exists()) {
            $this->at($now->copy()->subDays(2)->setTime(8, 45), fn () => $ledger->in($ring, 500, 'Produksi batch '.$now->copy()->subDays(2)->format('Y-m'), $admin));
        }
    }

    /** Contoh jejak audit (format sama dengan middleware audit: "METHOD uri", after = body + _path + _status). */
    private function auditLogs(Carbon $now, AuditLogger $audit, ?User $super, ?User $sales, ?User $content): void
    {
        // Transisi order sistem (mis. "order.expired [system]") juga menulis audit; penanda idempoten = aksi admin seeded.
        if (AuditLog::where('action', 'like', '% api/v1/admin/%')->exists()) {
            return;
        }

        $resiprene = Product::where('slug', 'resiprene-35')->first();
        $packing = Product::where('slug', 'packing-pintu-rebusan')->first();
        $post = Post::orderBy('id')->first();

        $rows = [
            [$now->copy()->subDays(21)->setTime(9, 40), $super, 'PUT api/v1/admin/products/{product}', $resiprene, ['price' => 180000], ['price' => 185000, 'moq' => 25, '_path' => 'api/v1/admin/products/'.($resiprene?->id ?? 0), '_status' => 200]],
            [$now->copy()->subDays(14)->setTime(10, 5), $super, 'PUT api/v1/admin/site-settings', null, null, ['contact' => ['whatsapp' => '628116123993'], 'theme' => ['primary' => '#0b6fb8'], '_path' => 'api/v1/admin/site-settings', '_status' => 200]],
            [$now->copy()->subDays(6)->setTime(14, 12), $sales, 'POST api/v1/admin/payments/{payment}/accept', null, null, ['_path' => 'api/v1/admin/payments/12/accept', '_status' => 200]],
            [$now->copy()->subDays(5)->setTime(16, 10), $sales, 'POST api/v1/admin/products/{product}/stock', $packing, null, ['type' => 'adjust', 'qty' => -31, 'note' => 'Stock opname', '_path' => 'api/v1/admin/products/'.($packing?->id ?? 0).'/stock', '_status' => 201]],
            [$now->copy()->subDays(3)->setTime(11, 30), $content, 'PUT api/v1/admin/news/{post}', $post, ['isPublished' => false], ['isPublished' => true, '_path' => 'api/v1/admin/news/'.($post?->id ?? 0), '_status' => 200]],
            [$now->copy()->subDays(2)->setTime(14, 0), $sales, 'POST api/v1/admin/payments/{payment}/reject', null, null, ['reason' => 'Nominal transfer kurang Rp50.000 dari total tagihan (kode unik belum disertakan).', '_path' => 'api/v1/admin/payments/15/reject', '_status' => 200]],
            [$now->copy()->subHours(5), $super, 'PUT api/v1/admin/users/{user}', $sales, ['status' => 'active'], ['status' => 'active', 'permissions' => ['dashboard', 'orders', 'payments', 'products', 'stock', 'customers', 'chat', 'reports'], '_path' => 'api/v1/admin/users/'.($sales?->id ?? 0), '_status' => 200]],
        ];

        foreach ($rows as [$time, $user, $action, $subject, $before, $after]) {
            $this->at($time, function () use ($audit, $user, $action, $subject, $before, $after) {
                $log = $audit->log($user, $action, $subject, $before, $after);
                if ($log) {
                    $log->forceFill(['ip' => '114.124.0.'.random_int(2, 250), 'user_agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130'])->save();
                }
            });
        }
    }

    private function at(Carbon $time, callable $fn)
    {
        Carbon::setTestNow($time);
        try {
            return $fn();
        } finally {
            Carbon::setTestNow();
        }
    }
}
