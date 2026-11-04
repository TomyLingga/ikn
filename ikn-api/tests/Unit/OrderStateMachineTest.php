<?php

namespace Tests\Unit;

use App\Exceptions\ApiException;
use App\Mail\Commerce\OrderPlaced;
use App\Mail\Commerce\PaymentAccepted;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Tabel transisi arsitektur 7.1: transisi sah/tidak sah, efek samping, histori, invarian payment_status.
class OrderStateMachineTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_transition_table_matches_architecture(): void
    {
        $expected = [
            null => ['awaiting_freight', 'pending_payment'],
            'awaiting_freight' => ['pending_payment', 'cancelled'], // CIF (ASUMSI A-89)
            'pending_payment' => ['payment_review', 'expired', 'cancelled'],
            'payment_review' => ['paid', 'pending_payment', 'cancelled'],
            'paid' => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped' => ['delivered'],
            'delivered' => ['completed'],
            'completed' => [],
            'cancelled' => [],
            'expired' => [],
        ];

        foreach ($expected as $from => $targets) {
            foreach (Order::STATUSES as $to) {
                $this->assertSame(
                    in_array($to, $targets, true),
                    OrderStateMachine::canTransition($from === '' ? null : $from, $to),
                    sprintf('%s → %s', $from ?: '∅', $to)
                );
            }
        }
        $this->assertTrue(OrderStateMachine::canTransition(null, 'pending_payment'));
        $this->assertTrue(OrderStateMachine::canTransition(null, 'awaiting_freight'));
        $this->assertFalse(OrderStateMachine::canTransition('awaiting_freight', 'expired'));
        $this->assertFalse(OrderStateMachine::canTransition('pending_payment', 'awaiting_freight'));
        $this->assertFalse(OrderStateMachine::canTransition(null, 'paid'));
    }

    public function test_invalid_transition_throws_409_without_side_effects_or_history(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 2);
        $sm = app(OrderStateMachine::class);
        Mail::assertQueued(OrderPlaced::class, 1);

        foreach (['paid', 'processing', 'shipped', 'delivered', 'completed'] as $to) {
            try {
                $sm->transition($order, $to, $this->buyer);
                $this->fail("expected INVALID_TRANSITION for $to");
            } catch (ApiException $e) {
                $this->assertSame(409, $e->status);
                $this->assertSame('INVALID_TRANSITION', $e->errorCode);
                $this->assertSame(['from' => 'pending_payment', 'to' => $to], $e->meta);
            }
        }
        $this->assertSame('pending_payment', $order->fresh()->status);
        $this->assertSame(1, $order->histories()->count());
        $this->assertSame(2, $product->fresh()->reserved_qty);
        Mail::assertNotQueued(PaymentAccepted::class);

        $this->expectException(\InvalidArgumentException::class);
        $sm->transition($order, 'packing', $this->buyer);
    }

    public function test_shipped_requires_courier_and_tracking_and_records_meta(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->payOrder($this->placeOrder($product, 1));
        $admin = $this->superAdmin();
        $sm = app(OrderStateMachine::class);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);

        try {
            $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE']);
            $this->fail('expected validation error');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('trackingNumber', $e->errors());
        }
        $this->assertSame('processing', $order->fresh()->status);

        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'JNE-1']);
        $order->refresh();
        $this->assertSame('shipped', $order->status);
        $this->assertSame('JNE', $order->courier);
        $this->assertSame('JNE-1', $order->tracking_number);
        $history = $order->histories()->where('to_status', 'shipped')->first();
        $this->assertSame(['courier' => 'JNE', 'trackingNumber' => 'JNE-1'], $history->meta);
        $this->assertSame(OrderStatusHistory::ACTOR_USER, $history->actor_type);
        $this->assertSame($admin->id, $history->actor_id);
    }

    /** Loco (ASUMSI A-85): shipped tanpa kurir/resi = siap diambil, delivered = sudah diambil; Franco tetap wajib kurir. */
    public function test_pickup_order_ships_without_courier_and_records_pickup_notes(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $admin = $this->superAdmin();
        $sm = app(OrderStateMachine::class);

        $pickup = $this->payOrder($this->placeOrder($product, 1, ['deliveryTermCode' => 'loco', 'addressId' => null, 'shippingRateId' => null]));
        $this->assertTrue($pickup->isPickup());
        $sm->transition($pickup, Order::STATUS_PROCESSING, $admin);
        $sm->transition($pickup, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE']); // kurir yang terkirim diabaikan
        $pickup->refresh();
        $this->assertSame('shipped', $pickup->status);
        $this->assertNull($pickup->courier);
        $this->assertNull($pickup->tracking_number);
        $this->assertNotNull($pickup->shipped_at);
        $this->assertFalse($pickup->canAddTracking());
        $history = $pickup->histories()->where('to_status', 'shipped')->first();
        $this->assertSame('Pesanan siap diambil di Pabrik Tanjung Morawa.', $history->note);
        $this->assertNull($history->meta);

        $sm->transition($pickup, Order::STATUS_DELIVERED, $this->buyer);
        $this->assertSame('Pesanan sudah diambil.', $pickup->histories()->where('to_status', 'delivered')->value('note'));

        $franco = $this->payOrder($this->placeOrder($product, 1));
        $sm->transition($franco, Order::STATUS_PROCESSING, $admin);
        try {
            $sm->transition($franco, Order::STATUS_SHIPPED, $admin);
            $this->fail('expected validation error');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('courier', $e->errors());
        }
        $this->assertSame('processing', $franco->fresh()->status);
    }

    public function test_payment_status_always_mirrors_latest_payment(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1);
        $this->assertSame('pending', $order->payment_status);

        $payment = $this->uploadProof($order);
        $this->assertSame('awaiting_verification', $order->fresh()->payment_status);

        app(\App\Services\Payment\PaymentService::class)->reject($payment, $this->superAdmin(), 'blur');
        $this->assertSame('rejected', $order->fresh()->payment_status);

        $second = $this->uploadProof($order);
        $this->assertSame('awaiting_verification', $order->fresh()->payment_status);
        $this->assertNotSame($payment->id, $second->id);

        app(OrderStateMachine::class)->transition($order->fresh(), Order::STATUS_CANCELLED, $this->superAdmin(), ['reason' => 'admin']);
        $order->refresh();
        $this->assertSame('cancelled', $order->payment_status);
        $this->assertSame(Payment::STATUS_CANCELLED, $second->fresh()->status);
        $this->assertSame(Payment::STATUS_REJECTED, $payment->fresh()->status); // histori penolakan tersimpan
        $this->assertSame(0, $product->fresh()->reserved_qty);
    }

    public function test_release_twice_via_expire_then_cancel_is_impossible_and_idempotent(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 3);
        $sm = app(OrderStateMachine::class);

        $sm->transition($order, Order::STATUS_EXPIRED, null);
        $this->assertSame(10, $product->fresh()->available);

        try {
            $sm->transition($order, Order::STATUS_CANCELLED, null);
            $this->fail('expected 409');
        } catch (ApiException $e) {
            $this->assertSame('INVALID_TRANSITION', $e->errorCode);
        }
        $this->assertSame(1, \App\Models\StockMovement::where('type', 'release')->count());
        $this->assertSame(10, $product->fresh()->available);
    }
}
