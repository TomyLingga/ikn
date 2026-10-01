<?php

namespace Database\Seeders;

use App\Exceptions\ApiException;
use App\Models\BankAccount;
use App\Models\ChatMessage;
use App\Models\CustomerAddress;
use App\Models\Media;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Review;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Chat\ChatService;
use App\Services\Commerce\CheckoutService;
use App\Services\Commerce\OrderCalculator;
use App\Services\Commerce\OrderNotifier;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Media\MediaService;
use App\Services\Payment\PaymentService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;

/**
 * Order demo untuk buyer@coatingsolutions.co.id di semua status (pending_payment, payment_review, paid, processing,
 * shipped, completed, expired, cancelled), dibuat lewat CheckoutService + PaymentService + OrderStateMachine
 * (bukan insert mentah) agar ledger stok, voucher, payment, histori, dan invoice konsisten.
 * Tanggal mundur beberapa minggu lewat Carbon::setTestNow agar dashboard/laporan/grafik berisi.
 * Idempoten: order demo ditandai orders.idempotency_key "seed:demo:N"; dilewati bila penanda sudah ada
 * (order lain milik customer, mis. hasil uji manual, tidak menghalangi).
 */
class CommerceDemoSeeder extends Seeder
{
    public const KEY_PREFIX = 'seed:demo:';

    private int $sequence = 0;

    private User $buyer;

    private User $admin;

    private CustomerAddress $address;

    private PaymentMethod $method;

    private ?BankAccount $bank = null;

