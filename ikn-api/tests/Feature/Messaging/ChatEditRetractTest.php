<?php

namespace Tests\Feature\Messaging;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Services\Chat\ChatService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

// Live chat (ASUMSI A-99): muat pesan per halaman, edit/tarik pesan sendiri dalam jendela waktu, dan sinkron
// perubahan ke pihak lawan lewat polling `?after=&rev=`. Tidak ada baris pesan yang dihapus.
class ChatEditRetractTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['ikn.chat.edit_window_seconds' => 60]);
        // Waktu dibekukan agar sisa detik jendela edit bisa diperiksa persis.
        $this->travelTo(Carbon::parse('2026-11-16 10:00:00', config('app.timezone')));
    }

    private function switchUser(): void
    {
        $this->app['auth']->forgetGuards();
    }

    public function test_thread_loads_one_page_at_a_time_for_customer_and_guest(): void
    {
        $this->assertSame(30, ChatService::PAGE_SIZE);
        $customer = $this->customer();
        $conversation = ChatConversation::create(['user_id' => $customer->id]);
        foreach (range(1, 65) as $i) {
            ChatMessage::create(['conversation_id' => $conversation->id, 'sender_id' => $customer->id, 'sender_role' => 'customer', 'body' => 'Pesan '.$i]);
        }

        // Halaman terbaru saja; dua halaman lama berikutnya lewat ?before, sampai hasMore false.
        $first = $this->actingAs($customer)->getJson('/api/v1/customer/chat')
            ->assertOk()->assertJsonCount(30, 'data.messages')
            ->assertJsonPath('data.hasMore', true)
            ->assertJsonPath('data.editWindowSeconds', 60)
            ->assertJsonPath('data.messages.0.body', 'Pesan 36')
            ->assertJsonPath('data.messages.29.body', 'Pesan 65');
        $second = $this->actingAs($customer)->getJson('/api/v1/customer/chat?before='.$first->json('data.messages.0.id'))
            ->assertOk()->assertJsonCount(30, 'data.messages')
            ->assertJsonPath('data.hasMore', true)
            ->assertJsonPath('data.messages.0.body', 'Pesan 6')
            ->assertJsonPath('data.messages.29.body', 'Pesan 35');
        $this->actingAs($customer)->getJson('/api/v1/customer/chat?before='.$second->json('data.messages.0.id'))
            ->assertOk()->assertJsonCount(5, 'data.messages')
            ->assertJsonPath('data.hasMore', false)
            ->assertJsonPath('data.messages.0.body', 'Pesan 1');
        // Tidak ada yang lebih lama dari pesan pertama.
        $this->actingAs($customer)->getJson('/api/v1/customer/chat?before='.ChatMessage::min('id'))
            ->assertOk()->assertJsonCount(0, 'data.messages')->assertJsonPath('data.hasMore', false);

        // Tamu: aturan halaman yang sama.
        $this->switchUser();
        $token = $this->postJson('/api/v1/chat/guest', ['name' => 'Rina', 'email' => 'rina@example.com', 'body' => 'Tamu 1'])
            ->assertStatus(201)->assertJsonPath('data.editWindowSeconds', 60)->json('data.token');
        $guest = ChatConversation::whereNull('user_id')->firstOrFail();
        foreach (range(2, 40) as $i) {
            ChatMessage::create(['conversation_id' => $guest->id, 'sender_role' => 'customer', 'body' => 'Tamu '.$i]);
        }
        $page = $this->getJson('/api/v1/chat/guest?token='.$token)
            ->assertOk()->assertJsonCount(30, 'data.messages')->assertJsonPath('data.hasMore', true)
            ->assertJsonPath('data.messages.29.body', 'Tamu 40');
        $this->getJson('/api/v1/chat/guest?token='.$token.'&before='.$page->json('data.messages.0.id'))
            ->assertOk()->assertJsonCount(10, 'data.messages')->assertJsonPath('data.hasMore', false)
            ->assertJsonPath('data.messages.0.body', 'Tamu 1');
    }

    public function test_customer_edits_own_message_inside_the_window_and_admin_poll_receives_the_change(): void
    {
        $customer = $this->customer(['name' => 'Budi Santoso']);
        $admin = $this->adminWith(['chat']);

        $sent = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Halo, stok Resipren ada?'])
            ->assertStatus(201)
            ->assertJsonPath('data.message.editableSeconds', 60)
            ->assertJsonPath('data.message.editedAt', null)
            ->assertJsonPath('data.message.retracted', false)
            ->assertJsonPath('data.conversation.revision', 1);
        $id = $sent->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();

        // Admin membuka utas: menerima revisi 1, dan pesan customer tidak bisa ia ubah.
        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()
            ->assertJsonPath('data.conversation.revision', 1)
            ->assertJsonPath('data.editWindowSeconds', 60)
            ->assertJsonPath('data.messages.0.editableSeconds', 0);

        // 30 detik kemudian customer memperbaiki salah ketik.
        $this->travel(30)->seconds();
        $this->switchUser();
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$id, ['body' => ''])->assertStatus(422)->assertJsonValidationErrors(['body']);
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$id, ['body' => '  Halo, stok Resiprene 35 ada?  '])
            ->assertOk()
            ->assertJsonPath('data.message.id', $id)
            ->assertJsonPath('data.message.body', 'Halo, stok Resiprene 35 ada?')
            ->assertJsonPath('data.message.editableSeconds', 30)
            ->assertJsonPath('data.message.retracted', false)
            ->assertJsonPath('data.conversation.revision', 2);
        $this->assertNotNull($this->actingAs($customer)->getJson('/api/v1/customer/chat')->json('data.messages.0.editedAt'));
        // Isi lama tidak hilang dari database, tetapi tidak pernah dikirim lewat API.
        $this->assertSame('Halo, stok Resipren ada?', ChatMessage::findOrFail($id)->edit_history[0]['body']);

        // Polling admin (?after=id terakhir&rev=revisi terakhir): tidak ada pesan baru, satu pesan berubah.
        $this->switchUser();
        $poll = $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$id.'&rev=1')
            ->assertOk()
            ->assertJsonCount(0, 'data.messages')
            ->assertJsonCount(1, 'data.changed')
            ->assertJsonPath('data.changed.0.id', $id)
            ->assertJsonPath('data.changed.0.body', 'Halo, stok Resiprene 35 ada?')
            ->assertJsonPath('data.changed.0.editableSeconds', 0)
            ->assertJsonPath('data.conversation.revision', 2);
        $this->assertNotNull($poll->json('data.changed.0.editedAt'));
        $this->assertStringNotContainsString('Resipren ada', json_encode($poll->json()));
        // Sudah sinkron: polling berikutnya kosong. Pratinjau daftar admin mengikuti isi baru.
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$id.'&rev=2')
            ->assertOk()->assertJsonCount(0, 'data.messages')->assertJsonCount(0, 'data.changed');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()->assertJsonPath('data.0.lastMessagePreview', 'Halo, stok Resiprene 35 ada?')->assertJsonPath('data.0.unread', 1);

        // Tepat di batas 60 detik masih boleh; sesudahnya 409 dengan kode yang jelas dan isi tidak berubah.
        $this->switchUser();
        $this->travel(30)->seconds();
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$id, ['body' => 'Halo, stok Resiprene 35 tersedia?'])->assertOk();
        $this->travel(1)->seconds();
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$id, ['body' => 'Terlambat'])
            ->assertStatus(409)
            ->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED')
            ->assertJsonPath('meta.windowSeconds', 60);
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$id.'/retract')
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
        $this->actingAs($customer)->getJson('/api/v1/customer/chat')
            ->assertOk()
            ->assertJsonPath('data.messages.0.body', 'Halo, stok Resiprene 35 tersedia?')
            ->assertJsonPath('data.messages.0.editableSeconds', 0);
    }

    public function test_customer_retracts_own_message_and_the_text_is_never_returned_again(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);

        $first = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Pesan pertama'])->assertStatus(201)->json('data.message.id');
        $second = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Nomor rekening rahasia 123'])->assertStatus(201)->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();
        $this->assertSame(2, $conversation->admin_unread);

        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 1);

        // Customer menarik pesan terakhir yang belum dibaca admin.
        $this->switchUser();
        $retract = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$second.'/retract')
            ->assertOk()
            ->assertJsonPath('data.message.id', $second)
            ->assertJsonPath('data.message.retracted', true)
            ->assertJsonPath('data.message.body', '')
            ->assertJsonPath('data.message.context', null)
            ->assertJsonPath('data.message.editableSeconds', 0)
            ->assertJsonPath('data.conversation.revision', 3);
        $this->assertNotNull($retract->json('data.message.retractedAt'));
        $this->assertStringNotContainsString('rahasia', json_encode($retract->json()));

        // Barisnya tetap ada di database (chat tidak bisa dihapus), hanya ditandai.
        $this->assertSame(2, ChatMessage::count());
        $row = ChatMessage::findOrFail($second);
        $this->assertNotNull($row->retracted_at);
        $this->assertSame('Nomor rekening rahasia 123', $row->body);

        // Penghitung belum-dibaca admin turun satu, dan pratinjau daftar tidak menyisakan isi pesan yang ditarik.
        $this->assertSame(1, $conversation->fresh()->admin_unread);
        $this->switchUser();
        $list = $this->actingAs($admin)->getJson('/api/v1/admin/chats')
            ->assertOk()
            ->assertJsonPath('data.0.unread', 1)
            ->assertJsonPath('data.0.lastMessagePreview', null)
            ->assertJsonPath('data.0.lastMessageRetracted', true);
        $this->assertStringNotContainsString('rahasia', json_encode($list->json()));

        // Admin: muatan penuh dan polling perubahan sama-sama tanpa isi; pesan tetap ada sebagai placeholder.
        $thread = $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonCount(2, 'data.messages')
            ->assertJsonPath('data.messages.0.body', 'Pesan pertama')
            ->assertJsonPath('data.messages.1.id', $second)
            ->assertJsonPath('data.messages.1.retracted', true)
            ->assertJsonPath('data.messages.1.body', '');
        $this->assertStringNotContainsString('rahasia', json_encode($thread->json()));
        $poll = $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$second.'&rev=2')
            ->assertOk()->assertJsonCount(0, 'data.messages')->assertJsonCount(1, 'data.changed')
            ->assertJsonPath('data.changed.0.id', $second)
            ->assertJsonPath('data.changed.0.retracted', true)
            ->assertJsonPath('data.changed.0.body', '');
        $this->assertStringNotContainsString('rahasia', json_encode($poll->json()));

        // Menarik atau mengedit pesan yang sudah ditarik → 409.
        $this->switchUser();
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$second.'/retract')->assertStatus(409)->assertJsonPath('code', 'CHAT_MESSAGE_RETRACTED');
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$second, ['body' => 'Ubah'])->assertStatus(409)->assertJsonPath('code', 'CHAT_MESSAGE_RETRACTED');

        // Pesan pertama juga ditarik: tidak ada lagi yang belum dibaca, badge admin 0.
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$first.'/retract')->assertOk();
        $this->assertSame(0, $conversation->fresh()->admin_unread);
        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/badges')->assertOk()->assertJsonPath('data.chat', 0);
        $this->assertSame(2, ChatMessage::count());
    }

    public function test_retracting_a_message_the_other_side_already_read_keeps_the_unread_count(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);

        $read = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Sudah dibaca admin'])->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();
        $this->switchUser();
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/read')->assertOk();

        $this->switchUser();
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Belum dibaca admin'])->assertStatus(201);
        $this->assertSame(1, $conversation->fresh()->admin_unread);

        // Pesan lama (sudah dibaca) ditarik: penghitung tetap 1, pratinjau tetap pesan terakhir.
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$read.'/retract')->assertOk();
        $fresh = $conversation->fresh();
        $this->assertSame(1, $fresh->admin_unread);
        $this->assertSame('Belum dibaca admin', $fresh->last_message_preview);
    }

    public function test_admin_edits_and_retracts_only_their_own_messages_and_customer_poll_receives_the_change(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat'], ['name' => 'Admin Satu']);
        $other = $this->adminWith(['chat'], ['name' => 'Admin Dua']);

        $question = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Berapa harga per kg?'])->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();

        $this->switchUser();
        $reply = $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Rp 12.000 per kg.'])
            ->assertStatus(201)
            ->assertJsonPath('data.message.editableSeconds', 60)
            ->assertJsonPath('data.conversation.revision', 2)
            ->json('data.message.id');
        $this->assertSame(1, $conversation->fresh()->customer_unread);
        // Pesan customer bukan milik admin: 403. Pesan percakapan lain: 404.
        $this->actingAs($admin)->putJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$question, ['body' => 'Ubah'])
            ->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$question.'/retract')->assertStatus(403);
        $elsewhere = ChatConversation::create(['user_id' => $this->customer(['email' => 'lain@example.com'])->id]);
        $this->actingAs($admin)->putJson('/api/v1/admin/chats/'.$elsewhere->id.'/messages/'.$reply, ['body' => 'Ubah'])->assertStatus(404);
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$elsewhere->id.'/messages/'.$reply.'/retract')->assertStatus(404);

        // Admin lain tidak boleh menyentuh pesan rekannya, dan tidak melihat tombol edit (editableSeconds 0).
        $this->switchUser();
        $this->actingAs($other)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonPath('data.messages.1.id', $reply)->assertJsonPath('data.messages.1.editableSeconds', 0);
        $this->actingAs($other)->putJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$reply, ['body' => 'Diubah admin lain'])
            ->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
        $this->actingAs($other)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$reply.'/retract')->assertStatus(403);
        // Admin tanpa modul chat ditolak middleware.
        $this->switchUser();
        $this->actingAs($this->adminWith(['orders']))->putJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$reply, ['body' => 'Ubah'])->assertStatus(403);

        // Pengirimnya sendiri boleh mengedit; customer menerima perubahan lewat polling dan nama admin tetap disembunyikan.
        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonPath('data.messages.1.editableSeconds', 60);
        $this->actingAs($admin)->putJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$reply, ['body' => 'Rp 12.500 per kg.'])
            ->assertOk()
            ->assertJsonPath('data.message.body', 'Rp 12.500 per kg.')
            ->assertJsonPath('data.message.senderName', 'Admin Satu')
            ->assertJsonPath('data.conversation.revision', 3)
            ->assertJsonPath('data.conversation.lastMessagePreview', 'Rp 12.500 per kg.');
        $this->switchUser();
        $poll = $this->actingAs($customer)->getJson('/api/v1/customer/chat?after='.$reply.'&rev=2')
            ->assertOk()->assertJsonCount(0, 'data.messages')->assertJsonCount(1, 'data.changed')
            ->assertJsonPath('data.changed.0.id', $reply)
            ->assertJsonPath('data.changed.0.body', 'Rp 12.500 per kg.')
            ->assertJsonPath('data.changed.0.senderName', null)
            ->assertJsonPath('data.changed.0.editableSeconds', 0)
            ->assertJsonPath('data.conversation.revision', 3);
        $this->assertNotNull($poll->json('data.changed.0.editedAt'));
        // Customer tidak boleh mengubah pesan admin di percakapannya sendiri.
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$reply, ['body' => 'Ubah'])->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$reply.'/retract')->assertStatus(403);

        // Admin menarik balasannya yang belum dibaca customer: penghitung customer turun, isi tidak lagi dikirim.
        $this->switchUser();
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$reply.'/retract')
            ->assertOk()->assertJsonPath('data.message.retracted', true)->assertJsonPath('data.message.body', '')
            ->assertJsonPath('data.conversation.lastMessageRetracted', true);
        $this->assertSame(0, $conversation->fresh()->customer_unread);
        $this->switchUser();
        $this->actingAs($customer)->getJson('/api/v1/customer/badges')->assertOk()->assertJsonPath('data.chat', 0);
        $after = $this->actingAs($customer)->getJson('/api/v1/customer/chat?after='.$reply.'&rev=3')
            ->assertOk()->assertJsonCount(1, 'data.changed')
            ->assertJsonPath('data.changed.0.retracted', true)
            ->assertJsonPath('data.changed.0.body', '');
        $this->assertStringNotContainsString('12.500', json_encode($after->json()));
        $this->assertStringNotContainsString('12.500', json_encode($this->actingAs($customer)->getJson('/api/v1/customer/chat')->json()));

        // Lewat jendela: admin pun ditolak.
        $this->switchUser();
        $late = $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Stok tersedia.'])->json('data.message.id');
        $this->travel(61)->seconds();
        $this->actingAs($admin)->putJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$late, ['body' => 'Terlambat'])
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
        $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages/'.$late.'/retract')
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
        $this->assertSame(3, ChatMessage::count());
    }

    public function test_guest_edits_and_retracts_by_token_inside_the_window(): void
    {
        $admin = $this->adminWith(['chat']);

        $start = $this->postJson('/api/v1/chat/guest', ['name' => 'Rina Hasibuan', 'email' => 'rina@example.com', 'body' => 'Halo, ada harga grosr?'])
            ->assertStatus(201)->assertJsonPath('data.message.editableSeconds', 60);
        $token = $start->json('data.token');
        $first = $start->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();

        // Tamu lain (token berbeda) tidak bisa menyentuh pesan itu; token salah → 404.
        $otherToken = $this->postJson('/api/v1/chat/guest', ['name' => 'Tamu Lain', 'email' => 'lain@example.com', 'body' => 'Pesan tamu lain'])->json('data.token');
        $this->putJson('/api/v1/chat/guest/messages/'.$first, ['token' => $otherToken, 'body' => 'Dibajak'])->assertStatus(404);
        $this->postJson('/api/v1/chat/guest/messages/'.$first.'/retract', ['token' => $otherToken])->assertStatus(404);
        $this->putJson('/api/v1/chat/guest/messages/'.$first, ['token' => 'salah', 'body' => 'Dibajak'])->assertStatus(404);
        $this->putJson('/api/v1/chat/guest/messages/'.$first, ['body' => 'Tanpa token'])->assertStatus(422)->assertJsonValidationErrors(['token']);
        $this->putJson('/api/v1/chat/guest/messages/'.$first, ['token' => $token])->assertStatus(422)->assertJsonValidationErrors(['body']);

        $this->putJson('/api/v1/chat/guest/messages/'.$first, ['token' => $token, 'body' => 'Halo, ada harga grosir?'])
            ->assertOk()
            ->assertJsonPath('data.message.body', 'Halo, ada harga grosir?')
            ->assertJsonPath('data.message.senderName', 'Rina Hasibuan')
            ->assertJsonPath('data.conversation.revision', 2);

        // Admin membalas; tamu tidak boleh mengubah pesan admin.
        $reply = $this->actingAs($admin)->postJson('/api/v1/admin/chats/'.$conversation->id.'/messages', ['body' => 'Ada, mulai 100 pcs.'])->json('data.message.id');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$first.'&rev=1')
            ->assertOk()->assertJsonCount(1, 'data.changed')->assertJsonPath('data.changed.0.body', 'Halo, ada harga grosir?');
        $this->switchUser();
        $this->putJson('/api/v1/chat/guest/messages/'.$reply, ['token' => $token, 'body' => 'Ubah'])->assertStatus(403);

        // Tamu mengirim lalu menarik pesan; polling tamu sendiri dan admin sama-sama melihat placeholder.
        $second = $this->postJson('/api/v1/chat/guest/messages', ['token' => $token, 'body' => 'Salah kirim'])->assertStatus(201)->json('data.message.id');
        $this->postJson('/api/v1/chat/guest/messages/'.$second.'/retract', ['token' => $token])
            ->assertOk()->assertJsonPath('data.message.retracted', true)->assertJsonPath('data.message.body', '');
        $thread = $this->getJson('/api/v1/chat/guest?token='.$token)
            ->assertOk()->assertJsonCount(3, 'data.messages')->assertJsonPath('data.messages.2.retracted', true);
        $this->assertStringNotContainsString('Salah kirim', json_encode($thread->json()));
        $this->assertSame(0, $conversation->fresh()->admin_unread);
        $this->assertSame(4, ChatMessage::count());

        // Lewat jendela → 409.
        $third = $this->postJson('/api/v1/chat/guest/messages', ['token' => $token, 'body' => 'Pesan ketiga'])->json('data.message.id');
        $this->travel(61)->seconds();
        $this->putJson('/api/v1/chat/guest/messages/'.$third, ['token' => $token, 'body' => 'Terlambat'])
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
        $this->postJson('/api/v1/chat/guest/messages/'.$third.'/retract', ['token' => $token])
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
    }

    public function test_ownership_is_checked_across_customers_and_the_window_follows_config(): void
    {
        $budi = $this->customer(['email' => 'budi@example.com']);
        $siti = $this->customer(['email' => 'siti@example.com']);

        $budiMessage = $this->actingAs($budi)->postJson('/api/v1/customer/chat/messages', ['body' => 'Pesan Budi'])->json('data.message.id');

        // Customer tanpa percakapan, atau pesan percakapan customer lain → 404.
        $this->switchUser();
        $this->actingAs($siti)->putJson('/api/v1/customer/chat/messages/'.$budiMessage, ['body' => 'Dibajak'])->assertStatus(404);
        $this->actingAs($siti)->postJson('/api/v1/customer/chat/messages', ['body' => 'Pesan Siti'])->assertStatus(201);
        $this->actingAs($siti)->putJson('/api/v1/customer/chat/messages/'.$budiMessage, ['body' => 'Dibajak'])->assertStatus(404);
        $this->actingAs($siti)->postJson('/api/v1/customer/chat/messages/'.$budiMessage.'/retract')->assertStatus(404);
        $this->assertSame('Pesan Budi', ChatMessage::findOrFail($budiMessage)->body);
        $this->assertNull(ChatMessage::findOrFail($budiMessage)->retracted_at);

        // Tanpa login → 401.
        $this->switchUser();
        $this->putJson('/api/v1/customer/chat/messages/'.$budiMessage, ['body' => 'Anonim'])->assertStatus(401);

        // Jendela mengikuti konfigurasi: 10 detik → detik ke-11 ditolak; payload memberi tahu FE nilainya.
        config(['ikn.chat.edit_window_seconds' => 10]);
        $this->actingAs($budi)->getJson('/api/v1/customer/chat')
            ->assertOk()->assertJsonPath('data.editWindowSeconds', 10)->assertJsonPath('data.messages.0.editableSeconds', 10);
        $this->travel(11)->seconds();
        $this->actingAs($budi)->putJson('/api/v1/customer/chat/messages/'.$budiMessage, ['body' => 'Terlambat'])
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED')->assertJsonPath('meta.windowSeconds', 10);
    }

    public function test_window_zero_disables_edit_and_retract_even_in_the_same_second(): void
    {
        config(['ikn.chat.edit_window_seconds' => 0]);
        $this->travelTo(now()->startOfSecond());
        $customer = $this->customer();
        $id = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Halo'])
            ->assertStatus(201)->assertJsonPath('data.message.editableSeconds', 0)->json('data.message.id');

        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$id, ['body' => 'Ubah'])
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$id.'/retract')
            ->assertStatus(409)->assertJsonPath('code', 'CHAT_EDIT_WINDOW_PASSED');
        $this->assertSame('Halo', ChatMessage::findOrFail($id)->body);
    }

    public function test_guest_messages_merged_on_claim_reach_an_open_admin_thread_through_change_sync(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);

        // Pesan tamu dibuat lebih dulu (id lebih kecil), lalu akun yang sama menulis dari percakapan akunnya.
        $token = $this->postJson('/api/v1/chat/guest', ['name' => 'Budi', 'email' => 'budi@example.com', 'body' => 'Pesan sebagai tamu'])->json('data.token');
        $guestMessage = ChatMessage::max('id');
        $own = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'Pesan dari akun'])->json('data.message.id');
        $conversation = ChatConversation::where('user_id', $customer->id)->firstOrFail();

        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id)
            ->assertOk()->assertJsonCount(1, 'data.messages')->assertJsonPath('data.conversation.revision', 1);

        // Klaim memindahkan pesan tamu ke percakapan akun; id-nya lebih kecil dari `after` milik admin, jadi hanya
        // bisa sampai lewat `changed`.
        $this->switchUser();
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/claim', ['token' => $token])->assertOk()->assertJsonPath('data.claimed', true);
        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$own.'&rev=1')
            ->assertOk()->assertJsonCount(0, 'data.messages')->assertJsonCount(1, 'data.changed')
            ->assertJsonPath('data.changed.0.id', $guestMessage)
            ->assertJsonPath('data.changed.0.body', 'Pesan sebagai tamu')
            ->assertJsonPath('data.conversation.revision', 2);
        $this->assertSame(2, ChatMessage::count());
    }

    public function test_change_sync_only_returns_changes_newer_than_the_client_revision(): void
    {
        $customer = $this->customer();
        $admin = $this->adminWith(['chat']);

        $a = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'A'])->json('data.message.id');
        $b = $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages', ['body' => 'B'])->json('data.message.id');
        $conversation = ChatConversation::firstOrFail();

        // Klien admin memegang pesan A saja (after=A, rev=1): B datang sebagai pesan baru, bukan perubahan.
        $this->switchUser();
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$a.'&rev=1')
            ->assertOk()->assertJsonCount(1, 'data.messages')->assertJsonPath('data.messages.0.id', $b)
            ->assertJsonCount(0, 'data.changed')->assertJsonPath('data.conversation.revision', 2);

        // A diedit (rev 3) dan B ditarik (rev 4).
        $this->switchUser();
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$a, ['body' => 'A baru'])->assertOk();
        $this->actingAs($customer)->postJson('/api/v1/customer/chat/messages/'.$b.'/retract')->assertOk()->assertJsonPath('data.conversation.revision', 4);
        // Mengedit dengan isi yang sama tidak menaikkan revisi dan tidak menambah tanda.
        $this->actingAs($customer)->putJson('/api/v1/customer/chat/messages/'.$a, ['body' => 'A baru'])->assertOk()->assertJsonPath('data.conversation.revision', 4);

        $this->switchUser();
        // Klien di revisi 2 menerima keduanya; klien di revisi 3 hanya penarikan; tanpa rev tidak ada daftar perubahan.
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$b.'&rev=2')
            ->assertOk()->assertJsonCount(0, 'data.messages')->assertJsonCount(2, 'data.changed')
            ->assertJsonPath('data.changed.0.id', $a)->assertJsonPath('data.changed.0.body', 'A baru')
            ->assertJsonPath('data.changed.1.id', $b)->assertJsonPath('data.changed.1.retracted', true)
            ->assertJsonPath('data.conversation.revision', 4);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$b.'&rev=3')
            ->assertOk()->assertJsonCount(1, 'data.changed')->assertJsonPath('data.changed.0.id', $b);
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$b)
            ->assertOk()->assertJsonCount(0, 'data.changed');
        $this->actingAs($admin)->getJson('/api/v1/admin/chats/'.$conversation->id.'?after='.$b.'&rev=-1')->assertStatus(422);
    }
}
