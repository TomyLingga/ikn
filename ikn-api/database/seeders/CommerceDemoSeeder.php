<?php

namespace Database\Seeders;

use App\Exceptions\ApiException;
use App\Models\BankAccount;
use App\Models\ChatMessage;
use App\Models\CustomerAddress;
use App\Models\DeliveryTerm;
use App\Models\Media;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Chat\ChatService;
use App\Services\Commerce\CheckoutService;
use App\Services\Commerce\FreightQuoteService;
use App\Services\Commerce\OrderCalculator;
use App\Services\Commerce\OrderNotifier;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Commerce\ProformaService;
use App\Services\Stock\StockLedger;
use App\Services\Media\MediaService;
use App\Services\Payment\PaymentService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Order demo di semua status dan semua kasus yang bisa terjadi di toko, dibuat lewat CheckoutService +
 * PaymentService + OrderStateMachine (bukan insert mentah) agar ledger stok, voucher, payment, histori,
 * invoice, notifikasi, dan chat konsisten. Tanggal mundur sampai 11 bulan (Carbon::setTestNow) agar dashboard,
 * laporan, dan grafik 12 bulan berisi.
 *
 * Customer utama buyer@coatingsolutions.co.id (Budi): selesai (banyak bulan), dikirim + catatan perjalanan,
 * diproses, dibayar, kedaluwarsa, dibatalkan customer, dibatalkan admin setelah bayar (stok kembali), sampai
 * (menunggu konfirmasi, dengan lampiran faktur/surat jalan dari admin), bukti ditolak lalu unggah ulang,
 * bukti ditolak menunggu unggah ulang, bayar QRIS, kirim ke alamat kedua (Medan, Ekspres), voucher khusus
 * MITRA250, voucher ONGKIRGRATIS, voucher IKN10. Customer kedua purchasing@mitrakimia.co.id (Siti, EN,
 * Surabaya): selesai + ulasan belum terbit, diproses, menunggu bayar. Chat: dua customer + satu tamu.
 *
 * Idempoten: order demo ditandai orders.idempotency_key "seed:demo:N"; seluruh seeder dilewati bila penanda
 * sudah ada (order lain, mis. hasil uji manual, tidak menghalangi).
 */
class CommerceDemoSeeder extends Seeder
{
    public const KEY_PREFIX = 'seed:demo:';

    private int $sequence = 0;

    private User $admin;

    private User $salesAdmin;

    private PaymentMethod $transfer;

    private ?PaymentMethod $qris = null;

    private ?BankAccount $bank = null;

    // Konteks customer aktif untuk place(); diganti lewat as().
    private User $buyer;

    private ?CustomerAddress $address = null;

    private CheckoutService $checkout;

    private PaymentService $payments;

    private OrderStateMachine $sm;

    private MediaService $media;

    private OrderCalculator $calculator;

    public function run(CheckoutService $checkout, PaymentService $payments, OrderStateMachine $sm, MediaService $media, OrderCalculator $calculator): void
    {
        $budi = User::where('email', 'buyer@coatingsolutions.co.id')->first();
        if (! $budi || Order::where('idempotency_key', 'like', self::KEY_PREFIX.'%')->exists()) {
            return;
        }
        $transfer = PaymentMethod::active()->where('code', 'manual_transfer')->first();
        if (! $budi->addresses()->exists() || ! $transfer || ! Product::where('slug', 'resiprene-35')->exists()) {
            return; // prasyarat dari CustomerSeeder/CatalogSeeder/CommerceConfigSeeder belum ada
        }

        $this->checkout = $checkout;
        $this->payments = $payments;
        $this->sm = $sm;
        $this->media = $media;
        $this->calculator = $calculator;
        $this->transfer = $transfer;
        $this->qris = PaymentMethod::active()->where('code', 'qris_static')->first();
        $this->bank = BankAccount::active()->orderBy('sort_order')->orderBy('id')->first();
        $this->admin = User::where('email', config('ikn.seed.super_admin_email'))->first() ?? User::admins()->orderBy('id')->firstOrFail();
        $this->salesAdmin = User::where('email', 'penjualan@ptikn.com')->where('status', User::STATUS_ACTIVE)->first() ?? $this->admin;

        // Email demo tidak perlu dikirim/di-log saat seeding (notifikasi dalam aplikasi tetap dibuat).
        Mail::fake();

        // Order demo berkurir dibuat seolah Franco masih aktif (riwayat sebelum klien beralih ke Loco, ASUMSI A-85);
        // status aktif baris Franco dikembalikan setelah selesai.
        $franco = DeliveryTerm::where('code', 'franco')->first();
        $francoWasActive = (bool) $franco?->is_active;
        $franco?->update(['is_active' => true]);

        $now = now();
        try {
            // Produksi Resiprene tambahan agar skenario ekspor (FOB/CIF) tidak kehabisan stok.
            $resiprene = Product::where('slug', 'resiprene-35')->first();
            $this->at($now->copy()->subMonths(12)->startOfMonth(), fn () => app(StockLedger::class)->in($resiprene, 5000, 'Produksi batch Resiprene Sei Bamban (seeder)', $this->admin, 'seed:stock:resiprene-batch'));

            $this->as($budi);
            $this->budiHistory($now);
            $this->budiCurrent($now);
            $this->localCoverage($now);

            $siti = User::where('email', 'purchasing@mitrakimia.co.id')->where('status', User::STATUS_ACTIVE)->first();
            if ($siti && $siti->addresses()->exists()) {
                $this->as($siti);
                $this->sitiOrders($now);
                $this->sitiChat($now);
            }

            // Customer ekspor (ASUMSI A-86): satu order USD FOB Belawan menunggu transfer ke rekening USD.
            $export = User::where('email', 'buyer@rubbertrade.example')->where('status', User::STATUS_ACTIVE)->first();
            if ($export && $export->isExport() && BankAccount::active()->forCurrency('USD')->exists()) {
                $this->as($export);
                $this->exportOrders($now);
            }

            $this->as($budi);
            $this->budiChat($now);
            $this->guestChat($now);

            // Lonceng portal: notifikasi lebih lama dari tiga hari dianggap sudah dibaca.
            UserNotification::where('created_at', '<', $now->copy()->subDays(3))->whereNull('read_at')->update(['read_at' => $now]);
        } finally {
            Carbon::setTestNow();
            $franco?->update(['is_active' => $francoWasActive]);
        }
    }