    public function run(CheckoutService $checkout, PaymentService $payments, OrderStateMachine $sm, MediaService $media, OrderCalculator $calculator): void
    {
        $buyer = User::where('email', 'buyer@coatingsolutions.co.id')->first();
        if (! $buyer || $buyer->orders()->where('idempotency_key', 'like', self::KEY_PREFIX.'%')->exists()) {
            return;
        }
        $address = $buyer->addresses()->orderByDesc('is_default')->orderBy('id')->first();
        $method = PaymentMethod::active()->where('code', 'manual_transfer')->first();
        if (! $address || ! $method || ! Product::where('slug', 'resiprene-35')->exists()) {
            return; // prasyarat dari CustomerSeeder/CatalogSeeder/CommerceConfigSeeder belum ada
        }

        $this->buyer = $buyer;
        $this->address = $address;
        $this->method = $method;
        $this->bank = BankAccount::active()->orderBy('sort_order')->orderBy('id')->first();
        $this->admin = User::where('email', config('ikn.seed.super_admin_email'))->first() ?? User::admins()->orderBy('id')->firstOrFail();

        // Email demo tidak perlu dikirim/di-log saat seeding.
        Mail::fake();

        $now = now();
        try {
            // 1–3. Selesai (bulan-bulan lalu) → grafik penjualan + laporan.
            $this->completedOrder($checkout, $payments, $sm, $media, $calculator, $now->copy()->subDays(45)->setTime(10, 15), [['resiprene-35', 50]], 'JNE Trucking', 'JNT4501122334', [
                ['resiprene-35', 5, 'Kualitas konsisten, kelarutan sangat baik untuk formulasi cat marine kami.'],
            ]);
            $this->completedOrder($checkout, $payments, $sm, $media, $calculator, $now->copy()->subDays(30)->setTime(14, 40), [['sepatu-boots', 20], ['sarung-egrek', 30]], 'SiCepat Cargo', 'SC0009988776', [
                ['sepatu-boots', 4, 'Boots nyaman dipakai seharian di kebun, sol anti-slip bekerja baik.'],
            ]);
            $this->completedOrder($checkout, $payments, $sm, $media, $calculator, $now->copy()->subDays(18)->setTime(9, 5), [['rubber-ring', 100]], 'JNE Reguler', 'JNE1122334455');

            // 4. Dikirim (6 hari lalu).
            $shipped = $this->paidOrder($checkout, $payments, $media, $calculator, $now->copy()->subDays(6)->setTime(11, 20), [['resiprene-35', 30], ['acting-rubber', 2]]);
            $this->at($shipped->created_at->copy()->addDay()->setTime(8, 30), fn () => $sm->transition($shipped, Order::STATUS_PROCESSING, $this->admin, ['note' => 'Disiapkan gudang Medan']));
            $this->at($shipped->created_at->copy()->addDays(2)->setTime(15, 0), fn () => $sm->transition($shipped, Order::STATUS_SHIPPED, $this->admin, ['courier' => 'JNE Trucking', 'trackingNumber' => 'JNT2026093001']));
            // Catatan perjalanan kiriman dari admin (ASUMSI A-70).
            $this->trackingNote($shipped, $shipped->created_at->copy()->addDays(3)->setTime(9, 10), 'Pesanan berangkat dari gudang Medan');
            $this->trackingNote($shipped, $shipped->created_at->copy()->addDays(4)->setTime(17, 45), 'Pesanan tiba di gudang transit Pekanbaru, Riau');

            // 5. Diproses (1 hari lalu).
            $processing = $this->paidOrder($checkout, $payments, $media, $calculator, $now->copy()->subDay()->setTime(10, 0), [['rubber-ring', 50]]);
            $this->at($processing->created_at->copy()->addHours(5), fn () => $sm->transition($processing, Order::STATUS_PROCESSING, $this->admin));

            // 6. Dibayar, belum diproses (2 hari lalu).
            $this->paidOrder($checkout, $payments, $media, $calculator, $now->copy()->subDays(2)->setTime(16, 45), [['packing-pintu-rebusan', 1]]);

            // 7. Kedaluwarsa (dibuat 4 hari lalu, tidak dibayar).
            $expired = $this->at($now->copy()->subDays(4)->setTime(13, 10), fn () => $this->place($checkout, $calculator, [['sepatu-boots', 10]]));
            $this->at($expired->created_at->copy()->addHours(25), fn () => $payments->expire($expired));

            // 8. Dibatalkan customer (3 hari lalu).
            $cancelled = $this->at($now->copy()->subDays(3)->setTime(9, 30), fn () => $this->place($checkout, $calculator, [['sarung-egrek', 5]]));
            $this->at($cancelled->created_at->copy()->addMinutes(40), fn () => $sm->transition($cancelled, Order::STATUS_CANCELLED, $this->buyer, ['reason' => 'Salah memilih jumlah, akan pesan ulang.']));

            // 9. Menunggu verifikasi (bukti diunggah 20 jam lalu).
            $review = $this->at($now->copy()->subHours(20), fn () => $this->place($checkout, $calculator, [['resiprene-35', 25]], 'Mohon sertakan CoA per batch.'));
            $this->at($review->created_at->copy()->addMinutes(35), fn () => $payments->attachProof($review, $review->activePayment(), $this->proofMedia($media), $this->buyer));

            // 10. Menunggu pembayaran (baru saja, dengan voucher bila berlaku).
            $this->at($now->copy()->subMinutes(15), function () use ($checkout, $calculator) {
                try {
                    return $this->place($checkout, $calculator, [['resiprene-35', 30]], 'Kirim jam kerja (08.00–16.00).', 'IKN10');
                } catch (ApiException $e) {
                    return $this->place($checkout, $calculator, [['resiprene-35', 30]], 'Kirim jam kerja (08.00–16.00).');
                }
            });

            $this->demoChat($shipped, $now);

            // Lonceng portal: notifikasi lama dianggap sudah dibaca, yang tiga hari terakhir dibiarkan baru.
            UserNotification::where('user_id', $this->buyer->id)->where('created_at', '<', $now->copy()->subDays(3))
                ->update(['read_at' => $now]);
        } finally {
            Carbon::setTestNow();
        }
    }

    private function trackingNote(Order $order, Carbon $time, string $note): void
    {
        $this->at($time, function () use ($order, $note) {
            $update = $order->trackingUpdates()->create(['note' => $note, 'created_by' => $this->admin->id]);
            app(OrderNotifier::class)->trackingUpdated($order, $update);
        });
    }

