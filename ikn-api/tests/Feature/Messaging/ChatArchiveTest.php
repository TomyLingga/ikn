<?php

namespace Tests\Feature\Messaging;

use App\Models\AuditLog;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

// Live chat (ASUMSI A-99): percakapan hanya bisa diarsipkan admin, tidak pernah dihapus. Arsip menyembunyikan
// percakapan dari kotak masuk bawaan dan badge; pesan baru dari customer/tamu mengeluarkannya lagi.
class ChatArchiveTest extends TestCase
{
    use RefreshDatabase;

    private function switchUser(): void
    {
        $this->app['auth']->forgetGuards();
    }

    public function test_admin_archives_and_unarchives_a_conversation(): void
    {
        $customer = $this->customer(['name' => 'Budi Santoso']);
        $other = $this->customer(['name' => 'Siti Rahma', 'email' => 'siti@example.com']);
        $admin = $this->adminWith(['chat'], ['name' => 'Admin Penjualan']);

        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Terima kasih, sudah jelas.'])->assertStatus(201);
        $this->switchUser();
        $this->actingAs($other)->postJson('/api/v1/customer/chat/messages', ['body' => 'Apakah bisa kirim ke Riau?'])->assertStatus(201);
        $conversation = ChatConversation::where('user_id', $customer->id)->firstOrFail();

        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 2);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.archived', false)
            ->assertJsonPath('meta.archivedConversations', 0);

