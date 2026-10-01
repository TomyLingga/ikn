<?php

namespace Tests\Feature\Messaging;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

// Live chat tamu (belum login): formulir perkenalan → token → polling/kirim; admin melihatnya sebagai tamu; claim setelah login.
class GuestChatTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_starts_a_conversation_and_exchanges_messages_with_admin(): void
    {
        $admin = $this->adminWith(['chat'], ['name' => 'Admin Penjualan']);

        $this->postJson('/api/v1/chat/guest', ['name' => 'Rina', 'email' => 'RINA@Example.com', 'body' => ''])
            ->assertStatus(422)->assertJsonValidationErrors(['body']);
        $this->postJson('/api/v1/chat/guest', ['name' => 'R', 'email' => 'bukan-email', 'phone' => 'abc', 'body' => 'Halo'])
            ->assertStatus(422)->assertJsonValidationErrors(['name', 'email', 'phone']);

        $start = $this->postJson('/api/v1/chat/guest', [
            'name' => ' Rina Hasibuan ', 'email' => 'RINA@Example.com', 'phone' => '+62 812-3456-7890', 'body' => 'Halo, apakah ada harga grosir?',
        ])->assertStatus(201)
            ->assertJsonPath('data.message.role', 'customer')
            ->assertJsonPath('data.message.senderName', 'Rina Hasibuan')
            ->assertJsonPath('data.conversation.unread', 0);
        $token = $start->json('data.token');
        $this->assertSame(48, strlen($token));
        $this->assertDatabaseHas('chat_conversations', ['guest_email' => 'rina@example.com', 'guest_name' => 'Rina Hasibuan', 'user_id' => null]);

        // Token salah → 404; token benar → percakapan.
        $this->getJson('/api/v1/chat/guest?token=salah')->assertStatus(404);
        $this->getJson('/api/v1/chat/guest?token='.$token)->assertOk()->assertJsonCount(1, 'data.messages');
        $second = $this->postJson('/api/v1/chat/guest/messages', ['token' => $token, 'body' => 'Untuk 500 pcs.'])->assertStatus(201)->json('data.message.id');

        // Admin melihatnya sebagai tamu, bisa mencari lewat nama/email tamu, membalas.
        $conversation = ChatConversation::first();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.kind', 'guest')
            ->assertJsonPath('data.0.customer', null)
            ->assertJsonPath('data.0.guest.name', 'Rina Hasibuan')
            ->assertJsonPath('data.0.guest.phone', '+62 812-3456-7890')
            ->assertJsonPath('data.0.unread', 2);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?q=rina@example')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonPath('data.messages.0.senderName', 'Rina Hasibuan');
        $reply = $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Ada, Bu. Mulai 100 pcs.'])
            ->assertStatus(201)->json('data.message.id');

        // Tamu memolling pesan baru; nama admin disembunyikan; tandai dibaca.
        $this->getJson('/api/v1/chat/guest?token='.$token.'&after='.$second)
            ->assertOk()->assertJsonCount(1, 'data.messages')
            ->assertJsonPath('data.messages.0.id', $reply)
            ->assertJsonPath('data.messages.0.senderName', null)
            ->assertJsonPath('data.conversation.unread', 1);
        $this->postJson('/api/v1/chat/guest/read', ['token' => $token])->assertOk();
        $this->assertSame(0, $conversation->fresh()->customer_unread);
        // Token tidak pernah bocor di JSON percakapan.
        $this->assertStringNotContainsString($token, json_encode($this->actingAs($admin)->getJson('/api/v1/admin/chats')->json()));
    }

    public function test_guest_conversation_is_claimed_by_the_account_after_login(): void
    {
        $customer = $this->customer();
        $token = $this->postJson('/api/v1/chat/guest', ['name' => 'Budi', 'email' => 'budi@example.com', 'body' => 'Pesan sebagai tamu'])->json('data.token');

        // Akun belum punya percakapan: percakapan tamu menjadi milik akun.
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/claim', ['token' => $token])
            ->assertOk()->assertJsonPath('data.claimed', true);
        $this->assertDatabaseHas('chat_conversations', ['user_id' => $customer->id, 'guest_token' => null]);
        $this->getJson('/api/v1/chat/guest?token='.$token)->assertStatus(404);
        $this->actingAs($customer)->getJson('/api/v1/customer/chat')->assertOk()->assertJsonCount(1, 'data.messages');

        // Akun sudah punya percakapan: pesan tamu dipindahkan, percakapan tamu dihapus.
        $token2 = $this->postJson('/api/v1/chat/guest', ['name' => 'Budi', 'email' => 'budi@example.com', 'body' => 'Pesan tamu kedua'])->json('data.token');
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/claim', ['token' => $token2])->assertOk()->assertJsonPath('data.claimed', true);
        $this->assertSame(1, ChatConversation::count());
        $this->assertSame(2, ChatMessage::count());
        $this->actingAs($customer)->getJson('/api/v1/customer/chat')->assertOk()->assertJsonCount(2, 'data.messages');
        // Token tak dikenal: tidak ada yang berubah.
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/claim', ['token' => 'tidak-ada'])->assertOk()->assertJsonPath('data.claimed', false);
    }
}
