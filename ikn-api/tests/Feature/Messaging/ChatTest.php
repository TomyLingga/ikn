<?php

namespace Tests\Feature\Messaging;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\AuditLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Live chat customer ↔ admin (ASUMSI A-73): satu percakapan per customer, penghitung belum-dibaca, polling ?after.
class ChatTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_customer_and_admin_exchange_messages_with_unread_counters(): void
    {
        $customer = $this->customer(['name' => 'Budi Santoso']);
        $customer->profile()->create(['company' => 'Coating Solutions Co.']);
        $admin = $this->adminWith(['chat'], ['name' => 'Admin Penjualan']);

        // Belum ada percakapan: GET tidak membuatnya.
        $this->actingAs($customer)->getJson('/api/v1/customer/chat')
            ->assertOk()->assertJsonPath('data.conversation', null)->assertJsonCount(0, 'data.messages');
        $this->assertSame(0, ChatConversation::count());

        $first = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => '  Halo, apakah stok Resiprene tersedia?  '])
            ->assertStatus(201)
            ->assertJsonPath('data.message.role', 'customer')
            ->assertJsonPath('data.message.body', 'Halo, apakah stok Resiprene tersedia?')
            ->assertJsonPath('data.conversation.unread', 0)
            ->json('data.message.id');
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Butuh 2 ton.'])->assertStatus(201);
        $this->assertSame(1, ChatConversation::count());
        $conversation = ChatConversation::first();
        $this->assertSame(2, $conversation->admin_unread);

        // Admin: kotak masuk + badge, buka percakapan, tandai dibaca, balas.
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 1);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.unreadConversations', 1)
            ->assertJsonPath('data.0.customer.name', 'Budi Santoso')
            ->assertJsonPath('data.0.customer.company', 'Coating Solutions Co.')
            ->assertJsonPath('data.0.unread', 2)
            ->assertJsonPath('data.0.lastMessagePreview', 'Butuh 2 ton.')
            ->assertJsonPath('data.0.lastSenderRole', 'customer');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?q=coating')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?q=tidakada')->assertOk()->assertJsonCount(0, 'data');

        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonCount(2, 'data.messages')
            ->assertJsonPath('data.messages.0.id', $first)
            ->assertJsonPath('data.messages.0.senderName', 'Budi Santoso')
            ->assertJsonPath('data.hasMore', false);
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/read')
            ->assertOk()->assertJsonPath('data.unreadConversations', 0);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?unread=1')->assertOk()->assertJsonCount(0, 'data');

        $reply = $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Tersedia, Pak.'])
            ->assertStatus(201)
            ->assertJsonPath('data.message.role', 'admin')
            ->assertJsonPath('data.message.senderName', 'Admin Penjualan')
            ->assertJsonPath('data.conversation.unread', 0)
            ->json('data.message.id');
        // Balasan chat tidak dicatat di audit log.
        $this->assertSame(0, AuditLog::count());

        // Customer: badge, polling ?after hanya mengembalikan pesan baru, nama admin disembunyikan.
        $this->app['auth']->forgetGuards();
        $this->actingAs($customer)->getJson('/api/v1/customer/badges')->assertOk()->assertJsonPath('data.chat', 1);
        $this->actingAs($customer)->getJson('/api/v1/customer/chat?after='.$first)
            ->assertOk()->assertJsonCount(2, 'data.messages')
            ->assertJsonPath('data.messages.1.id', $reply)
            ->assertJsonPath('data.messages.1.role', 'admin')
            ->assertJsonPath('data.messages.1.senderName', null)
            ->assertJsonPath('data.conversation.unread', 1);
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/read')->assertOk()->assertJsonPath('data.unread', 0);
        $this->actingAs($customer)->getJson('/api/v1/customer/badges')->assertOk()->assertJsonPath('data.chat', 0);
        $this->actingAs($customer)->getJson('/api/v1/customer/chat?after='.$reply)->assertOk()->assertJsonCount(0, 'data.messages');
    }

    public function test_customer_can_attach_product_or_own_order_context(): void
    {
        Mail::fake();
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'name' => ['id' => 'Resiprene 35', 'en' => 'Resiprene 35'], 'price' => 125000], 10);
        $order = $this->placeOrder($product, 1);

        $other = $this->customer(['email' => 'lain@example.com']);
        $other->addresses()->create($this->addressAttributes());
        $theirs = $this->placeOrder($product, 1, ['addressId' => $other->addresses()->first()->id], null, $other);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', [
            'body' => 'Apakah produk ini bisa dikirim ke Riau?',
            'context' => ['type' => 'product', 'slug' => 'resiprene-35'],
        ])->assertStatus(201)
            ->assertJsonPath('data.message.context.type', 'product')
            ->assertJsonPath('data.message.context.slug', 'resiprene-35')
            ->assertJsonPath('data.message.context.name.id', 'Resiprene 35')
            ->assertJsonPath('data.message.context.price', 125000);

        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', [
            'body' => 'Kapan pesanan ini dikirim?',
            'context' => ['type' => 'order', 'number' => $order->number],
        ])->assertStatus(201)
            ->assertJsonPath('data.message.context.number', $order->number)
            ->assertJsonPath('data.message.context.status', 'pending_payment');

        // Order milik customer lain, produk tidak ada, dan tipe tak dikenal → 422.
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', [
            'body' => 'Coba', 'context' => ['type' => 'order', 'number' => $theirs->number],
        ])->assertStatus(422)->assertJsonValidationErrors(['context']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', [
            'body' => 'Coba', 'context' => ['type' => 'product', 'slug' => 'tidak-ada'],
        ])->assertStatus(422)->assertJsonValidationErrors(['context']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', [
            'body' => 'Coba', 'context' => ['type' => 'voucher'],
        ])->assertStatus(422)->assertJsonValidationErrors(['context.type']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', ['body' => ''])->assertStatus(422)->assertJsonValidationErrors(['body']);
        $this->actingAs($this->buyer)->postJson('/api/v1/customer/chat/messages', ['body' => str_repeat('a', ChatMessage::BODY_MAX + 1)])->assertStatus(422);

        $this->assertSame(2, ChatMessage::count());
    }

    public function test_admin_can_open_a_conversation_and_older_messages_are_paged(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);

        $id = $this->actingAs($admin)->postJson('/api/v1/admin/chats', ['customerId' => $customer->id])
            ->assertOk()->assertJsonPath('data.customer.id', $customer->id)->json('data.id');
        // Idempoten: percakapan yang sama, dan percakapan kosong tidak muncul di kotak masuk.
        $this->actingAs($admin)->postJson('/api/v1/admin/chats', ['customerId' => $customer->id])->assertOk()->assertJsonPath('data.id', $id);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin)->postJson('/api/v1/admin/chats', ['customerId' => $admin->id])->assertStatus(422)->assertJsonValidationErrors(['customerId']);

        $conversation = ChatConversation::findOrFail($id);
        foreach (range(1, 55) as $i) {
            ChatMessage::create(['conversation_id' => $id, 'sender_id' => $admin->id, 'sender_role' => 'admin', 'body' => 'Pesan '.$i]);
        }

        $page = $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$id)
            ->assertOk()->assertJsonCount(50, 'data.messages')->assertJsonPath('data.hasMore', true)
            ->assertJsonPath('data.messages.49.body', 'Pesan 55');
        $oldest = $page->json('data.messages.0.id');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$id.'?before='.$oldest)
            ->assertOk()->assertJsonCount(5, 'data.messages')->assertJsonPath('data.hasMore', false)
            ->assertJsonPath('data.messages.0.body', 'Pesan 1');
        $this->assertSame(0, $conversation->fresh()->admin_unread);
    }

    public function test_chat_requires_the_right_role_and_module(): void
    {
        $customer = $this->customer();
        $conversation = ChatConversation::create(['user_id' => $customer->id]);

        $this->getJson('/api/v1/customer/chat')->assertStatus(401);
        $this->actingAs($this->adminWith(['orders']))->getJson('/api/v1/admin/chats')->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['orders']))->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Hai'])->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->actingAs($customer)->getJson('/api/v1/admin/chats')->assertStatus(403);
        $this->actingAs($customer)->getJson('/api/v1/admin/chats/'.$conversation->id)->assertStatus(403);
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->superAdmin())->getJson('/api/v1/customer/chat')->assertStatus(403);
    }
}
