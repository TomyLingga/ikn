<?php

namespace Tests\Feature\Messaging;

use App\Models\Order;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\Account\CustomerStatusService;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Notification\InAppNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Notifikasi dalam aplikasi (ASUMSI A-71): dibuat oleh alur order/akun/voucher, daftar + badge + tandai dibaca.
class NotificationTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_order_flow_creates_notifications_for_the_order_owner(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $order = $this->placeOrder($this->makeProduct([], 10), 1);
        $admin = $this->superAdmin();
        $order = $this->payOrder($order, $admin);
        $sm = app(OrderStateMachine::class);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'JNE123']);
        $sm->transition($order, Order::STATUS_DELIVERED, $this->buyer);
        $sm->transition($order, Order::STATUS_COMPLETED, $this->buyer);

        $types = UserNotification::where('user_id', $this->buyer->id)->orderBy('id')->pluck('type')->all();
        $this->assertSame(['order.placed', 'order.payment_accepted', 'order.shipped', 'order.delivered', 'order.completed'], $types);
        $this->assertSame(0, UserNotification::where('user_id', $admin->id)->count());

        $shipped = UserNotification::where('type', 'order.shipped')->first();
        $this->assertStringContainsString($order->number, $shipped->body['id']);
        $this->assertStringContainsString('JNE123', $shipped->body['en']);
        $this->assertSame('/dashboard/pesanan/'.$order->number, $shipped->url);
        $this->assertSame($order->number, $shipped->data['orderNumber']);
    }

    public function test_customer_lists_notifications_and_marks_them_read(): void
    {
        $customer = $this->customer();
        $other = $this->customer();
        $notifier = app(InAppNotifier::class);
        $first = $notifier->notify($customer, 'account.approved', [], '/dashboard/katalog');
        $second = $notifier->notify($customer, 'voucher.assigned', ['code' => 'MITRA250'], '/dashboard/katalog');
        $theirs = $notifier->notify($other, 'account.approved');

        $this->actingAs($customer)->getJson('/api/v1/customer/badges')
            ->assertOk()->assertJsonPath('data.notifications', 2)->assertJsonPath('data.chat', 0);

        $this->actingAs($customer)->getJson('/api/v1/customer/notifications')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('meta.total', 2)->assertJsonPath('meta.unread', 2)
            ->assertJsonPath('data.0.id', $second->id)
            ->assertJsonPath('data.0.type', 'voucher.assigned')
            ->assertJsonPath('data.0.title.id', 'Voucher baru untuk Anda')
            ->assertJsonPath('data.0.body.en', 'Use code MITRA250 at checkout.')
            ->assertJsonPath('data.0.url', '/dashboard/katalog')
            ->assertJsonPath('data.0.read', false);

        $this->actingAs($customer)->postJson('/api/v1/customer/notifications/'.$first->id.'/read')
            ->assertOk()->assertJsonPath('data.read', true)->assertJsonPath('meta.unread', 1);
        $this->actingAs($customer)->getJson('/api/v1/customer/notifications?unread=1')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $second->id);

        // Notifikasi milik customer lain → 404, tidak tersentuh.
        $this->actingAs($customer)->postJson('/api/v1/customer/notifications/'.$theirs->id.'/read')->assertStatus(404);
        $this->assertNull($theirs->fresh()->read_at);

        $this->actingAs($customer)->postJson('/api/v1/customer/notifications/read-all')
            ->assertOk()->assertJsonPath('data.updated', 1)->assertJsonPath('data.unread', 0);
        $this->actingAs($customer)->getJson('/api/v1/customer/badges')->assertOk()->assertJsonPath('data.notifications', 0);
        $this->assertNull($theirs->fresh()->read_at);
    }

    public function test_account_status_and_assigned_voucher_notify_the_customer(): void
    {
        Mail::fake();
        $pending = $this->customer(['status' => User::STATUS_PENDING]);
        $admin = $this->superAdmin();
        app(CustomerStatusService::class)->transition($pending, User::STATUS_ACTIVE, null, $admin);
        $this->assertSame(['account.approved'], UserNotification::where('user_id', $pending->id)->pluck('type')->all());

        $rejected = $this->customer(['status' => User::STATUS_PENDING]);
        app(CustomerStatusService::class)->transition($rejected, User::STATUS_REJECTED, 'Dokumen tidak lengkap', $admin);
        $this->assertStringContainsString('Dokumen tidak lengkap', UserNotification::where('user_id', $rejected->id)->first()->body['id']);

        // Voucher khusus: hanya customer yang baru ditambahkan yang diberi tahu.
        $payload = [
            'code' => 'KHUSUS10', 'type' => 'percent', 'value' => 10, 'audience' => 'customers', 'customerIds' => [$pending->id],
        ];
        $id = $this->actingAs($admin)->postJson('/api/v1/admin/vouchers', $payload)->assertStatus(201)->json('data.id');
        $this->assertSame(1, UserNotification::where('type', 'voucher.assigned')->where('user_id', $pending->id)->count());

        $second = $this->customer();
        $this->actingAs($admin)->putJson('/api/v1/admin/vouchers/'.$id, array_merge($payload, ['customerIds' => [$pending->id, $second->id]]))->assertOk();
        $this->assertSame(1, UserNotification::where('type', 'voucher.assigned')->where('user_id', $pending->id)->count());
        $this->assertSame(1, UserNotification::where('type', 'voucher.assigned')->where('user_id', $second->id)->count());
    }

    public function test_notification_endpoints_are_customer_only(): void
    {
        $this->getJson('/api/v1/customer/notifications')->assertStatus(401);
        $this->actingAs($this->superAdmin())->getJson('/api/v1/customer/notifications')->assertStatus(403);
    }

    public function test_admin_badges_follow_module_access(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $this->uploadProof($this->placeOrder($this->makeProduct([], 10), 1));
        $this->customer(['status' => User::STATUS_PENDING]);
        $this->customer(['status' => User::STATUS_PENDING]);

        // Order yang sudah dibayar dan masih berjalan dihitung di badge orders; payment_review tidak (sudah di payments).
        \App\Models\Order::whereKey($this->placeOrder($this->makeProduct([], 10), 1)->id)->update(['status' => \App\Models\Order::STATUS_PROCESSING]);

        $this->actingAs($this->superAdmin())->getJson('/api/v1/admin/badges')
            ->assertOk()->assertJsonPath('data.orders', 1)->assertJsonPath('data.payments', 1)->assertJsonPath('data.customers', 2)->assertJsonPath('data.chat', 0);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['customers']))->getJson('/api/v1/admin/badges')
            ->assertOk()->assertJsonPath('data.orders', null)->assertJsonPath('data.payments', null)->assertJsonPath('data.customers', 2)->assertJsonPath('data.chat', null);

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->buyer)->getJson('/api/v1/admin/badges')->assertStatus(403);
    }
}
