<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderCancelled;
use App\Mail\Commerce\OrderShipped;
use App\Models\Order;
use App\Models\Payment;
use App\Models\StockMovement;
use App\Models\VoucherUsage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Admin order (kontrak 11.2): daftar + filter, detail, status (shipped wajib resi), cancel (release/adjust), due, audit.
class AdminOrderTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_index_filters_by_status_query_and_date_and_requires_orders_module(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 100);
        $pending = $this->placeOrder($product, 1);
        $paid = $this->payOrder($this->placeOrder($product, 1));

        $other = $this->customer(['email' => 'lain@example.com', 'name' => 'Rina']);
        $other->profile()->create(['company' => 'PT Lain Jaya']);
        $other->addresses()->create($this->addressAttributes());
        $theirs = $this->placeOrder($product, 1, ['addressId' => $other->addresses()->first()->id], null, $other);

        $admin = $this->adminWith(['orders']);

        $this->actingAs($admin)->getJson('/api/v1/admin/orders')
            ->assertOk()->assertJsonCount(3, 'data')->assertJsonPath('meta.total', 3)
            ->assertJsonStructure(['data' => [['number', 'status', 'paymentStatus', 'customer' => ['name', 'company', 'email'], 'grandTotal', 'paymentDueAt', 'itemsCount']]]);
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?status=paid')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.number', $paid->number)
            ->assertJsonPath('meta.counts.paid', 1)->assertJsonPath('meta.counts.pending_payment', 2)->assertJsonPath('meta.counts.completed', 0); // angka tab sepanjang waktu
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?status=all&perPage=2')->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.lastPage', 2);
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?q=lain+jaya')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.number', $theirs->number);
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?q='.$pending->number)->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?q=coatingsolutions')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?from='.now()->addDay()->toDateString())->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?to='.now()->toDateString())->assertOk()->assertJsonCount(3, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?status=bogus')->assertStatus(422);

        $this->actingAs($admin)->getJson('/api/v1/admin/orders/'.$paid->number)
            ->assertOk()->assertJsonPath('data.status', 'paid')->assertJsonCount(1, 'data.payments')->assertJsonPath('data.payments.0.status', 'paid')
            ->assertJsonPath('data.payments.0.verifiedBy.id', $paid->payments()->first()->verified_by);
        $this->assertNotNull($paid->invoice_number);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['payments']))->getJson('/api/v1/admin/orders')->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->getJson('/api/v1/admin/orders')->assertStatus(403);
    }

    public function test_status_transitions_with_shipping_validation_and_audit_log(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->payOrder($this->placeOrder($product, 1));
        $admin = $this->adminWith(['orders']);
        $url = '/api/v1/admin/orders/'.$order->number.'/status';

        // Lompat langsung ke shipped dari paid → 409.
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped', 'courier' => 'JNE', 'trackingNumber' => 'X'])
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION')->assertJsonPath('meta.from', 'paid')->assertJsonPath('meta.to', 'shipped');

        $this->actingAs($admin)->postJson($url, ['status' => 'processing', 'note' => 'Dikemas gudang A'])
            ->assertOk()->assertJsonPath('data.status', 'processing')->assertJsonPath('data.timeline.3.note', 'Dikemas gudang A');
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_type' => 'Order', 'subject_id' => $order->id, 'action' => 'POST api/v1/admin/orders/{order}/status']);

        // shipped tanpa resi → 422.
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped', 'courier' => 'JNE'])
            ->assertStatus(422)->assertJsonValidationErrors(['trackingNumber']);
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped'])
            ->assertStatus(422)->assertJsonValidationErrors(['courier', 'trackingNumber']);
        $this->assertSame('processing', $order->fresh()->status);
        Mail::assertNotQueued(OrderShipped::class);

        $this->actingAs($admin)->postJson($url, ['status' => 'shipped', 'courier' => 'JNE', 'trackingNumber' => 'JNE0012345'])
            ->assertOk()
            ->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.courier', 'JNE')
            ->assertJsonPath('data.trackingNumber', 'JNE0012345')
            ->assertJsonPath('data.timeline.4.meta.courier', 'JNE')
            ->assertJsonPath('data.timeline.4.meta.trackingNumber', 'JNE0012345');
        Mail::assertQueued(OrderShipped::class, fn ($mail) => $mail->hasTo('buyer@coatingsolutions.co.id'));

        $this->actingAs($admin)->postJson($url, ['status' => 'delivered'])->assertOk()->assertJsonPath('data.status', 'delivered');
        $this->actingAs($admin)->postJson($url, ['status' => 'completed'])->assertOk()->assertJsonPath('data.status', 'completed');
        $this->actingAs($admin)->postJson($url, ['status' => 'processing'])->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION');
        $this->actingAs($admin)->postJson($url, ['status' => 'paid'])->assertStatus(422)->assertJsonValidationErrors(['status']);
    }

    public function test_admin_cancel_after_paid_returns_stock_via_adjust_and_before_paid_via_release(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $admin = $this->adminWith(['orders']);

        // Sebelum bayar (payment_review): release.
        $review = $this->placeOrder($product, 2);
        $this->uploadProof($review);
        $this->assertSame('payment_review', $review->fresh()->status);
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$review->number.'/cancel', [])->assertStatus(422)->assertJsonValidationErrors(['reason']);
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$review->number.'/cancel', ['reason' => 'Stok rusak'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.paymentStatus', 'cancelled');
        $this->assertDatabaseHas('stock_movements', ['idempotency_key' => "order:{$review->id}:release:{$product->id}"]);
        $this->assertSame([10, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);

        // Setelah paid: adjust + (bukan release), voucher tetap committed.
        $this->makeVoucher(['code' => 'IKN10']);
        $paid = $this->payOrder($this->placeOrder($product, 3, ['voucherCode' => 'IKN10']));
        $this->assertSame([7, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$paid->number.'/cancel', ['reason' => 'Refund manual'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.cancelReason', 'Refund manual');
        $this->assertDatabaseHas('stock_movements', ['idempotency_key' => "order:{$paid->id}:cancel-return:{$product->id}", 'type' => StockMovement::TYPE_ADJUST, 'qty' => 3]);
        $this->assertDatabaseMissing('stock_movements', ['idempotency_key' => "order:{$paid->id}:release:{$product->id}"]);
        $this->assertSame([10, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);
        $this->assertDatabaseHas('voucher_usages', ['order_id' => $paid->id, 'status' => VoucherUsage::STATUS_COMMITTED]);
        Mail::assertQueued(OrderCancelled::class, fn ($mail) => $mail->order->id === $paid->id && $mail->wasPaid === true);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_id' => $paid->id, 'action' => 'POST api/v1/admin/orders/{order}/cancel']);

        // Ledger konsisten setelah rebuild.
        app(\App\Services\Stock\StockLedger::class)->rebuild();
        $this->assertSame([10, 0], [$product->fresh()->stock_qty, $product->fresh()->reserved_qty]);

        // Sudah dikirim → tidak bisa dibatalkan.
        $shipped = $this->payOrder($this->placeOrder($product, 1));
        $sm = app(\App\Services\Commerce\OrderStateMachine::class);
        $sm->transition($shipped, Order::STATUS_PROCESSING, $admin);
        $sm->transition($shipped, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => '1']);
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$shipped->number.'/cancel', ['reason' => 'x'])
            ->assertStatus(409)->assertJsonPath('meta.from', 'shipped');
    }

    public function test_update_due_extends_deadline_and_active_payment_expiry(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1);
        $admin = $this->adminWith(['orders']);
        $url = '/api/v1/admin/orders/'.$order->number.'/due';
        $originalDue = $order->payment_due_at;

        $this->actingAs($admin)->putJson($url, [])->assertStatus(422)->assertJsonValidationErrors(['paymentDueAt', 'extendHours']);
        $this->actingAs($admin)->putJson($url, ['paymentDueAt' => now()->subHour()->toIso8601String()])->assertStatus(422)->assertJsonValidationErrors(['paymentDueAt']);

        $response = $this->actingAs($admin)->putJson($url, ['extendHours' => 24])->assertOk();
        $newDue = $order->fresh()->payment_due_at;
        $this->assertTrue($newDue->equalTo($originalDue->copy()->addHours(24)));
        $this->assertSame($newDue->toApiString(), $response->json('data.paymentDueAt'));
        $this->assertTrue($order->payments()->first()->fresh()->expires_at->equalTo($newDue));

        $explicit = now()->addDays(3)->startOfHour();
        $this->actingAs($admin)->putJson($url, ['paymentDueAt' => $explicit->toIso8601String()])->assertOk()
            ->assertJsonPath('data.paymentDueAt', $explicit->toApiString());
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_id' => $order->id, 'action' => 'PUT api/v1/admin/orders/{order}/due']);

        // Sudah paid → 409.
        $paid = $this->payOrder($this->placeOrder($product, 1));
        $this->actingAs($admin)->putJson('/api/v1/admin/orders/'.$paid->number.'/due', ['extendHours' => 1])
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION');
    }

    public function test_admin_customer_detail_lists_recent_orders(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 100);
        $orders = [];
        for ($i = 0; $i < 12; $i++) {
            $orders[] = $this->placeOrder($product, 1);
        }

        $this->actingAs($this->adminWith(['customers']))->getJson('/api/v1/admin/customers/'.$this->buyer->id)
            ->assertOk()
            ->assertJsonPath('data.ordersCount', 12)
            ->assertJsonCount(10, 'data.orders')
            ->assertJsonPath('data.orders.0.number', end($orders)->number)
            ->assertJsonPath('data.orders.0.status', 'pending_payment')
            ->assertJsonPath('data.orders.0.itemsCount', 1)
            ->assertJsonPath('data.orders.0.grandTotal', end($orders)->grandTotalInt());
    }
}