    // ------------------------------------------------------------------ Budi: riwayat 11 bulan (grafik penjualan)

    private function budiHistory(Carbon $now): void
    {
        $month = fn (int $back, int $day, int $hour) => $now->copy()->subMonths($back)->startOfMonth()->addDays($day - 1)->setTime($hour, 15);

        $this->completedOrder($month(11, 9, 10), [['resiprene-35', 40]], 'JNE Trucking', 'JNT2025110900');
        $this->completedOrder($month(10, 14, 9), [['sepatu-boots', 15], ['sarung-egrek', 20]], 'SiCepat Cargo', 'SC2025121400');
        $this->completedOrder($month(9, 6, 14), [['rubber-ring', 200]], 'JNE Reguler', 'JNE2026010600');
        $this->completedOrder($month(8, 18, 11), [['resiprene-35', 60]], 'JNE Trucking', 'JNT2026021800');
        $this->completedOrder($month(7, 3, 13), [['packing-pintu-rebusan', 2]], 'Indah Cargo', 'IC2026030300');
        $this->completedOrder($month(6, 21, 10), [['acting-rubber', 4], ['rubber-flange-packing', 20]], 'JNE Reguler', 'JNE2026042100');
        // Voucher ONGKIRGRATIS (kategori Resiprene) terpakai.
        $this->completedOrder($month(5, 11, 9), [['resiprene-35', 80]], 'JNE Trucking', 'JNT2026051100', [], ['voucher' => 'ONGKIRGRATIS']);
        $this->completedOrder($month(4, 25, 15), [['sepatu-boots', 30]], 'SiCepat Cargo', 'SC2026062500');
        $this->completedOrder($month(3, 8, 10), [['resiprene-35', 50], ['rubber-ring', 100]], 'JNE Trucking', 'JNT2026070800');
        $this->completedOrder($month(2, 16, 11), [['sarung-egrek', 40]], 'JNE Reguler', 'JNE2026081600');
    }

    // ------------------------------------------------------------------ Budi: 45 hari terakhir (semua status/kasus)