        // Arsipkan (percakapan masih punya pesan belum dibaca): hilang dari daftar bawaan dan dari badge.
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/archive')
            ->assertOk()
            ->assertJsonPath('data.id', $conversation->id)
            ->assertJsonPath('data.archived', true)
            ->assertJsonPath('data.archivedBy.id', $admin->id)
            ->assertJsonPath('data.archivedBy.name', 'Admin Penjualan')
            ->assertJsonPath('meta.unreadConversations', 1);
        $this->assertNotNull($conversation->fresh()->archived_at);
        $this->assertSame($admin->id, $conversation->fresh()->archived_by);
        // Mengarsipkan ulang tidak mengubah pencatatnya.
        $archivedAt = $conversation->fresh()->archived_at;
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/archive')->assertOk()->assertJsonPath('data.archived', true);
        $this->assertTrue($archivedAt->eq($conversation->fresh()->archived_at));

        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 1);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.customer.name', 'Siti Rahma')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.unreadConversations', 1)
            ->assertJsonPath('meta.archivedConversations', 1);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?unread=1')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?q=budi')->assertOk()->assertJsonCount(0, 'data');

        // Tab Arsip: percakapan itu ada di sana, bisa dicari, dibuka, dan dibalas tanpa keluar dari arsip.
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $conversation->id)
            ->assertJsonPath('data.0.archived', true)
            ->assertJsonPath('data.0.archivedBy.name', 'Admin Penjualan');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1&q=budi')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1&q=siti')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonPath('data.conversation.archived', true)->assertJsonCount(1, 'data.messages');
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Sama-sama, Pak.'])
            ->assertStatus(201)->assertJsonPath('data.conversation.archived', true);
        $this->assertNotNull($conversation->fresh()->archived_at);

        // Keluarkan dari arsip: kembali ke kotak masuk.
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/unarchive')
            ->assertOk()->assertJsonPath('data.archived', false)->assertJsonPath('data.archivedBy', null);
        $this->assertNull($conversation->fresh()->archived_at);
        $this->assertNull($conversation->fresh()->archived_by);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1')->assertOk()->assertJsonCount(0, 'data');

        // Arsip/keluarkan dicatat audit log (balasan chat tidak): 2 arsip + 1 keluarkan.
        $this->assertSame(3, AuditLog::count());
        // Tidak ada pesan atau percakapan yang hilang.
        $this->assertSame(2, ChatConversation::count());
        $this->assertSame(3, ChatMessage::count());
    }

    public function test_a_new_message_from_the_customer_or_guest_unarchives_the_conversation(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);

        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Pesan lama'])->assertStatus(201);
        $conversation = ChatConversation::firstOrFail();
        $this->switchUser();
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/read')->assertOk();
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/archive')->assertOk();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 0);

        // Customer tetap melihat percakapannya seperti biasa (arsip hanya urusan kotak masuk admin) dan menulis lagi.
        $this->switchUser();
        $this->actingAs($customer)->getJson('/api/v1/customer/chat')->assertOk()->assertJsonCount(1, 'data.messages');
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Saya mau pesan lagi.'])->assertStatus(201);
        $fresh = $conversation->fresh();
        $this->assertNull($fresh->archived_at);
        $this->assertNull($fresh->archived_by);

        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.archived', false)
            ->assertJsonPath('data.0.unread', 1)
            ->assertJsonPath('data.0.lastMessagePreview', 'Saya mau pesan lagi.');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 1);

        // Tamu: sama.
        $this->switchUser();
        $token = $this->postJson('/api/v1/chat/guest', ['name' => 'Rina', 'email' => 'rina@example.com', 'body' => 'Halo dari tamu'])->json('data.token');
        $guest = ChatConversation::whereNull('user_id')->firstOrFail();
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$guest->id.'/archive')->assertOk()->assertJsonPath('data.kind', 'guest');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $guest->id);
        $this->switchUser();
        $this->postJson('/api/v1/chat/guest/messages', ['token' => $token, 'body' => 'Masih ada pertanyaan'])->assertStatus(201);
        $this->assertNull($guest->fresh()->archived_at);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats?archived=1')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_archive_requires_the_chat_module_and_an_existing_conversation(): void
    {
        $customer = $this->customer();
        $conversation = ChatConversation::create(['user_id' => $customer->id]);

        $this->postJson('/api/v1/admin/chats/'.$conversation->id.'/archive')->assertStatus(401);
        $this->actingAs($this->adminWith(['orders']))->postJson('/api/v1/admin/chats/'.$conversation->id.'/archive')->assertStatus(403);
        $this->switchUser();
        $this->actingAs($customer)->postJson('/api/v1/admin/chats/'.$conversation->id.'/archive')->assertStatus(403);
        $this->assertNull($conversation->fresh()->archived_at);

        $this->switchUser();
        $admin = $this->adminWith(['chat']);
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/999999/archive')->assertStatus(404);
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/999999/unarchive')->assertStatus(404);
        // Customer tidak punya rute arsip: percakapannya hanya satu.
        $this->switchUser();
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/archive')->assertStatus(404);
    }

    public function test_no_route_can_delete_a_conversation_or_a_message(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);
        $messageId = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Jangan dihapus'])->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();
        $this->switchUser();
        $token = $this->postJson('/api/v1/chat/guest', ['name' => 'Rina', 'email' => 'rina@example.com', 'body' => 'Pesan tamu'])->json('data.token');
        $guestMessage = ChatMessage::max('id');

        // Tabel rute: tidak ada satu pun rute chat yang menerima DELETE.
        $deleteRoutes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($route) => in_array('DELETE', $route->methods(), true) && str_contains($route->uri(), 'chat'))
            ->map(fn ($route) => $route->uri())->values()->all();
        $this->assertSame([], $deleteRoutes);

        // Permintaan DELETE ke setiap alamat chat ditolak (405), sebagai admin, customer, maupun tamu.
        $this->actingAs($admin)->deleteJson('/api/v1/admin/chats')->assertStatus(405);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/chats/'.$conversation->id)->assertStatus(405);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/chats/'.$conversation->id.'/messages')->assertStatus(405);
        $this->actingAs($admin)->deleteJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$messageId)->assertStatus(405);
        $this->switchUser();
        $this->actingAs($this->superAdmin())->deleteJson('/api/v1/admin/chats/'.$conversation->id)->assertStatus(405);
        $this->switchUser();
        $this->actingAs($customer)->deleteJson('/api/v1/customer/chat')->assertStatus(405);
        $this->actingAs($customer)->deleteJson('/api/v1/customer/chat/messages')->assertStatus(405);
        $this->actingAs($customer)->deleteJson('/api/v1/customer/chat/messages/'.$messageId)->assertStatus(405);
        $this->switchUser();
        $this->deleteJson('/api/v1/chat/guest', ['token' => $token])->assertStatus(405);
        $this->deleteJson('/api/v1/chat/guest/messages', ['token' => $token])->assertStatus(405);
        $this->deleteJson('/api/v1/chat/guest/messages/'.$guestMessage, ['token' => $token])->assertStatus(405);

        $this->assertSame(2, ChatConversation::count());
        $this->assertSame(2, ChatMessage::count());
        $this->assertSame('Jangan dihapus', ChatMessage::findOrFail($messageId)->body);
    }
}
