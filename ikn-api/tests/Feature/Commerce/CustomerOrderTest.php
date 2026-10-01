<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderCancelled;
use App\Mail\Commerce\OrderCompleted;
use App\Mail\Commerce\OrderDelivered;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Review;
use App\Models\VoucherUsage;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Order customer (kontrak bagian 9): daftar/detail milik sendiri, cancel, konfirmasi diterima/selesai, ulasan, dashboard.
class CustomerOrderTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_list_and_detail_only_show_own_orders(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 100);
        $mine = $this->placeOrder($product, 1);
        $mine2 = $this->placeOrder($product, 2);

        $other = $this->customer(['email' => 'lain@example.com']);
        $other->addresses()->create($this->addressAttributes());
        $theirs = $this->placeOrder($product, 3, ['addressId' => $other->addresses()->first()->id], null, $other);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.number', $mine2->number)
            ->assertJsonPath('data.0.itemsCount', 1)
            ->assertJsonPath('data.0.items.0.qty', 2)
            ->assertJsonPath('data.0.paymentMethod', 'manual_transfer')
            ->assertJsonPath('data.1.number', $mine->number);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?status=completed')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?status=salah')->assertStatus(422);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$mine->number)->assertOk()->assertJsonPath('data.number', $mine->number);
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$theirs->number)->assertStatus(404)->assertJsonPath('code', 'NOT_FOUND');
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/IKN-00000000-99999')->assertStatus(404);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$theirs->number.'/cancel')->assertStatus(404);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['orders']))->getJson('/api/v1/customer/orders')->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/customer/orders')->assertStatus(401);
    }

    public function test_customer_cancel_releases_stock_and_voucher_only_from_pending_payment(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 1000000], 10);
        $this->makeVoucher(['code' => 'IKN10', 'quota' => 5]);
        $order = $this->placeOrder($product, 6, ['voucherCode' => 'IKN10']);
        $this->assertSame(6, $product->fresh()->reserved_qty);
        $this->assertSame(1, \App\Models\Voucher::where('code', 'IKN10')->value('used_count'));

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/cancel', ['reason' => 'Salah pesan'])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.paymentStatus', 'cancelled')
            ->assertJsonPath('data.cancelReason', 'Salah pesan')
            ->assertJsonPath('data.canCancel', false)
            ->assertJsonPath('data.timeline.1.status', 'cancelled')
            ->assertJsonPath('data.timeline.1.fromStatus', 'pending_payment')
            ->assertJsonPath('data.timeline.1.actorType', 'user')
            ->assertJsonPath('data.timeline.1.actor.id', $this->buyer->id);

        $product->refresh();
        $this->assertSame([10, 0, 10], [$product->stock_qty, $product->reserved_qty, $product->available]);
        $this->assertDatabaseHas('stock_movements', ['idempotency_key' => "order:{$order->id}:release:{$product->id}"]);
        $this->assertDatabaseHas('voucher_usages', ['order_id' => $order->id, 'status' => VoucherUsage::STATUS_RELEASED]);
        $this->assertSame(0, \App\Models\Voucher::where('code', 'IKN10')->value('used_count'));
        $this->assertSame(Payment::STATUS_CANCELLED, $order->payments()->first()->status);
        Mail::assertQueued(OrderCancelled::class, fn ($mail) => $mail->hasTo('buyer@coatingsolutions.co.id') && $mail->reason === 'Salah pesan');

        // Sudah cancelled → 409.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/cancel')
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION')->assertJsonPath('meta.from', 'cancelled')->assertJsonPath('meta.to', 'cancelled');

        // Order yang sudah dibayar tidak bisa dibatalkan customer.
        $paid = $this->payOrder($this->placeOrder($product, 1));
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$paid->number.'/cancel')
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION')->assertJsonPath('meta.from', 'paid');
        $this->assertSame('paid', $paid->fresh()->status);
    }

    public function test_confirm_received_and_complete_follow_the_state_machine(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->payOrder($this->placeOrder($product, 1));
        $admin = $this->superAdmin();
        $sm = app(OrderStateMachine::class);

        // Belum dikirim → 409.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/confirm-received')
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION')->assertJsonPath('meta.from', 'paid')->assertJsonPath('meta.to', 'delivered');

        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'JNE123']);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/confirm-received')
            ->assertOk()
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.canConfirmReceived', false)
            ->assertJsonPath('data.canComplete', true)
            ->assertJsonPath('data.courier', 'JNE')
            ->assertJsonPath('data.trackingNumber', 'JNE123');
        $this->assertNotNull($order->fresh()->delivered_at);
        Mail::assertQueued(OrderDelivered::class);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/complete')
            ->assertOk()
            ->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.canComplete', false)
            ->assertJsonPath('data.canReview', true);
        Mail::assertQueued(OrderCompleted::class);

        // Histori terisi tiap transisi: placed, review, paid, processing, shipped, delivered, completed.
        $this->assertSame(
            ['pending_payment', 'payment_review', 'paid', 'processing', 'shipped', 'delivered', 'completed'],
            $order->fresh()->histories()->pluck('to_status')->all()
        );
        $this->assertSame('paid', $order->fresh()->payment_status);
    }

    public function test_reviews_only_for_completed_orders_one_per_product(): void
    {
        $this->setUpCommerce();
        $a = $this->makeProduct(['slug' => 'produk-a'], 10);
        $b = $this->makeProduct(['slug' => 'produk-b'], 10);
        $order = $this->payOrder(app(\App\Services\Commerce\CheckoutService::class)->place($this->buyer, $this->checkoutPayload($a, 1, [
            'items' => [['productSlug' => 'produk-a', 'qty' => 1], ['productSlug' => 'produk-b', 'qty' => 2]],
        ])));

        $body = [['productSlug' => 'produk-a', 'rating' => 5, 'body' => 'Mantap']];
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/reviews', $body)
            ->assertStatus(409)->assertJsonPath('code', 'INVALID_TRANSITION');

        $sm = app(OrderStateMachine::class);
        $admin = $this->superAdmin();
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'X1']);
        $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer);
        $sm->transition($order, Order::STATUS_COMPLETED, $this->buyer);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/reviews', $body)
            ->assertStatus(201)
            ->assertJsonPath('data.reviews.0.productSlug', 'produk-a')
            ->assertJsonPath('data.reviews.0.rating', 5)
            ->assertJsonPath('data.reviews.0.orderId', $order->id)
            ->assertJsonPath('data.order.canReview', true); // produk-b belum diulas
        $this->assertDatabaseHas('reviews', ['product_id' => $a->id, 'user_id' => $this->buyer->id, 'order_id' => $order->id, 'rating' => 5]);
        $this->assertSame(1, $a->fresh()->review_count);

        // Duplikat dan produk di luar order → 422.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/reviews', [
            ['productSlug' => 'produk-a', 'rating' => 4],
            ['productSlug' => 'tidak-ada', 'rating' => 4],
        ])->assertStatus(422)->assertJsonValidationErrors(['reviews.0.productSlug', 'reviews.1.productSlug']);
        $this->assertSame(1, Review::count());

        // Bentuk { reviews: [...] } juga diterima; setelah semua produk diulas canReview=false.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/reviews', ['reviews' => [['productSlug' => 'produk-b', 'rating' => 3, 'body' => null]]])
            ->assertStatus(201)->assertJsonPath('data.order.canReview', false);
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number)
            ->assertOk()->assertJsonPath('data.canReview', false)->assertJsonPath('data.items.0.reviewed', true)->assertJsonPath('data.items.1.reviewed', true);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$order->number.'/reviews', [['productSlug' => 'produk-a', 'rating' => 9]])
            ->assertStatus(422)->assertJsonValidationErrors(['reviews.0.rating']);
    }

    public function test_customer_dashboard_counts_orders_and_transaction_value(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 100000], 100);
        $pending = $this->placeOrder($product, 1);
        $paid = $this->payOrder($this->placeOrder($product, 2));
        $cancelled = $this->placeOrder($product, 1);
        app(OrderStateMachine::class)->transition($cancelled, Order::STATUS_CANCELLED, $this->buyer);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/dashboard')
            ->assertOk()
            ->assertJsonPath('data.totalOrders', 3)
            ->assertJsonPath('data.awaitingPayment', 1)
            ->assertJsonPath('data.inProgress', 1)
            ->assertJsonPath('data.completed', 0)
            ->assertJsonPath('data.transactionValue', $paid->grandTotalInt())
            ->assertJsonCount(3, 'data.recentOrders')
            ->assertJsonPath('data.recentOrders.0.number', $cancelled->number)
            ->assertJsonPath('data.account.status', 'active')
            ->assertJsonPath('data.account.canOrder', true);
    }

    public function test_dashboard_date_range_does_not_hide_open_orders(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['price' => 100000], 100);
        $oldPending = $this->placeOrder($product, 1);
        $oldPaid = $this->payOrder($this->placeOrder($product, 2));
        // Dua order lama (bulan lalu): dibuat dan dibayar di luar rentang bulan ini.
        $lastMonth = now()->subMonthNoOverflow()->startOfMonth()->addDays(3);
        Order::whereKey([$oldPending->id, $oldPaid->id])->update(['created_at' => $lastMonth]);
        Order::whereKey($oldPaid->id)->update(['paid_at' => $lastMonth]);
        $newPaid = $this->payOrder($this->placeOrder($product, 1));

        $from = now()->startOfMonth()->toDateString();
        $to = now()->toDateString();
        $this->actingAs($this->buyer)->getJson("/api/v1/customer/dashboard?from=$from&to=$to")
            ->assertOk()
            ->assertJsonPath('data.range.from', $from)
            ->assertJsonPath('data.totalOrders', 1)
            ->assertJsonPath('data.transactionValue', $newPaid->grandTotalInt())
            // Sepanjang waktu: order lama yang belum dibayar/masih berjalan tetap terhitung dan tampil.
            ->assertJsonPath('data.awaitingPayment', 1)
            ->assertJsonPath('data.inProgress', 2)
            ->assertJsonPath('data.toReview', 0)
            ->assertJsonCount(3, 'data.actionOrders')
            ->assertJsonPath('data.actionOrders.0.number', $oldPending->number)
            ->assertJsonCount(1, 'data.recentOrders')
            ->assertJsonPath('data.recentOrders.0.number', $newPaid->number)
            ->assertJsonCount(6, 'data.monthly')
            ->assertJsonPath('data.monthly.5.total', $newPaid->grandTotalInt())
            ->assertJsonPath('data.monthly.5.orders', 1)
            ->assertJsonPath('data.monthly.4.total', $oldPaid->grandTotalInt());

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/dashboard?from=2026-02-01&to=2026-01-01')->assertStatus(422);
    }

    public function test_order_list_groups_search_date_range_and_quick_action_flags(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'sarung-egrek', 'name' => ['id' => 'Sarung Egrek', 'en' => 'Harvesting Sickle Cover']], 100);
        $media = $this->makeMedia('egrek.jpg');
        $product->images()->create(['media_id' => $media->id, 'sort_order' => 0]);
        $other = $this->makeProduct(['slug' => 'rubber-ring'], 100);

        $pending = $this->placeOrder($product, 1);
        $done = $this->payOrder($this->placeOrder($other, 1));
        $sm = app(OrderStateMachine::class);
        $admin = $this->superAdmin();
        $sm->transition($done, Order::STATUS_PROCESSING, $admin);
        $sm->transition($done, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'X1']);
        $shipped = $this->payOrder($this->placeOrder($product, 1));
        $sm->transition($shipped, Order::STATUS_PROCESSING, $admin);
        $sm->transition($shipped, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'X2']);
        $sm->transition($done, Order::STATUS_DELIVERED, $this->buyer);
        $sm->transition($done, Order::STATUS_COMPLETED, $this->buyer);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders')
            ->assertOk()->assertJsonCount(3, 'data')
            ->assertJsonPath('meta.groups.unpaid', 1)
            ->assertJsonPath('meta.groups.processing', 0)
            ->assertJsonPath('meta.groups.shipped', 1)
            ->assertJsonPath('meta.groups.completed', 1)
            ->assertJsonPath('meta.groups.cancelled', 0)
            ->assertJsonPath('meta.groups.to_review', 1);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?group=unpaid')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.number', $pending->number)
            ->assertJsonPath('data.0.canCancel', true)
            ->assertJsonPath('data.0.canUploadProof', true)
            ->assertJsonPath('data.0.canReview', false)
            ->assertJsonPath('data.0.items.0.image', $media->url());
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?group=shipped')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.canConfirmReceived', true);
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?group=to_review')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.number', $done->number)->assertJsonPath('data.0.canReview', true);

        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?q=egrek')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?q='.$done->number)->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?from='.now()->addDay()->toDateString())->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?group=bogus')->assertStatus(422);

        // Setelah diulas: keluar dari "perlu diulas", detail memuat ulasannya (rating saja tanpa teks boleh).
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/orders/'.$done->number.'/reviews', [['productSlug' => 'rubber-ring', 'rating' => 4]])
            ->assertStatus(201)->assertJsonPath('data.order.canReview', false);
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders?group=to_review')->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.groups.to_review', 0);
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$done->number)
            ->assertOk()->assertJsonPath('data.items.0.reviewed', true)->assertJsonPath('data.items.0.review.rating', 4)->assertJsonPath('data.items.0.review.body', null);
    }
}