    private function budiCurrent(Carbon $now): void
    {
        // Selesai (dengan ulasan terbit) → laporan + ulasan produk.
        $this->completedOrder($now->copy()->subDays(45)->setTime(10, 15), [['resiprene-35', 50]], 'JNE Trucking', 'JNT4501122334', [
            ['resiprene-35', 5, 'Kualitas konsisten, kelarutan sangat baik untuk formulasi cat marine kami.'],
        ]);
        $this->completedOrder($now->copy()->subDays(30)->setTime(14, 40), [['sepatu-boots', 20], ['sarung-egrek', 30]], 'SiCepat Cargo', 'SC0009988776', [
            ['sepatu-boots', 4, 'Boots nyaman dipakai seharian di kebun, sol anti-slip bekerja baik.'],
        ]);
        // Selesai memakai voucher khusus customer MITRA250 (ASUMSI A-67).
        $this->completedOrder($now->copy()->subDays(25)->setTime(9, 45), [['resiprene-35', 25]], 'JNE Trucking', 'JNT2026091901', [], ['voucher' => 'MITRA250']);
        $this->completedOrder($now->copy()->subDays(18)->setTime(9, 5), [['rubber-ring', 100]], 'JNE Reguler', 'JNE1122334455');
        // Selesai, dikirim ke alamat kedua (Cabang Medan, zona Sumatera Utara) dengan layanan Ekspres.
        $medan = $this->buyer->addresses()->where('label', 'Cabang Medan')->first();
        if ($medan) {
            $this->completedOrder($now->copy()->subDays(12)->setTime(13, 30), [['rubber-flange-packing', 40], ['rubber-ring', 50]], 'JNE Trucking', 'JNT2026100201', [
                ['rubber-flange-packing', 5, 'Ukuran presisi, dipakai di jalur uap boiler tanpa bocor.'],
            ], ['address' => $medan, 'rate' => 'Ekspres']);
        }

        // Sampai (menunggu konfirmasi customer / auto-complete) + lampiran faktur pajak & surat jalan dari admin.
        $delivered = $this->paidOrder($now->copy()->subDays(9)->setTime(10, 30), [['acting-rubber', 6]]);
        $this->at($delivered->created_at->copy()->addDay()->setTime(8, 40), fn () => $this->sm->transition($delivered, Order::STATUS_PROCESSING, $this->salesAdmin));
        $this->at($delivered->created_at->copy()->addDays(2)->setTime(14, 10), fn () => $this->sm->transition($delivered, Order::STATUS_SHIPPED, $this->salesAdmin, ['courier' => 'Indah Cargo', 'trackingNumber' => 'IC2026100501']));
        $this->attachment($delivered, $delivered->created_at->copy()->addDays(2)->setTime(14, 20), 'faktur-pajak.pdf', 'Faktur pajak');
        $this->attachment($delivered, $delivered->created_at->copy()->addDays(2)->setTime(14, 22), 'surat-jalan.pdf', 'Surat jalan');
        $this->trackingNote($delivered, $delivered->created_at->copy()->addDays(3)->setTime(9, 0), 'Pesanan berangkat dari gudang Medan');
        $this->at($delivered->created_at->copy()->addDays(6)->setTime(16, 30), fn () => $this->sm->transition($delivered, Order::STATUS_DELIVERED, $this->buyer));

        // Dibatalkan ADMIN setelah dibayar: stok kembali, dana dikembalikan di luar sistem.
        $refund = $this->paidOrder($now->copy()->subDays(8)->setTime(11, 15), [['packing-pintu-rebusan', 1]]);
        $this->at($refund->created_at->copy()->addDay()->setTime(9, 50), fn () => $this->sm->transition($refund, Order::STATUS_CANCELLED, $this->salesAdmin, ['reason' => 'Stok bahan baku batch ini belum tersedia; dana telah dikembalikan ke rekening customer.']));

        // Dikirim (6 hari lalu) + catatan perjalanan kiriman (ASUMSI A-70).
        $shipped = $this->paidOrder($now->copy()->subDays(6)->setTime(11, 20), [['resiprene-35', 30], ['acting-rubber', 2]]);
        $this->at($shipped->created_at->copy()->addDay()->setTime(8, 30), fn () => $this->sm->transition($shipped, Order::STATUS_PROCESSING, $this->salesAdmin, ['note' => 'Disiapkan gudang Medan']));
        $this->at($shipped->created_at->copy()->addDays(2)->setTime(15, 0), fn () => $this->sm->transition($shipped, Order::STATUS_SHIPPED, $this->salesAdmin, ['courier' => 'JNE Trucking', 'trackingNumber' => 'JNT2026093001']));
        $this->trackingNote($shipped, $shipped->created_at->copy()->addDays(3)->setTime(9, 10), 'Pesanan berangkat dari gudang Medan');
        $this->trackingNote($shipped, $shipped->created_at->copy()->addDays(4)->setTime(17, 45), 'Pesanan tiba di gudang transit Pekanbaru, Riau');
        $this->shippedOrder = $shipped;

        // Kedaluwarsa (dibuat 4 hari lalu, tidak dibayar).
        $expired = $this->at($now->copy()->subDays(4)->setTime(13, 10), fn () => $this->place([['sepatu-boots', 10]]));
        $this->at($expired->created_at->copy()->addHours(25), fn () => $this->payments->expire($expired));

        // Dibatalkan CUSTOMER sebelum bayar (3 hari lalu).
        $cancelled = $this->at($now->copy()->subDays(3)->setTime(9, 30), fn () => $this->place([['sarung-egrek', 5]]));
        $this->at($cancelled->created_at->copy()->addMinutes(40), fn () => $this->sm->transition($cancelled, Order::STATUS_CANCELLED, $this->buyer, ['reason' => 'Salah memilih jumlah, akan pesan ulang.']));

        // Bukti bayar DITOLAK lalu customer UNGGAH ULANG → menunggu verifikasi lagi (riwayat payment: rejected + awaiting).
        $retry = $this->at($now->copy()->subDays(2)->setTime(14, 0), fn () => $this->place([['rubber-ring', 150]], 'Mohon packing per 50 pcs.'));
        $this->at($retry->created_at->copy()->addHour(), fn () => $this->payments->attachProof($retry, $retry->activePayment(), $this->proofMedia('bukti-transfer.pdf'), $this->buyer));
        $this->at($retry->created_at->copy()->addHours(3), fn () => $this->payments->reject($retry->fresh()->activePayment(), $this->salesAdmin, 'Nominal transfer kurang Rp50.000 dari total tagihan (kode unik belum disertakan).'));
        $this->at($retry->created_at->copy()->addHours(6), function () use ($retry) {
            $order = $retry->fresh();
            $payment = $this->payments->resolveProofPayment($order, null, $this->buyer);
            $this->payments->attachProof($order, $payment, $this->proofMedia('bukti-transfer-revisi.pdf'), $this->buyer);
        });

        // Diproses (1 hari lalu).
        $processing = $this->paidOrder($now->copy()->subDay()->setTime(10, 0), [['rubber-ring', 50]]);
        $this->at($processing->created_at->copy()->addHours(5), fn () => $this->sm->transition($processing, Order::STATUS_PROCESSING, $this->salesAdmin));

        // Dibayar, belum diproses (2 hari lalu).
        $this->paidOrder($now->copy()->subDays(2)->setTime(16, 45), [['packing-pintu-rebusan', 1]]);

        // Loco (ASUMSI A-85): diambil sendiri di pabrik, tanpa ongkir; kini SIAP DIAMBIL (shipped tanpa kurir/resi).
        if (DeliveryTerm::active()->where('code', 'loco')->exists()) {
            $pickup = $this->paidOrder($now->copy()->subDays(5)->setTime(9, 20), [['sarung-egrek', 25], ['sepatu-boots', 10]], ['term' => 'loco', 'note' => 'Diambil dengan mobil boks perusahaan.']);
            $this->at($pickup->created_at->copy()->addDay()->setTime(8, 45), fn () => $this->sm->transition($pickup, Order::STATUS_PROCESSING, $this->salesAdmin));
            $this->at($pickup->created_at->copy()->addDays(2)->setTime(13, 30), fn () => $this->sm->transition($pickup, Order::STATUS_SHIPPED, $this->salesAdmin));
        }

        // Menunggu verifikasi (bukti transfer diunggah 20 jam lalu).
        $review = $this->at($now->copy()->subHours(20), fn () => $this->place([['resiprene-35', 25]], 'Mohon sertakan CoA per batch.'));
        $this->at($review->created_at->copy()->addMinutes(35), fn () => $this->payments->attachProof($review, $review->activePayment(), $this->proofMedia('bukti-transfer.pdf'), $this->buyer));

        // Bukti bayar DITOLAK, customer belum unggah ulang (masih menunggu pembayaran, batas diperpanjang 12 jam).
        $rejected = $this->at($now->copy()->subHours(9), fn () => $this->place([['sepatu-boots', 12]]));
        $this->at($rejected->created_at->copy()->addMinutes(30), fn () => $this->payments->attachProof($rejected, $rejected->activePayment(), $this->proofMedia('bukti-transfer.pdf'), $this->buyer));
        $this->at($rejected->created_at->copy()->addHours(2), fn () => $this->payments->reject($rejected->fresh()->activePayment(), $this->salesAdmin, 'Bukti transfer tidak terbaca (buram); mohon unggah ulang foto yang jelas.'));

        // Bayar QRIS, bukti berupa gambar, menunggu verifikasi (5 jam lalu).
        if ($this->qris) {
            $qris = $this->at($now->copy()->subHours(5), fn () => $this->place([['sarung-egrek', 15], ['rubber-ring', 20]], null, null, null, $this->qris));
            $this->at($qris->created_at->copy()->addMinutes(12), fn () => $this->payments->attachProof($qris, $qris->activePayment(), $this->proofMedia('bukti-qris.png'), $this->buyer));
        }

        // Menunggu pembayaran (baru saja, dengan voucher IKN10 bila berlaku).
        $this->at($now->copy()->subMinutes(15), function () {
            try {
                return $this->place([['resiprene-35', 30]], 'Kirim jam kerja (08.00–16.00).', 'IKN10');
            } catch (ApiException $e) {
                return $this->place([['resiprene-35', 30]], 'Kirim jam kerja (08.00–16.00).');
            }
        });
    }

    private ?Order $shippedOrder = null;

    // ------------------------------------------------------------------ Siti (customer kedua, EN, Surabaya)

