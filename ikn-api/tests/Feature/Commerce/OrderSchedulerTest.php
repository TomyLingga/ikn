<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderCompleted;
use App\Mail\Commerce\OrderExpired;
use App\Mail\Commerce\OrderPaymentReminder;
use App\Models\Order;
use App\Models\Payment;
use App\Models\StockMovement;
use App\Models\Voucher;
use App\Models\VoucherUsage;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// orders:expire (tiap menit), orders:remind (15 menit), orders:auto-complete (harian): idempoten dan memakai travel time.
class OrderSchedulerTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_expire_releases_stock_and_voucher_once_and_skips_payment_review(): void
    {
        Mail::fake();
        $this->setUpCommerce(['paymentDueHours' => 2]);
        $product = $this->makeProduct([], 10);
        $this->makeVoucher(['code' => 'IKN10', 'quota' => 3]);

        $expiring = $this->placeOrder($product, 2, ['voucherCode' => 'IKN10']);
        $reviewing = $this->placeOrder($product, 3);
        $this->uploadProof($reviewing);
        $this->assertSame(1, Voucher::where('code', 'IKN10')->value('used_count'));
        $this->assertSame(5, $product->fresh()->reserved_qty);

        // Belum lewat batas waktu: tidak ada yang diekspirasi.
        $this->artisan('orders:expire')->assertExitCode(0);
        $this->assertSame('pending_payment', $expiring->fresh()->status);

        Carbon::setTestNow(now()->addHours(3));
        $fresh = $this->placeOrder($product, 1); // dibuat "sekarang" (due 2 jam lagi) → tidak diekspirasi

        $this->artisan('orders:expire')->expectsOutput('1 order(s) expired, 0 skipped.')->assertExitCode(0);
        $this->artisan('orders:expire')->expectsOutput('0 order(s) expired, 0 skipped.')->assertExitCode(0);

        $expiring->refresh();
        $this->assertSame('expired', $expiring->status);
        $this->assertSame('expired', $expiring->payment_status);
        $this->assertNotNull($expiring->expired_at);
        $this->assertSame(Payment::STATUS_EXPIRED, $expiring->payments()->first()->status);
        $this->assertSame('payment_review', $reviewing->fresh()->status); // menunggu admin, tidak di-expire
        $this->assertSame('pending_payment', $fresh->fresh()->status);

        // Stok: 3 (review) + 1 (fresh) masih reserved; 2 dikembalikan tepat sekali.
        $product->refresh();
        $this->assertSame([10, 4, 6], [$product->stock_qty, $product->reserved_qty, $product->available]);
        $this->assertSame(1, StockMovement::where('type', StockMovement::TYPE_RELEASE)->where('reference_id', $expiring->id)->count());
        $this->assertDatabaseHas('voucher_usages', ['order_id' => $expiring->id, 'status' => VoucherUsage::STATUS_RELEASED]);
        $this->assertSame(0, Voucher::where('code', 'IKN10')->value('used_count'));
        $this->assertSame(1, $expiring->histories()->where('to_status', 'expired')->count());
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $expiring->id, 'to_status' => 'expired', 'actor_type' => 'system']);
        $this->assertDatabaseHas('audit_logs', ['subject_type' => 'Order', 'subject_id' => $expiring->id, 'action' => 'order.expired [system]']);
        Mail::assertQueued(OrderExpired::class, 1);

        // Upload bukti setelah kedaluwarsa → 409 ORDER_EXPIRED.
        $this->actingAs($this->buyer)->post('/api/v1/customer/orders/'.$expiring->number.'/proof', ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'ORDER_EXPIRED');

        // Sudah lewat due tetapi scheduler belum jalan → juga ORDER_EXPIRED dan canUploadProof=false.
        Carbon::setTestNow(now()->addHours(3));
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$fresh->number)->assertOk()->assertJsonPath('data.canUploadProof', false);
        $this->actingAs($this->buyer)->post('/api/v1/customer/orders/'.$fresh->number.'/proof', ['file' => $this->proofFile()], ['Accept' => 'application/json'])
            ->assertStatus(409)->assertJsonPath('code', 'ORDER_EXPIRED');
    }

    public function test_remind_sends_once_within_window(): void
    {
        Mail::fake();
        $this->setUpCommerce(['paymentDueHours' => 24, 'reminderHoursBeforeDue' => 2]);
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1);

        $this->artisan('orders:remind')->expectsOutput('0 reminder(s) sent.')->assertExitCode(0);
        Mail::assertNotQueued(OrderPaymentReminder::class);

        Carbon::setTestNow(now()->addHours(22)->addMinutes(30));
        $this->artisan('orders:remind')->expectsOutput('1 reminder(s) sent.')->assertExitCode(0);
        $this->artisan('orders:remind')->expectsOutput('0 reminder(s) sent.')->assertExitCode(0);
        Mail::assertQueued(OrderPaymentReminder::class, 1);
        $this->assertNotNull($order->fresh()->reminder_sent_at);

        // Setting 0 = nonaktif.
        $this->commerceSettings(['reminderHoursBeforeDue' => 0]);
        $this->placeOrder($product, 1);
        $this->artisan('orders:remind')->expectsOutput('Reminder disabled (reminder_hours_before_due = 0).')->assertExitCode(0);
    }

    public function test_auto_complete_after_configured_days(): void
    {
        Mail::fake();
        $this->setUpCommerce(['autoCompleteDays' => 7]);
        $product = $this->makeProduct([], 10);
        $order = $this->payOrder($this->placeOrder($product, 1));
        $admin = $this->superAdmin();
        $sm = app(OrderStateMachine::class);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'A']);
        $sm->transition($order, Order::STATUS_DELIVERED, $admin);

        Carbon::setTestNow(now()->addDays(6));
        $this->artisan('orders:auto-complete')->expectsOutput('0 order(s) auto-completed.')->assertExitCode(0);
        $this->assertSame('delivered', $order->fresh()->status);

        Carbon::setTestNow(now()->addDays(2));
        $this->artisan('orders:auto-complete')->expectsOutput('1 order(s) auto-completed.')->assertExitCode(0);
        $this->artisan('orders:auto-complete')->expectsOutput('0 order(s) auto-completed.')->assertExitCode(0);
        $order->refresh();
        $this->assertSame('completed', $order->status);
        $this->assertNotNull($order->completed_at);
        $this->assertDatabaseHas('order_status_histories', ['order_id' => $order->id, 'to_status' => 'completed', 'actor_type' => 'system']);
        Mail::assertQueued(OrderCompleted::class, 1);
    }
}
