<?php

namespace Tests\Feature\Messaging;

use App\Models\Order;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Commerce\CheckoutService;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Notification\InAppNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Lonceng panel admin: baris user_notifications per admin aktif bermodul terkait (InAppNotifier::admins),
// endpoint daftar/tandai dibaca di /admin/notifications*, dan penghitung di GET /admin/badges.
class AdminNotificationTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    /** @return string[] tipe notifikasi milik user, urut pembuatan */
    private function typesFor(User $user): array
    {
        return UserNotification::where('user_id', $user->id)->orderBy('id')->pluck('type')->all();
    }

    public function test_new_order_and_payment_proof_notify_only_active_admins_with_the_module(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $super = $this->superAdmin();
        $ordersAdmin = $this->adminWith(['orders']);
        $paymentsAdmin = $this->adminWith(['payments']);
        $inactive = $this->adminWith(['orders', 'payments'], ['status' => User::STATUS_INACTIVE]);

        $order = $this->placeOrder($this->makeProduct([], 10), 1);

        $this->assertSame(['admin.order_placed'], $this->typesFor($super));
        $this->assertSame(['admin.order_placed'], $this->typesFor($ordersAdmin));
        $this->assertSame([], $this->typesFor($paymentsAdmin));
        $this->assertSame([], $this->typesFor($inactive));

        $placed = UserNotification::where('user_id', $ordersAdmin->id)->firstOrFail();
        $this->assertSame('Pesanan baru', $placed->title['id']);
        $this->assertSame('New order', $placed->title['en']);
        $this->assertStringContainsString($order->number, $placed->body['id']);
        $this->assertStringContainsString('Coating Solutions Co.', $placed->body['en']);
        $this->assertSame('/admin/orders/'.$order->number, $placed->url);
        $this->assertSame($order->number, $placed->data['orderNumber']);
        $this->assertNull($placed->read_at);

        // Bukti bayar: modul payments (bukan orders), tautan ke daftar pembayaran.
        $this->uploadProof($order);
        $this->assertSame(['admin.order_placed', 'admin.payment_proof'], $this->typesFor($super));
        $this->assertSame(['admin.order_placed'], $this->typesFor($ordersAdmin));
        $this->assertSame(['admin.payment_proof'], $this->typesFor($paymentsAdmin));
        $this->assertSame([], $this->typesFor($inactive));
        $this->assertSame('/admin/payments', UserNotification::where('user_id', $paymentsAdmin->id)->firstOrFail()->url);

        // Customer tetap hanya menerima notifikasinya sendiri.
        $this->assertSame(['order.placed'], $this->typesFor($this->buyer));
    }

    public function test_customer_actions_reach_admins_while_admin_and_system_actions_do_not(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $admin = $this->adminWith(['orders']);
        $sm = app(OrderStateMachine::class);
        $product = $this->makeProduct([], 50);

        // Customer mengonfirmasi diterima lalu menyelesaikan pesanan.
        $order = $this->payOrder($this->placeOrder($product, 1), $admin);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'JNE123']);
        $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer);
        $sm->transition($order, Order::STATUS_COMPLETED, $this->buyer);
        $this->assertSame(['admin.order_placed', 'admin.order_received', 'admin.order_completed'], $this->typesFor($admin));

        // Customer membatalkan sendiri → admin diberi tahu; admin membatalkan → tidak.
        $byCustomer = $this->placeOrder($product, 1);
        $sm->transition($byCustomer, Order::STATUS_CANCELLED, $this->buyer, ['reason' => 'Salah jumlah']);
        $byAdmin = $this->placeOrder($product, 1);
        $sm->transition($byAdmin, Order::STATUS_CANCELLED, $admin, ['reason' => 'Stok habis']);
        $cancelled = UserNotification::where('user_id', $admin->id)->where('type', 'admin.order_cancelled')->get();
        $this->assertCount(1, $cancelled);
        $this->assertSame($byCustomer->number, $cancelled->first()->data['orderNumber']);

        // Diterima oleh admin dan selesai otomatis (scheduler, tanpa aktor) → tidak ada kabar ke admin.
        $auto = $this->payOrder($this->placeOrder($product, 1), $admin);
        $sm->transition($auto, Order::STATUS_PROCESSING, $admin);
        $sm->transition($auto, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'JNE456']);
        $sm->transition($auto, Order::STATUS_DELIVERED, $admin);
        $sm->transition($auto, Order::STATUS_COMPLETED, null, ['days' => 7]);
        $this->assertSame(1, UserNotification::where('user_id', $admin->id)->where('type', 'admin.order_received')->count());
        $this->assertSame(1, UserNotification::where('user_id', $admin->id)->where('type', 'admin.order_completed')->count());

        // Customer juga diberi tahu saat pesanannya mulai diproses.
        $this->assertSame(2, UserNotification::where('user_id', $this->buyer->id)->where('type', 'order.processing')->count());
    }

    public function test_freight_request_counter_and_acceptance_notify_orders_admins(): void
    {
        Mail::fake();
        $this->setUpCommerce(['exportPaymentDueHours' => 120]);
        $this->setUpExport();
        $admin = $this->adminWith(['orders']);
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'price_usd' => '12.50', 'moq' => 25, 'unit' => 'kg'], 1000);
        $payload = $this->exportCheckoutPayload($product, 100, [
            'deliveryTermCode' => 'cif',
            'destinationPort' => ['name' => 'Port Klang', 'country' => 'Malaysia', 'countryCode' => 'my', 'lat' => 2.9997, 'lng' => 101.3929],
        ]);
        $lines = ['lines' => [['label' => 'Ocean freight', 'amount' => 81500]]];

        // Order CIF masuk: admin diminta menawar ongkir (bukan "pesanan baru" biasa).
        $countered = app(CheckoutService::class)->place($this->exporter, $payload);
        $this->assertSame(['admin.freight_requested'], $this->typesFor($admin));
        $requested = UserNotification::where('user_id', $admin->id)->firstOrFail();
        $this->assertStringContainsString('Port Klang', $requested->body['en']);
        $this->assertStringContainsString('Rubber Trade Sdn. Bhd.', $requested->body['en']);
        $this->assertSame('/admin/orders/'.$countered->number, $requested->url);

        // Customer membalas dengan harga lain.
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$countered->number.'/freight-quotes', $lines)->assertStatus(201);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders/'.$countered->number.'/freight-quotes/counter', ['amount' => 70000])->assertOk();
        $counter = UserNotification::where('user_id', $admin->id)->where('type', 'admin.freight_countered')->firstOrFail();
        $this->assertStringContainsString('USD 700.00', $counter->body['en']);

        // Admin menerima harga balasan: tidak ada kabar "disetujui" ke admin (ia pelakunya).
        $this->app['auth']->forgetGuards();
        $counterId = $countered->fresh()->activeFreightQuote()->id;
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$countered->number.'/freight-quotes/'.$counterId.'/accept')->assertOk();
        $this->assertSame(0, UserNotification::where('type', 'admin.freight_accepted')->count());

        // Customer menyetujui penawaran admin pada order lain.
        $accepted = app(CheckoutService::class)->place($this->exporter, $payload);
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$accepted->number.'/freight-quotes', $lines)->assertStatus(201);
        $quoteId = $accepted->fresh()->activeFreightQuote()->id;
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->postJson('/api/v1/customer/orders/'.$accepted->number.'/freight-quotes/'.$quoteId.'/accept')->assertOk();
        $agreed = UserNotification::where('user_id', $admin->id)->where('type', 'admin.freight_accepted')->get();
        $this->assertCount(1, $agreed);
        $this->assertSame($accepted->number, $agreed->first()->data['orderNumber']);
        $this->assertStringContainsString('USD 815.00', $agreed->first()->body['en']);
    }

    public function test_registration_notifies_admins_with_customers_module(): void
    {
        Mail::fake();
        $customersAdmin = $this->adminWith(['customers']);
        $ordersAdmin = $this->adminWith(['orders']);

        $this->fromFrontend()->postJson('/api/v1/auth/register', [
            'name' => 'Rina Wijaya', 'email' => 'rina@mitrabaru.co.id', 'password' => 'Rahasia123', 'passwordConfirmation' => 'Rahasia123',
            'phone' => '081234567890', 'company' => 'PT Mitra Baru',
        ])->assertCreated();

        $row = UserNotification::where('user_id', $customersAdmin->id)->firstOrFail();
        $this->assertSame('admin.customer_registered', $row->type);
        $this->assertSame('Rina Wijaya (PT Mitra Baru) mendaftar dan menunggu persetujuan.', $row->body['id']);
        $this->assertSame('/admin/customers', $row->url);
        $this->assertSame(User::where('email', 'rina@mitrabaru.co.id')->value('id'), $row->data['customerId']);
        $this->assertSame([], $this->typesFor($ordersAdmin));
    }

    public function test_admin_lists_notifications_marks_them_read_and_sees_the_badge_count(): void
    {
        $admin = $this->adminWith(['orders']);
        $other = $this->adminWith(['orders']);
        $notifier = app(InAppNotifier::class);
        $params = ['customer' => 'Coating Solutions Co.', 'total' => 'Rp1.000.000'];
        $this->assertSame(2, $notifier->admins('orders', 'admin.order_placed', ['number' => 'IKN-1'] + $params, '/admin/orders/IKN-1', ['orderNumber' => 'IKN-1']));
        $notifier->admins('orders', 'admin.order_cancelled', ['number' => 'IKN-2'] + $params, '/admin/orders/IKN-2');
        $mine = UserNotification::where('user_id', $admin->id)->orderBy('id')->get();
        $theirs = UserNotification::where('user_id', $other->id)->orderBy('id')->first();

        $this->actingAs($admin)->getJson('/api/v1/admin/badges')
            ->assertOk()->assertJsonPath('data.notifications', 2)->assertJsonPath('data.orders', 0)->assertJsonPath('data.payments', null);

        $this->actingAs($admin)->getJson('/api/v1/admin/notifications')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.unread', 2)
            ->assertJsonPath('data.0.id', $mine[1]->id)
            ->assertJsonPath('data.0.type', 'admin.order_cancelled')
            ->assertJsonPath('data.0.title.id', 'Pesanan dibatalkan customer')
            ->assertJsonPath('data.1.body.en', 'Coating Solutions Co. placed order IKN-1 for Rp1.000.000.')
            ->assertJsonPath('data.1.url', '/admin/orders/IKN-1')
            ->assertJsonPath('data.1.read', false);

        $this->actingAs($admin)->postJson('/api/v1/admin/notifications/'.$mine[0]->id.'/read')
            ->assertOk()->assertJsonPath('data.read', true)->assertJsonPath('meta.unread', 1);
        $this->actingAs($admin)->getJson('/api/v1/admin/notifications?unread=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $mine[1]->id);

        // Notifikasi milik admin lain → 404, tidak tersentuh.
        $this->actingAs($admin)->postJson('/api/v1/admin/notifications/'.$theirs->id.'/read')->assertStatus(404);
        $this->assertNull($theirs->fresh()->read_at);

        $this->actingAs($admin)->postJson('/api/v1/admin/notifications/read-all')
            ->assertOk()->assertJsonPath('data.updated', 1)->assertJsonPath('data.unread', 0);
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.notifications', 0);
        $this->assertSame(2, UserNotification::where('user_id', $other->id)->whereNull('read_at')->count());
    }

    public function test_admin_notification_endpoints_reject_guests_and_customers(): void
    {
        $this->getJson('/api/v1/admin/notifications')->assertStatus(401);
        $this->actingAs($this->customer())->getJson('/api/v1/admin/notifications')->assertStatus(403);
        $this->actingAs($this->customer())->postJson('/api/v1/admin/notifications/read-all')->assertStatus(403);
    }
}