    private function sitiOrders(Carbon $now): void
    {
        $month = fn (int $back, int $day, int $hour) => $now->copy()->subMonths($back)->startOfMonth()->addDays($day - 1)->setTime($hour, 0);

        $this->completedOrder($month(6, 12, 10), [['rubber-ring', 400]], 'Indah Cargo', 'IC2026041200');
        $this->completedOrder($month(2, 4, 14), [['sepatu-boots', 25]], 'JNE Trucking', 'JNT2026080400');
        // Selesai 20 hari lalu + ulasan yang BELUM TERBIT (menunggu moderasi admin).
        $this->completedOrder($now->copy()->subDays(20)->setTime(10, 20), [['sepatu-boots', 40], ['sarung-egrek', 60]], 'Indah Cargo', 'IC2026092401', [
            ['sepatu-boots', 3, 'Rubber quality is good, but the sizes run slightly larger than the previous batch.', false],
        ]);
        // Diproses (3 hari lalu).
        $processing = $this->paidOrder($now->copy()->subDays(3)->setTime(9, 10), [['rubber-flange-packing', 100]]);
        $this->at($processing->created_at->copy()->addHours(4), fn () => $this->sm->transition($processing, Order::STATUS_PROCESSING, $this->salesAdmin));
        // Menunggu pembayaran (1 jam lalu).
        $this->at($now->copy()->subHour(), fn () => $this->place([['rubber-ring', 300]], 'Please include the certificate of analysis.'));
    }

    // ------------------------------------------------------------------ customer ekspor (USD, FOB Belawan)

    private function exportOrders(Carbon $now): void
    {
        $usdBank = BankAccount::active()->forCurrency('USD')->orderBy('sort_order')->orderBy('id')->first();
        // Menunggu pembayaran (2 jam lalu): 500 kg Resiprene 35 FOB Belawan, syarat 100% T/T di muka.
        $order = $this->at($now->copy()->subHours(2), fn () => $this->place([['resiprene-35', 500]], 'Please quote the earliest vessel from Belawan to Port Klang.', null, null, null, 'fob', [
            'paymentTermCode' => 'tt_advance', 'bankAccountId' => $usdBank?->id,
        ]));
        // Proforma revisi 1 (ASUMSI A-88) oleh admin penjualan: pelabuhan muat dan syarat bayar dari order, kapal menyusul.
        $this->at($now->copy()->subHours(2)->addMinutes(30), fn () => app(ProformaService::class)->save($order, [
            'portOfDischarge' => 'Port Klang',
            'notes' => 'Vessel and schedule to be confirmed after payment is received.',
            'validUntil' => $now->copy()->addDays(14)->toDateString(),
        ], $this->salesAdmin));

        // CIF (ASUMSI A-89): 300 kg Resiprene 35 ke Port Klang menunggu penawaran ongkir (kemarin); admin penjualan sudah
        // mengirim penawaran putaran 1 (ongkos kapal, biaya pelabuhan, asuransi; USD sen) yang berlaku 7 hari.
        $cif = $this->at($now->copy()->subDay(), fn () => $this->place([['resiprene-35', 300]], 'CIF Port Klang, please include marine insurance.', null, null, null, 'cif', [
            'paymentTermCode' => 'tt_advance', 'bankAccountId' => $usdBank?->id,
            'destinationPort' => ['name' => 'Port Klang', 'country' => 'Malaysia', 'countryCode' => 'MY', 'lat' => 2.9997, 'lng' => 101.3929],
        ]));
        $this->at($now->copy()->subDay()->addHours(3), fn () => app(FreightQuoteService::class)->adminPropose($cif, $this->salesAdmin, [
            ['label' => 'Ocean freight Belawan - Port Klang', 'amount' => 65000],
            ['label' => 'Port charges', 'amount' => 12000],
            ['label' => 'Insurance', 'amount' => 4500],
        ], $now->copy()->addDays(7), 'Rate valid for shipment within two weeks after payment.'));

        $this->exportCoverage($now, $usdBank);
    }

    // ------------------------------------------------------------------ cakupan kasus (2026-11-04)