    /** Percakapan contoh customer ↔ admin (ASUMSI A-73): satu pesan customer terakhir dibiarkan belum dibaca admin. */
    private function demoChat(Order $shipped, Carbon $now): void
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
        $say($now->copy()->subHours(2), $this->buyer, ChatMessage::ROLE_CUSTOMER, 'Pesanan ini sudah sampai mana ya?', ['type' => 'order', 'number' => $shipped->number]);
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

    /** @param  array<int, array{0:string,1:int}>  $lines  [slug, qty] */
    private function place(CheckoutService $checkout, OrderCalculator $calculator, array $lines, ?string $note = null, ?string $voucher = null): Order
    {
        $items = array_map(fn ($line) => ['productSlug' => $line[0], 'qty' => $line[1]], $lines);
        $quote = $calculator->quote($this->buyer, $items, $this->address);
        $rateId = $quote->availableShippingRates[0]['rateId'] ?? null;
        if (! $rateId) {
            throw new \RuntimeException('CommerceDemoSeeder: no shipping rate for the demo address.');
        }

        return $checkout->place($this->buyer, [
            'items' => $items,
            'addressId' => $this->address->id,
            'shippingRateId' => $rateId,
            'paymentMethodCode' => $this->method->code,
            'bankAccountId' => $this->bank?->id,
            'voucherCode' => $voucher,
            'note' => $note,
        ], self::KEY_PREFIX.(++$this->sequence));
    }

    private function paidOrder(CheckoutService $checkout, PaymentService $payments, MediaService $media, OrderCalculator $calculator, Carbon $placedAt, array $lines): Order
    {
        $order = $this->at($placedAt, fn () => $this->place($checkout, $calculator, $lines));
        $this->at($placedAt->copy()->addHours(2), fn () => $payments->attachProof($order, $order->activePayment(), $this->proofMedia($media), $this->buyer));
        $this->at($placedAt->copy()->addHours(3), fn () => $payments->accept($order->activePayment(), $this->admin));

        return $order->fresh();
    }

    private function completedOrder(CheckoutService $checkout, PaymentService $payments, OrderStateMachine $sm, MediaService $media, OrderCalculator $calculator, Carbon $placedAt, array $lines, string $courier, string $tracking, array $reviews = []): Order
    {
        $order = $this->paidOrder($checkout, $payments, $media, $calculator, $placedAt, $lines);
        $this->at($placedAt->copy()->addDay()->setTime(8, 30), fn () => $sm->transition($order, Order::STATUS_PROCESSING, $this->admin));
        $this->at($placedAt->copy()->addDays(2)->setTime(15, 0), fn () => $sm->transition($order, Order::STATUS_SHIPPED, $this->admin, ['courier' => $courier, 'trackingNumber' => $tracking]));
        $this->at($placedAt->copy()->addDays(5)->setTime(11, 0), fn () => $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer));
        $this->at($placedAt->copy()->addDays(6)->setTime(9, 0), fn () => $sm->transition($order, Order::STATUS_COMPLETED, $this->buyer));

        foreach ($reviews as [$slug, $rating, $body]) {
            $product = Product::where('slug', $slug)->first();
            if (! $product) {
                continue;
            }
            $this->at($placedAt->copy()->addDays(6)->setTime(9, 20), fn () => Review::firstOrCreate(
                ['product_id' => $product->id, 'user_id' => $this->buyer->id, 'order_id' => $order->id],
                ['rating' => $rating, 'body' => $body, 'is_published' => true]
            ));
        }

        return $order->fresh();
    }

    /** PDF placeholder kecil sebagai bukti transfer di disk private. */
    private function proofMedia(MediaService $media): Media
    {
        $tmp = tempnam(sys_get_temp_dir(), 'ikn').'.pdf';
        file_put_contents($tmp, MediaSeeder::placeholderPdf('Bukti transfer (contoh)'));
        try {
            return $media->importFromPath($tmp, 'payment-proofs', Media::DISK_PRIVATE, 'bukti-transfer.pdf');
        } finally {
            @unlink($tmp);
        }
    }
}
