<?php

namespace Tests\Feature\Commerce;

use App\Models\Order;
use App\Models\OrderTrackingUpdate;
use App\Models\UserNotification;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Catatan perjalanan kiriman (ASUMSI A-70): hanya selama shipped, tampil di detail order customer, memicu notifikasi.
class OrderTrackingTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private function shippedOrder(): Order
    {
        $this->setUpCommerce();
        $order = $this->payOrder($this->placeOrder($this->makeProduct([], 10), 1));
        $sm = app(OrderStateMachine::class);
        $admin = $this->superAdmin();
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'JNE123']);

        return $order->fresh();
    }

    public function test_admin_adds_tracking_notes_while_shipped_and_customer_sees_them(): void
    {
        Mail::fake();
        $order = $this->shippedOrder();
        $admin = $this->adminWith(['orders'], ['name' => 'Admin Gudang']);
        $url = '/api/v1/admin/orders/'.$order->number.'/tracking';

        $this->actingAs($admin)->postJson($url, ['note' => '  Pesanan tiba di   Provinsi Sumatera Utara '])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.canAddTracking', true)
            ->assertJsonCount(1, 'data.trackingUpdates')
            ->assertJsonPath('data.trackingUpdates.0.note', 'Pesanan tiba di Provinsi Sumatera Utara')
            ->assertJsonPath('data.trackingUpdates.0.actor.name', 'Admin Gudang');
        $this->actingAs($admin)->postJson($url, ['note' => 'Pesanan tiba di Provinsi Riau'])
            ->assertStatus(201)->assertJsonCount(2, 'data.trackingUpdates')
            ->assertJsonPath('data.trackingUpdates.1.note', 'Pesanan tiba di Provinsi Riau');

        $this->actingAs($admin)->postJson($url, ['note' => ''])->assertStatus(422)->assertJsonValidationErrors(['note']);
        $this->actingAs($admin)->postJson($url, ['note' => str_repeat('a', 201)])->assertStatus(422);

        // Status order tidak berubah dan histori transisi tidak bertambah.
        $this->assertSame('shipped', $order->fresh()->status);
        $this->assertSame(5, $order->histories()->count());

        // Customer melihat catatan di detail pesanan dan mendapat notifikasi per catatan.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->getJson('/api/v1/customer/orders/'.$order->number)
            ->assertOk()->assertJsonCount(2, 'data.trackingUpdates')
            ->assertJsonPath('data.trackingUpdates.0.note', 'Pesanan tiba di Provinsi Sumatera Utara');
        $this->assertSame(2, UserNotification::where('user_id', $this->buyer->id)->where('type', 'order.tracking')->count());
        $notification = UserNotification::where('type', 'order.tracking')->orderBy('id')->first();
        $this->assertSame('/dashboard/pesanan/'.$order->number, $notification->url);
        $this->assertStringContainsString('Sumatera Utara', $notification->body['id']);
    }

    public function test_tracking_is_rejected_outside_shipped_and_requires_orders_module(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $order = $this->payOrder($this->placeOrder($this->makeProduct([], 10), 1));
        $admin = $this->adminWith(['orders']);
        $url = '/api/v1/admin/orders/'.$order->number.'/tracking';

        $this->actingAs($admin)->postJson($url, ['note' => 'Belum dikirim'])
            ->assertStatus(409)->assertJsonPath('code', 'TRACKING_NOT_ALLOWED')->assertJsonPath('meta.status', 'paid');

        $sm = app(OrderStateMachine::class);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'X1']);
        $this->actingAs($admin)->postJson($url, ['note' => 'Tiba di Pekanbaru'])->assertStatus(201);
        $update = OrderTrackingUpdate::first();

        // Hapus catatan salah ketik selama masih shipped.
        $this->actingAs($admin)->deleteJson($url.'/'.$update->id)->assertOk()->assertJsonCount(0, 'data.trackingUpdates');
        $this->actingAs($admin)->deleteJson($url.'/'.$update->id)->assertStatus(404);

        $this->actingAs($admin)->postJson($url, ['note' => 'Tiba di Dumai'])->assertStatus(201);
        $kept = OrderTrackingUpdate::first();
        $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer);

        // Setelah diterima catatan terkunci, tetapi tetap tampil.
        $this->actingAs($admin)->postJson($url, ['note' => 'Terlambat'])->assertStatus(409)->assertJsonPath('code', 'TRACKING_NOT_ALLOWED');
        $this->actingAs($admin)->deleteJson($url.'/'.$kept->id)->assertStatus(409);
        $this->actingAs($admin)->getJson('/api/v1/admin/orders/'.$order->number)
            ->assertOk()->assertJsonCount(1, 'data.trackingUpdates')->assertJsonPath('data.canAddTracking', false);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['payments']))->postJson($url, ['note' => 'Tanpa modul'])->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->postJson($url, ['note' => 'Customer'])->assertStatus(403);
    }
}