    /**
     * Kasus lokal yang belum terwakili order lain: siklus Loco lengkap (bayar, diambil, batal), Loco dua pabrik
     * (Resiprene dari Sei Bamban + barang karet dari Tanjung Morawa = dua titik ambil), Franco dua pabrik asal,
     * dan pembayaran QRIS yang lunas sampai selesai.
     */
    private function localCoverage(Carbon $now): void
    {
        if (DeliveryTerm::active()->where('code', 'loco')->exists()) {
            // Loco SELESAI (sudah diambil) 40 hari lalu.
            $done = $this->paidOrder($now->copy()->subDays(40)->setTime(10, 0), [['sepatu-boots', 20]], ['term' => 'loco', 'note' => 'Diambil sopir kebun Pagar Merbau.']);
            $this->at($done->created_at->copy()->addDay()->setTime(9, 0), fn () => $this->sm->transition($done, Order::STATUS_PROCESSING, $this->salesAdmin));
            $this->at($done->created_at->copy()->addDays(2)->setTime(10, 0), fn () => $this->sm->transition($done, Order::STATUS_SHIPPED, $this->salesAdmin));
            $this->at($done->created_at->copy()->addDays(3)->setTime(14, 0), fn () => $this->sm->transition($done, Order::STATUS_DELIVERED, $this->salesAdmin));
            $this->at($done->created_at->copy()->addDays(4)->setTime(9, 0), fn () => $this->sm->transition($done, Order::STATUS_COMPLETED, $this->buyer));

            // Loco SUDAH DIAMBIL (delivered), menunggu konfirmasi customer.
            $picked = $this->paidOrder($now->copy()->subDays(4)->setTime(8, 40), [['rubber-ring', 40]], ['term' => 'loco']);
            $this->at($picked->created_at->copy()->addHours(20), fn () => $this->sm->transition($picked, Order::STATUS_PROCESSING, $this->salesAdmin));
            $this->at($picked->created_at->copy()->addDays(2)->setTime(9, 30), fn () => $this->sm->transition($picked, Order::STATUS_SHIPPED, $this->salesAdmin));
            $this->at($picked->created_at->copy()->addDays(3)->setTime(11, 15), fn () => $this->sm->transition($picked, Order::STATUS_DELIVERED, $this->salesAdmin));

            // Loco DUA PABRIK, dibayar dan sedang disiapkan (dua titik ambil: Sei Bamban + Tanjung Morawa).
            $twoPoints = $this->paidOrder($now->copy()->subDays(1)->setTime(13, 0), [['resiprene-35', 50], ['sarung-egrek', 30]], ['term' => 'loco', 'note' => 'Resiprene diambil di Sei Bamban, sarung egrek di Tanjung Morawa.']);
            $this->at($twoPoints->created_at->copy()->addHours(4), fn () => $this->sm->transition($twoPoints, Order::STATUS_PROCESSING, $this->salesAdmin));

            // Loco MENUNGGU PEMBAYARAN (30 menit lalu).
            $this->at($now->copy()->subMinutes(30), fn () => $this->place([['sepatu-boots', 6]], 'Akan diambil hari Jumat.', null, null, null, 'loco'));

            // Loco DIBATALKAN customer sebelum bayar.
            $cancel = $this->at($now->copy()->subDays(6)->setTime(15, 0), fn () => $this->place([['rubber-flange-packing', 10]], null, null, null, null, 'loco'));
            $this->at($cancel->created_at->copy()->addHours(2), fn () => $this->sm->transition($cancel, Order::STATUS_CANCELLED, $this->buyer, ['reason' => 'Beralih ke pengiriman ke gudang.']));

            // Loco KEDALUWARSA (tidak dibayar).
            $late = $this->at($now->copy()->subDays(9)->setTime(10, 0), fn () => $this->place([['sarung-egrek', 10]], null, null, null, null, 'loco'));
            $this->at($late->created_at->copy()->addHours(25), fn () => $this->payments->expire($late));
        }

        // Franco DUA PABRIK ASAL (ongkir dihitung per pabrik), dibayar dan diproses.
        $twoOrigins = $this->paidOrder($now->copy()->subDays(2)->setTime(9, 0), [['resiprene-35', 25], ['rubber-ring', 30]], ['note' => 'Satu alamat, dua pabrik asal.']);
        $this->at($twoOrigins->created_at->copy()->addHours(6), fn () => $this->sm->transition($twoOrigins, Order::STATUS_PROCESSING, $this->salesAdmin));

        // QRIS LUNAS sampai selesai (12 hari lalu).
        if ($this->qris) {
            $paid = $this->at($now->copy()->subDays(12)->setTime(11, 0), fn () => $this->place([['sarung-egrek', 20]], null, null, null, $this->qris));
            $this->at($paid->created_at->copy()->addMinutes(10), fn () => $this->payments->attachProof($paid, $paid->activePayment(), $this->proofMedia('bukti-qris-lunas.png'), $this->buyer));
            $this->at($paid->created_at->copy()->addHours(1), fn () => $this->payments->accept($paid->fresh()->activePayment(), $this->salesAdmin));
            $this->at($paid->created_at->copy()->addDay()->setTime(9, 0), fn () => $this->sm->transition($paid->fresh(), Order::STATUS_PROCESSING, $this->salesAdmin));
            $this->at($paid->created_at->copy()->addDays(2)->setTime(14, 0), fn () => $this->sm->transition($paid->fresh(), Order::STATUS_SHIPPED, $this->salesAdmin, ['courier' => 'J&T Cargo', 'trackingNumber' => 'JTC2026102301']));
            $this->at($paid->created_at->copy()->addDays(4)->setTime(10, 0), fn () => $this->sm->transition($paid->fresh(), Order::STATUS_DELIVERED, $this->buyer));
            $this->at($paid->created_at->copy()->addDays(5)->setTime(9, 0), fn () => $this->sm->transition($paid->fresh(), Order::STATUS_COMPLETED, $this->buyer));
        }
    }

    /**
     * Siklus order ekspor tambahan (USD): FOB dengan syarat 30/70 sampai selesai (kapal + B/L, dana diterima dikurangi
     * biaya bank), FOB on board, FOB menunggu verifikasi, FOB kedaluwarsa, CIF tanpa penawaran, CIF ditawar balik
     * customer, CIF disepakati (menunggu bayar), CIF selesai, dan CIF dibatalkan karena penawaran kedaluwarsa.
     */
    private function exportCoverage(Carbon $now, ?BankAccount $usdBank): void
    {
        $fob = fn (string $termCode) => ['paymentTermCode' => $termCode, 'bankAccountId' => $usdBank?->id];
        $port = ['name' => 'Port Klang', 'country' => 'Malaysia', 'countryCode' => 'MY', 'lat' => 2.9997, 'lng' => 101.3929];
        $cif = fn (string $termCode, array $destination) => $fob($termCode) + ['destinationPort' => $destination];
        $proof = fn (Order $order, Carbon $time) => $this->at($time, fn () => $this->payments->attachProof($order, $order->fresh()->activePayment(), $this->proofMedia('bukti-tt-usd.pdf'), $this->buyer));
        $accept = fn (Order $order, Carbon $time, int $received, int $charges) => $this->at($time, fn () => $this->payments->accept($order->fresh()->activePayment(), $this->salesAdmin, [
            'receivedAmount' => $received, 'bankCharges' => $charges, 'receivedNote' => 'Diterima di rekening USD setelah potongan bank koresponden.',
        ]));
        $ship = fn (Order $order, Carbon $time, string $vessel, string $bl) => $this->at($time, fn () => $this->sm->transition($order->fresh(), Order::STATUS_SHIPPED, $this->salesAdmin, [
            'vesselName' => $vessel, 'voyage' => 'V.'.substr($bl, -3), 'blNumber' => $bl, 'blDate' => $time->toDateString(),
        ]));

        // FOB SELESAI (45 hari lalu), syarat 30/70: proforma, pembayaran diterima dengan biaya bank, on board, diterima.
        $done = $this->at($now->copy()->subDays(45)->setTime(10, 0), fn () => $this->place([['resiprene-35', 1000]], 'Shipment to Port Klang, 40 bags per pallet.', null, null, null, 'fob', $fob('tt_30_70')));
        $this->at($done->created_at->copy()->addHours(2), fn () => app(ProformaService::class)->save($done, ['portOfDischarge' => 'Port Klang', 'notes' => '30% advance, 70% against copy of B/L.', 'validUntil' => $done->created_at->copy()->addDays(14)->toDateString()], $this->salesAdmin));
        $proof($done, $done->created_at->copy()->addDays(1));
        $accept($done, $done->created_at->copy()->addDays(1)->addHours(4), max(0, $done->fresh()->grandTotalInt() - 2500), 2500);
        $this->at($done->created_at->copy()->addDays(2), fn () => $this->sm->transition($done->fresh(), Order::STATUS_PROCESSING, $this->salesAdmin));
        $ship($done, $done->created_at->copy()->addDays(6)->setTime(16, 0), 'MV Kota Bahagia', 'BLW-PKG-2026-0918');
        $this->at($done->created_at->copy()->addDays(10), fn () => $this->sm->transition($done->fresh(), Order::STATUS_DELIVERED, $this->buyer));
        $this->at($done->created_at->copy()->addDays(11), fn () => $this->sm->transition($done->fresh(), Order::STATUS_COMPLETED, $this->buyer));

        // FOB ON BOARD (dikirim 3 hari lalu), 100% T/T di muka.
        $board = $this->at($now->copy()->subDays(8)->setTime(9, 30), fn () => $this->place([['resiprene-35', 400]], null, null, null, null, 'fob', $fob('tt_advance')));
        $proof($board, $board->created_at->copy()->addHours(5));
        $accept($board, $board->created_at->copy()->addDay(), $board->fresh()->grandTotalInt(), 0);
        $this->at($board->created_at->copy()->addDays(2), fn () => $this->sm->transition($board->fresh(), Order::STATUS_PROCESSING, $this->salesAdmin));
        $ship($board, $now->copy()->subDays(3)->setTime(15, 30), 'MV Sinar Belawan', 'BLW-PKG-2026-1101');

        // FOB MENUNGGU VERIFIKASI (bukti T/T diunggah 6 jam lalu), syarat 30/70.
        $review = $this->at($now->copy()->subDays(1)->setTime(10, 0), fn () => $this->place([['resiprene-35', 250]], null, null, null, null, 'fob', $fob('tt_30_70')));
        $proof($review, $now->copy()->subHours(6));

        // FOB KEDALUWARSA (tidak dibayar dalam batas waktu).
        $expired = $this->at($now->copy()->subDays(14)->setTime(11, 0), fn () => $this->place([['resiprene-35', 200]], null, null, null, null, 'fob', $fob('tt_advance')));
        $this->at($expired->created_at->copy()->addDays(6), fn () => $this->payments->expire($expired->fresh()));

        // CIF MENUNGGU PENAWARAN (belum ada penawaran admin, 2 jam lalu) ke Ho Chi Minh City.
        $this->at($now->copy()->subHours(2), fn () => $this->place([['resiprene-35', 300]], 'CIF Cat Lai port, please advise transit time.', null, null, null, 'cif', $cif('tt_advance', [
            'name' => 'Cat Lai, Ho Chi Minh City', 'country' => 'Vietnam', 'countryCode' => 'VN', 'lat' => 10.7578, 'lng' => 106.7884,
        ])));

        // CIF DITAWAR BALIK customer (menunggu keputusan admin).
        $counter = $this->at($now->copy()->subDays(3)->setTime(9, 0), fn () => $this->place([['resiprene-35', 350]], null, null, null, null, 'cif', $cif('tt_30_70', [
            'name' => 'Laem Chabang', 'country' => 'Thailand', 'countryCode' => 'TH', 'lat' => 13.0827, 'lng' => 100.8833,
        ])));
        $this->at($counter->created_at->copy()->addHours(5), fn () => app(FreightQuoteService::class)->adminPropose($counter->fresh(), $this->salesAdmin, [
            ['label' => 'Ocean freight Belawan - Laem Chabang', 'amount' => 98000],
            ['label' => 'Insurance', 'amount' => 5000],
        ], $now->copy()->addDays(4), null));
        $this->at($counter->created_at->copy()->addDay(), fn () => app(FreightQuoteService::class)->customerCounter($counter->fresh(), $this->buyer, 85000, 'Our forwarder quotes USD 850 for this lane.'));

        // CIF DISEPAKATI (customer menerima penawaran kemarin) → menunggu pembayaran.
        $agreed = $this->at($now->copy()->subDays(2)->setTime(10, 0), fn () => $this->place([['resiprene-35', 300]], null, null, null, null, 'cif', $cif('tt_advance', $port)));
        $quote = $this->at($agreed->created_at->copy()->addHours(3), fn () => app(FreightQuoteService::class)->adminPropose($agreed->fresh(), $this->salesAdmin, [
            ['label' => 'Ocean freight Belawan - Port Klang', 'amount' => 62000],
            ['label' => 'Insurance', 'amount' => 4000],
        ], $now->copy()->addDays(5), null));
        $this->at($now->copy()->subDay()->setTime(9, 0), fn () => app(FreightQuoteService::class)->customerAccept($agreed->fresh(), $this->buyer, $quote));

        // CIF SELESAI (60 hari lalu): penawaran diterima, dibayar, on board, diterima, selesai.
        $cifDone = $this->at($now->copy()->subDays(60)->setTime(10, 0), fn () => $this->place([['resiprene-35', 500]], null, null, null, null, 'cif', $cif('tt_advance', $port)));
        $doneQuote = $this->at($cifDone->created_at->copy()->addHours(4), fn () => app(FreightQuoteService::class)->adminPropose($cifDone->fresh(), $this->salesAdmin, [
            ['label' => 'Ocean freight Belawan - Port Klang', 'amount' => 70000],
            ['label' => 'Port charges', 'amount' => 12000],
            ['label' => 'Insurance', 'amount' => 5000],
        ], $cifDone->created_at->copy()->addDays(7), null));
        $this->at($cifDone->created_at->copy()->addDay(), fn () => app(FreightQuoteService::class)->customerAccept($cifDone->fresh(), $this->buyer, $doneQuote));
        $proof($cifDone, $cifDone->created_at->copy()->addDays(2));
        $accept($cifDone, $cifDone->created_at->copy()->addDays(2)->addHours(5), max(0, $cifDone->fresh()->grandTotalInt() - 3000), 3000);
        $this->at($cifDone->created_at->copy()->addDays(3), fn () => $this->sm->transition($cifDone->fresh(), Order::STATUS_PROCESSING, $this->salesAdmin));
        $ship($cifDone, $cifDone->created_at->copy()->addDays(8)->setTime(17, 0), 'MV Kota Bahagia', 'BLW-PKG-2026-0907');
        $this->at($cifDone->created_at->copy()->addDays(12), fn () => $this->sm->transition($cifDone->fresh(), Order::STATUS_DELIVERED, $this->buyer));
        $this->at($cifDone->created_at->copy()->addDays(13), fn () => $this->sm->transition($cifDone->fresh(), Order::STATUS_COMPLETED, $this->buyer));

        // CIF DIBATALKAN: penawaran kedaluwarsa dan order basi dibatalkan oleh job orders:freight-expire.
        $stale = $this->at($now->copy()->subDays(40)->setTime(10, 0), fn () => $this->place([['resiprene-35', 200]], null, null, null, null, 'cif', $cif('tt_advance', $port)));
        $this->at($stale->created_at->copy()->addHours(6), fn () => app(FreightQuoteService::class)->adminPropose($stale->fresh(), $this->salesAdmin, [
            ['label' => 'Ocean freight Belawan - Port Klang', 'amount' => 66000],
        ], $stale->created_at->copy()->addDays(7), null));
        $this->at($stale->created_at->copy()->addDays(8), fn () => app(FreightQuoteService::class)->expireQuotes());
        $this->at($stale->created_at->copy()->addDays(31), fn () => app(FreightQuoteService::class)->cancelStale());
    }

    private function sitiChat(Carbon $now): void
    {
        $chat = app(ChatService::class);
        $conversation = $chat->conversationFor($this->buyer);
        if ($conversation->messages()->exists()) {
            return;
        }
        $start = $now->copy()->subDays(3)->setTime(13, 5);
        $this->at($start, fn () => $chat->send($conversation, $this->buyer, ChatMessage::ROLE_CUSTOMER, 'Hello, what is the lead time for 100 pcs rubber flange packing to Surabaya?', $chat->resolveContext($this->buyer, ['type' => 'product', 'slug' => 'rubber-flange-packing'])));
        $this->at($start->copy()->addMinutes(25), fn () => $chat->send($conversation, $this->salesAdmin, ChatMessage::ROLE_ADMIN, 'Hello Ms. Siti, 100 pcs are in stock; shipping to Surabaya takes 4–7 days with the regular service.'));
        $this->at($now->copy()->subMinutes(40), fn () => $chat->send($conversation, $this->buyer, ChatMessage::ROLE_CUSTOMER, 'Thank you. Could you also send the CoA for the last batch?'));
    }

    // ------------------------------------------------------------------ Chat Budi + tamu

    /** Percakapan Budi ↔ admin (ASUMSI A-73): pesan terakhir customer dibiarkan belum dibaca admin. */
    private function budiChat(Carbon $now): void
    {
        $chat = app(ChatService::class);
        $conversation = $chat->conversationFor($this->buyer);
        if ($conversation->messages()->exists()) {
            return;
        }

        $say = function (Carbon $time, User $sender, string $role, string $body, ?array $context = null) use ($chat, $conversation) {
            $this->at($time, fn () => $chat->send($conversation, $sender, $role, $body, $role === ChatMessage::ROLE_CUSTOMER ? $chat->resolveContext($sender, $context) : null));
        };

        $start = $now->copy()->subDays(2)->setTime(9, 12);
        $say($start, $this->buyer, ChatMessage::ROLE_CUSTOMER, 'Selamat pagi, apakah Resiprene 35 tersedia untuk 2 ton pengiriman bulan depan?', ['type' => 'product', 'slug' => 'resiprene-35']);
        $say($start->copy()->addMinutes(14), $this->admin, ChatMessage::ROLE_ADMIN, 'Selamat pagi, Pak Budi. Stok tersedia, untuk 2 ton bisa kami kirim bertahap mulai minggu pertama. Silakan checkout lewat portal ya.');
        $say($start->copy()->addMinutes(20), $this->buyer, ChatMessage::ROLE_CUSTOMER, 'Baik, terima kasih.');
        if ($this->shippedOrder) {
            $say($now->copy()->subHours(2), $this->buyer, ChatMessage::ROLE_CUSTOMER, 'Pesanan ini sudah sampai mana ya?', ['type' => 'order', 'number' => $this->shippedOrder->number]);
        }
    }

    /** Chat TAMU (belum login) dari tombol melayang situs: pertanyaan eceran, dijawab admin, tamu membalas lagi. */
    private function guestChat(Carbon $now): void
    {
        $chat = app(ChatService::class);
        $conversation = $this->at($now->copy()->subHours(3), fn () => $chat->startGuest([
            'name' => 'Hendra Gunawan', 'email' => 'hendra.gunawan@gmail.com', 'phone' => '+6281377001122',
        ]));
        $this->at($now->copy()->subHours(3), fn () => $chat->send($conversation, null, ChatMessage::ROLE_CUSTOMER, 'Halo, apakah sepatu boots bisa dibeli eceran 5 pasang untuk kebun pribadi?'));
        $this->at($now->copy()->subHours(3)->addMinutes(9), fn () => $chat->send($conversation, $this->salesAdmin, ChatMessage::ROLE_ADMIN, 'Halo Pak Hendra, bisa. Silakan daftar akun di portal, setelah disetujui admin Bapak bisa memesan mulai 1 pasang.'));
        $this->at($now->copy()->subMinutes(25), fn () => $chat->send($conversation, null, ChatMessage::ROLE_CUSTOMER, 'Baik, saya daftar dulu. Apakah ada harga khusus untuk 20 pasang?'));
    }

    // ------------------------------------------------------------------ helper

    /** Ganti konteks customer (dan alamat) untuk place() berikutnya; customer ekspor boleh tanpa alamat (FOB tidak memakainya). */
    private function as(User $customer, ?CustomerAddress $address = null): void
    {
        $this->buyer = $customer;
        $this->address = $address ?? $customer->addresses()->orderByDesc('is_default')->orderBy('id')->first();
    }

    private function trackingNote(Order $order, Carbon $time, string $note): void
    {
        $this->at($time, function () use ($order, $note) {
            $update = $order->trackingUpdates()->create(['note' => $note, 'created_by' => $this->salesAdmin->id]);
            app(OrderNotifier::class)->trackingUpdated($order, $update);
        });
    }

    /** Lampiran dari admin (ASUMSI A-74): PDF placeholder di disk private koleksi order-attachments. */
    private function attachment(Order $order, Carbon $time, string $file, string $label): void
    {
        $this->at($time, function () use ($order, $file, $label) {
            $tmp = tempnam(sys_get_temp_dir(), 'ikn').'.pdf';
            file_put_contents($tmp, MediaSeeder::placeholderPdf($label.' (contoh)'));
            try {
                $media = $this->media->importFromPath($tmp, 'order-attachments', Media::DISK_PRIVATE, $file);
            } finally {
                @unlink($tmp);
            }
            $attachment = $order->attachments()->create(['media_id' => $media->id, 'label' => $label, 'created_by' => $this->salesAdmin->id]);
            app(OrderNotifier::class)->attachmentAdded($order, $attachment->load('media'));
        });
    }

    /** Jalankan closure pada waktu tertentu (semua now() di service mengikuti). */
    private function at(Carbon $time, callable $fn)
    {
        Carbon::setTestNow($time);
        try {
            return $fn();
        } finally {
            Carbon::setTestNow();
        }
    }

    /**
     * @param  array<int, array{0:string,1:int}>  $lines  [slug, qty]; qty 0 dilewati
     * @param  string|null  $rateName  nama tarif (ID), mis. "Ekspres"; null = tarif pertama yang tersedia
     * @param  string  $term  kode cara serah terima; "franco" = diantar (alamat + tarif zona), "loco" = ambil di pabrik, "fob"/"cif" = ekspor
     * @param  array  $extra  field payload tambahan (mis. paymentTermCode, bankAccountId USD untuk order ekspor, destinationPort untuk CIF)
     */
    private function place(array $lines, ?string $note = null, ?string $voucher = null, ?string $rateName = null, ?PaymentMethod $method = null, string $term = 'franco', array $extra = []): Order
    {
        $items = array_values(array_map(fn ($line) => ['productSlug' => $line[0], 'qty' => $line[1]], array_filter($lines, fn ($line) => $line[1] > 0)));
        $rateId = null;
        if ($term === 'franco') {
            if (! $this->address) {
                throw new \RuntimeException('CommerceDemoSeeder: '.$this->buyer->email.' has no address for a Franco order');
            }
            $quote = $this->calculator->quote($this->buyer, $items, $this->address);
            $rates = $quote->availableShippingRates;
            $rate = $rateName ? collect($rates)->first(function ($r) use ($rateName) {
                $name = $r['name'] ?? null;

                return (is_array($name) ? ($name['id'] ?? null) : $name) === $rateName;
            }) : null;
            $rateId = $rate['rateId'] ?? ($rates[0]['rateId'] ?? null);
            if (! $rateId) {
                throw new \RuntimeException('CommerceDemoSeeder: no shipping rate for the demo address of '.$this->buyer->email);
            }
        }
        $method ??= $this->transfer;

        return $this->checkout->place($this->buyer, array_merge([
            'items' => $items,
            'deliveryTermCode' => $term,
            'addressId' => $term === 'franco' ? $this->address->id : null,
            'shippingRateId' => $rateId,
            'paymentMethodCode' => $method->code,
            'bankAccountId' => $method->code === 'manual_transfer' ? $this->bank?->id : null,
            'voucherCode' => $voucher,
            'note' => $note,
        ], $extra), self::KEY_PREFIX.(++$this->sequence));
    }

    /** @param  array{voucher?:string,rate?:string,note?:string,address?:CustomerAddress,term?:string}  $opts */
    private function paidOrder(Carbon $placedAt, array $lines, array $opts = []): Order
    {
        $previousAddress = $this->address;
        if (! empty($opts['address'])) {
            $this->address = $opts['address'];
        }
        $term = $opts['term'] ?? 'franco';
        try {
            $order = $this->at($placedAt, function () use ($lines, $opts, $term) {
                try {
                    return $this->place($lines, $opts['note'] ?? null, $opts['voucher'] ?? null, $opts['rate'] ?? null, null, $term);
                } catch (ApiException | ValidationException $e) {
                    // Voucher tidak berlaku pada tanggal itu → tanpa voucher.
                    return $this->place($lines, $opts['note'] ?? null, null, $opts['rate'] ?? null, null, $term);
                }
            });
        } finally {
            $this->address = $previousAddress;
        }
        $this->at($placedAt->copy()->addHours(2), fn () => $this->payments->attachProof($order, $order->activePayment(), $this->proofMedia('bukti-transfer.pdf'), $this->buyer));
        $this->at($placedAt->copy()->addHours(3), fn () => $this->payments->accept($order->activePayment(), $this->salesAdmin));

        return $order->fresh();
    }

    /** @param  array<int, array{0:string,1:int,2:string,3?:bool}>  $reviews  [slug, rating, body, published=true] */
    private function completedOrder(Carbon $placedAt, array $lines, string $courier, string $tracking, array $reviews = [], array $opts = []): Order
    {
        $order = $this->paidOrder($placedAt, $lines, $opts);
        $this->at($placedAt->copy()->addDay()->setTime(8, 30), fn () => $this->sm->transition($order, Order::STATUS_PROCESSING, $this->salesAdmin));
        $this->at($placedAt->copy()->addDays(2)->setTime(15, 0), fn () => $this->sm->transition($order, Order::STATUS_SHIPPED, $this->salesAdmin, ['courier' => $courier, 'trackingNumber' => $tracking]));
        $this->at($placedAt->copy()->addDays(5)->setTime(11, 0), fn () => $this->sm->transition($order, Order::STATUS_DELIVERED, $this->buyer));
        $this->at($placedAt->copy()->addDays(6)->setTime(9, 0), fn () => $this->sm->transition($order, Order::STATUS_COMPLETED, $this->buyer));

        foreach ($reviews as $review) {
            [$slug, $rating, $body] = $review;
            $published = $review[3] ?? true;
            $product = Product::where('slug', $slug)->first();
            if (! $product) {
                continue;
            }
            $this->at($placedAt->copy()->addDays(6)->setTime(9, 20), fn () => Review::firstOrCreate(
                ['product_id' => $product->id, 'user_id' => $this->buyer->id, 'order_id' => $order->id],
                ['rating' => $rating, 'body' => $body, 'is_published' => $published]
            ));
        }

        return $order->fresh();
    }

    /** Bukti bayar di disk private: PDF placeholder, atau PNG (salinan logo) bila nama berakhiran .png. */
    private function proofMedia(string $name): Media
    {
        if (str_ends_with($name, '.png')) {
            return $this->media->importFromPath(database_path('seeders/assets/rubin-logo.png'), 'payment-proofs', Media::DISK_PRIVATE, $name);
        }
        $tmp = tempnam(sys_get_temp_dir(), 'ikn').'.pdf';
        file_put_contents($tmp, MediaSeeder::placeholderPdf('Bukti transfer (contoh)'));
        try {
            return $this->media->importFromPath($tmp, 'payment-proofs', Media::DISK_PRIVATE, $name);
        } finally {
            @unlink($tmp);
        }
    }
}
