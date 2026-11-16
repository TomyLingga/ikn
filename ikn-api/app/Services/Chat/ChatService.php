<?php

namespace App\Services\Chat;

use App\Exceptions\ApiException;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Satu pintu live chat customer ↔ admin (ASUMSI A-73). Satu percakapan per customer; penghitung belum-dibaca
 * dan pratinjau pesan terakhir disimpan di percakapan agar badge dan daftar kotak masuk murah.
 * Pembaruan di FE lewat polling `?after={id pesan terakhir}`; tidak ada websocket.
 * Pengunjung yang belum login (tamu) mengisi nama/email/telepon dulu; percakapannya dikenali lewat guest_token
 * acak yang disimpan browser, dan bisa diambil alih akunnya setelah login (claim).
 *
 * ASUMSI A-99: pengirim boleh mengedit atau menarik pesannya sendiri selama `ikn.chat.edit_window_seconds`.
 * Tidak ada pesan atau percakapan yang dihapus: pesan yang ditarik tetap tersimpan (retracted_at) dan API tidak
 * lagi mengirim isinya; percakapan hanya bisa diarsipkan admin. Setiap kirim/edit/tarik menaikkan `revision`
 * percakapan dan mencatatnya pada pesan yang berubah, sehingga polling `?after=&rev=` juga membawa pesan lama
 * yang diedit atau ditarik (`changed`).
 */
class ChatService
{
    /** Pesan per halaman: muatan awal dan tiap halaman `before`. */
    public const PAGE_SIZE = 30;

    /** Batas pesan per polling (`after`) dan per daftar perubahan (`changed`). */
    public const SYNC_LIMIT = 200;

    public const GUEST_TOKEN_LENGTH = 48;

    /** Lama (detik) pesan masih boleh diedit/ditarik pengirimnya; 0 = fitur dimatikan. */
    public static function editWindowSeconds(): int
    {
        return max(0, (int) config('ikn.chat.edit_window_seconds', 60));
    }

    public function find(User $customer): ?ChatConversation
    {
        return ChatConversation::where('user_id', $customer->id)->first();
    }

    public function conversationFor(User $customer): ChatConversation
    {
        try {
            return ChatConversation::firstOrCreate(['user_id' => $customer->id]);
        } catch (QueryException $e) {
            // Dua request pertama bersamaan: unique(user_id) menolak salah satunya, ambil yang sudah ada.
            return ChatConversation::where('user_id', $customer->id)->firstOrFail();
        }
    }

    public function findGuest(string $token): ?ChatConversation
    {
        return $token === '' ? null : ChatConversation::whereNull('user_id')->where('guest_token', $token)->first();
    }

    /** Percakapan baru untuk tamu; token dikembalikan sekali kepada browser tamu (kolom hidden di JSON). */
    public function startGuest(array $guest): ChatConversation
    {
        return ChatConversation::create([
            'user_id' => null,
            'guest_token' => Str::random(self::GUEST_TOKEN_LENGTH),
            'guest_name' => trim((string) Arr::get($guest, 'name')),
            'guest_email' => strtolower(trim((string) Arr::get($guest, 'email'))),
            'guest_phone' => trim((string) Arr::get($guest, 'phone')) ?: null,
        ]);
    }

    /**
     * Tamu yang kemudian login: percakapan tamunya menjadi milik akun bila akun itu belum punya percakapan;
     * bila sudah punya, pesan tamu dipindahkan ke percakapan akun. Mengembalikan percakapan akun.
     * Baris percakapan tamu yang sudah kosong dilepas setelah pesannya dipindahkan; tidak ada pesan yang hilang.
     */
    public function claim(ChatConversation $guest, User $customer): ChatConversation
    {
        return DB::transaction(function () use ($guest, $customer) {
            $existing = ChatConversation::where('user_id', $customer->id)->lockForUpdate()->first();
            if (! $existing) {
                $guest->forceFill(['user_id' => $customer->id, 'guest_token' => null])->save();

                return $guest->fresh();
            }

            // Pesan pindahan diberi revisi baru agar admin yang sedang membuka percakapan akun menerimanya lewat `changed`.
            $revision = max((int) $existing->revision, (int) $guest->revision) + 1;
            $guestIsNewer = $guest->last_message_at && (! $existing->last_message_at || $guest->last_message_at->gt($existing->last_message_at));

            ChatMessage::where('conversation_id', $guest->id)->update(['conversation_id' => $existing->id, 'revision' => $revision]);
            $update = [
                'customer_unread' => DB::raw('customer_unread + '.(int) $guest->customer_unread),
                'admin_unread' => DB::raw('admin_unread + '.(int) $guest->admin_unread),
                'revision' => $revision,
                'last_message_preview' => $guestIsNewer ? $guest->last_message_preview : $existing->last_message_preview,
                'last_sender_role' => $guestIsNewer ? $guest->last_sender_role : $existing->last_sender_role,
                'last_message_at' => $guestIsNewer ? $guest->last_message_at : $existing->last_message_at,
            ];
            if (! $guest->isArchived()) {
                // Pesan tamu yang masih aktif tidak boleh tersembunyi di arsip percakapan akun.
                $update['archived_at'] = null;
                $update['archived_by'] = null;
            }
            ChatConversation::whereKey($existing->id)->update($update);
            $guest->delete();

            return $existing->fresh();
        });
    }

    /** @param  array|null  $context  hasil resolveContext(); $sender null = tamu */
    public function send(ChatConversation $conversation, ?User $sender, string $role, string $body, ?array $context = null): ChatMessage
    {
        $body = trim($body);

        return DB::transaction(function () use ($conversation, $sender, $role, $body, $context) {
            $revision = (int) $this->lockConversation($conversation->id)->revision + 1;

            $message = ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender?->id,
                'sender_role' => $role,
                'body' => $body,
                'context' => $context,
                'revision' => $revision,
            ]);

            // Pengirim dianggap sudah membaca pesan lawan; penghitung lawan naik satu (atomik di DB).
            $theirs = $role === ChatMessage::ROLE_CUSTOMER ? 'admin_unread' : 'customer_unread';
            $mine = $role === ChatMessage::ROLE_CUSTOMER ? 'customer_unread' : 'admin_unread';
            $update = [
                $theirs => DB::raw($theirs.' + 1'),
                $mine => 0,
                'revision' => $revision,
                'last_message_preview' => $this->preview($body),
                'last_sender_role' => $role,
                'last_message_at' => now(),
            ];
            if ($role === ChatMessage::ROLE_CUSTOMER) {
                // Pesan baru dari customer/tamu mengeluarkan percakapan dari arsip; balasan admin tidak.
                $update['archived_at'] = null;
                $update['archived_by'] = null;
            }
            ChatConversation::whereKey($conversation->id)->update($update);

            $message->setRelation('sender', $sender);

            return $message->setRelation('conversation', $conversation);
        });
    }

    /**
     * Pesan di percakapan ini yang boleh diubah pemanggil: customer/tamu = pesan sisi customer di percakapannya,
     * admin = hanya pesan yang ia kirim sendiri.
     *
     * @throws ApiException 404 bila pesan bukan bagian percakapan ini, 403 bila pesan milik pihak lain
     */
    public function ownMessage(ChatConversation $conversation, int $messageId, string $role, ?User $admin = null): ChatMessage
    {
        $message = ChatMessage::with('sender')->where('conversation_id', $conversation->id)->whereKey($messageId)->first();
        if (! $message) {
            throw ApiException::notFound();
        }
        if (! $this->isOwn($message, $role === ChatMessage::ROLE_ADMIN, $admin)) {
            throw ApiException::forbidden(__('notifications.chat_message_not_yours'));
        }

        return $message;
    }

    /**
     * Ubah isi pesan selama jendela edit masih terbuka. Isi sebelumnya disimpan di edit_history.
     *
     * @throws ApiException 409 CHAT_EDIT_WINDOW_PASSED | CHAT_MESSAGE_RETRACTED
     */
    public function edit(ChatMessage $message, string $body): ChatMessage
    {
        $body = trim($body);

        return DB::transaction(function () use ($message, $body) {
            $revision = (int) $this->lockConversation($message->conversation_id)->revision + 1;
            $message->refresh();
            $this->assertChangeable($message);

            if ($message->body === $body) {
                return $message; // tidak ada yang berubah: tanpa tanda "diedit", tanpa revisi baru
            }

            $history = $message->edit_history ?? [];
            $history[] = ['body' => $message->body, 'at' => now()->toIso8601String()];
            $message->forceFill(['body' => $body, 'edited_at' => now(), 'edit_history' => $history, 'revision' => $revision])->save();

            $update = ['revision' => $revision];
            if ($this->isLatest($message)) {
                $update['last_message_preview'] = $this->preview($body);
            }
            ChatConversation::whereKey($message->conversation_id)->update($update);

            return $message;
        });
    }

    /**
     * Tarik pesan selama jendela edit masih terbuka. Barisnya tetap ada (retracted_at); API tidak lagi mengirim
     * isinya. Bila pesan itu belum dibaca lawan, penghitung belum-dibaca lawan turun satu; bila itu pesan terakhir,
     * pratinjau percakapan dikosongkan (daftar admin menampilkan "Pesan ditarik").
     *
     * @throws ApiException 409 CHAT_EDIT_WINDOW_PASSED | CHAT_MESSAGE_RETRACTED
     */
    public function retract(ChatMessage $message): ChatMessage
    {
        return DB::transaction(function () use ($message) {
            $conversation = $this->lockConversation($message->conversation_id);
            $revision = (int) $conversation->revision + 1;
            $message->refresh();
            $this->assertChangeable($message);

            $update = ['revision' => $revision];

            // Pesan belum dibaca lawan = termasuk N pesan terakhir (yang belum ditarik) dari pihak pengirim,
            // N = penghitung belum-dibaca lawan.
            $counter = $message->sender_role === ChatMessage::ROLE_CUSTOMER ? 'admin_unread' : 'customer_unread';
            $unread = (int) $conversation->{$counter};
            if ($unread > 0) {
                $newer = ChatMessage::where('conversation_id', $message->conversation_id)
                    ->where('sender_role', $message->sender_role)
                    ->whereNull('retracted_at')
                    ->where('id', '>', $message->id)
                    ->count();
                if ($newer < $unread) {
                    $update[$counter] = DB::raw('GREATEST('.$counter.' - 1, 0)');
                }
            }
            if ($this->isLatest($message)) {
                $update['last_message_preview'] = null;
            }

            $message->forceFill(['retracted_at' => now(), 'revision' => $revision])->save();
            ChatConversation::whereKey($message->conversation_id)->update($update);

            return $message;
        });
    }

    /** Arsipkan percakapan (admin). Bukan perubahan isi: revisi tidak naik. Mengarsipkan ulang tidak mengubah apa-apa. */
    public function archive(ChatConversation $conversation, User $admin): ChatConversation
    {
        if (! $conversation->isArchived()) {
            $conversation->forceFill(['archived_at' => now(), 'archived_by' => $admin->id])->save();
        }

        return $conversation;
    }

    public function unarchive(ChatConversation $conversation): ChatConversation
    {
        if ($conversation->isArchived()) {
            $conversation->forceFill(['archived_at' => null, 'archived_by' => null])->save();
        }

        return $conversation;
    }

    /** Tandai semua pesan lawan sudah dibaca oleh pihak $readerRole. */
    public function markRead(ChatConversation $conversation, string $readerRole): void
    {
        $column = $readerRole === ChatMessage::ROLE_CUSTOMER ? 'customer_unread' : 'admin_unread';
        if ((int) $conversation->{$column} === 0) {
            return;
        }
        // Tanpa menyentuh updated_at: membaca bukan perubahan isi percakapan.
        DB::table('chat_conversations')->where('id', $conversation->id)->update([$column => 0]);
        $conversation->{$column} = 0;
        $conversation->syncOriginalAttribute($column);
    }

    /**
     * Pesan urut naik. `after` = pesan lebih baru dari id itu (polling); `before` = halaman lebih lama;
     * tanpa keduanya = PAGE_SIZE pesan terakhir.
     *
     * @return array{0: Collection<int, ChatMessage>, 1: bool} [pesan, masih ada yang lebih lama]
     */
    public function messages(ChatConversation $conversation, ?int $after = null, ?int $before = null): array
    {
        $query = ChatMessage::with('sender')->where('conversation_id', $conversation->id);

        if ($after !== null) {
            return [$query->where('id', '>', $after)->orderBy('id')->limit(self::SYNC_LIMIT)->get(), false];
        }

        $rows = $query->when($before !== null, fn ($q) => $q->where('id', '<', $before))
            ->orderByDesc('id')->limit(self::PAGE_SIZE + 1)->get();
        $hasMore = $rows->count() > self::PAGE_SIZE;

        return [$rows->take(self::PAGE_SIZE)->reverse()->values(), $hasMore];
    }

    /**
     * Pesan yang berubah (diedit, ditarik, atau dipindahkan dari percakapan tamu) setelah revisi `$revision`.
     * `$upToId` membatasi pada pesan yang sudah dimiliki klien; pesan lebih baru datang lewat `after`.
     *
     * @return Collection<int, ChatMessage>
     */
    public function changedSince(ChatConversation $conversation, int $revision, ?int $upToId = null): Collection
    {
        if ($revision >= (int) $conversation->revision) {
            return collect();
        }

        return ChatMessage::with('sender')
            ->where('conversation_id', $conversation->id)
            ->where('revision', '>', $revision)
            ->when($upToId !== null, fn ($q) => $q->where('id', '<=', $upToId))
            ->orderBy('id')->limit(self::SYNC_LIMIT)->get();
    }

    /**
     * Isi respons GET utas yang sama untuk customer, tamu, dan admin: halaman pesan, tanda masih ada yang lebih
     * lama, pesan yang berubah sejak revisi klien (`rev`), dan lama jendela edit.
     *
     * `$conversation` wajib dimuat SEBELUM pemanggilan ini dan revisinya yang dikirim ke klien: perubahan yang
     * masuk setelah percakapan dibaca punya revisi lebih besar, jadi ikut pada polling berikutnya (tidak terlewat).
     *
     * @param  array  $query  nilai tervalidasi `after`, `before`, `rev` (boleh tidak ada)
     * @param  User|null  $viewer  admin yang melihat (untuk menandai pesan miliknya); null di sisi customer/tamu
     */
    public function threadPayload(ChatConversation $conversation, array $query, bool $forAdmin, ?User $viewer = null): array
    {
        $int = fn (string $key) => isset($query[$key]) && $query[$key] !== '' ? (int) $query[$key] : null;
        $after = $int('after');
        $rev = $int('rev');

        [$messages, $hasMore] = $this->messages($conversation, $after, $int('before'));
        $changed = $rev === null ? collect() : $this->changedSince($conversation, $rev, $after);
        $present = fn (ChatMessage $m) => $this->presentMessage($m, $forAdmin, $conversation->guest_name, $viewer);

        return [
            'messages' => $messages->map($present)->values()->all(),
            'hasMore' => $hasMore,
            'changed' => $changed->map($present)->values()->all(),
            'editWindowSeconds' => self::editWindowSeconds(),
        ];
    }

    /** Respons GET utas untuk customer yang belum punya percakapan. */
    public function emptyThread(): array
    {
        return ['conversation' => null, 'messages' => [], 'hasMore' => false, 'changed' => [], 'editWindowSeconds' => self::editWindowSeconds()];
    }

    /**
     * Rujukan produk/order yang dilampirkan customer pada pesan: disimpan sebagai snapshot ringkas.
     *
     * @throws ValidationException rujukan tidak ditemukan / bukan milik customer
     */
    public function resolveContext(User $customer, ?array $context): ?array
    {
        if (! $context || empty($context['type'])) {
            return null;
        }

        if ($context['type'] === ChatMessage::CONTEXT_PRODUCT) {
            $product = Product::published()->with('images.media')->where('slug', (string) ($context['slug'] ?? ''))->first();
            if (! $product) {
                throw ValidationException::withMessages(['context' => [__('notifications.chat_context_invalid')]]);
            }

            return [
                'type' => ChatMessage::CONTEXT_PRODUCT,
                'slug' => $product->slug,
                'code' => $product->code,
                'name' => $product->name,
                'image' => $product->primaryImageUrl(),
                // Harga dalam mata uang pasar customer (ASUMSI A-86): ekspor melihat USD (sen), lokal rupiah.
                'price' => $product->effectivePriceMinor($customer->currency()),
                'currency' => $customer->currency(),
                'unit' => $product->unit,
            ];
        }

        $order = Order::ownedBy($customer)->where('number', (string) ($context['number'] ?? ''))->first();
        if (! $order) {
            throw ValidationException::withMessages(['context' => [__('notifications.chat_context_invalid')]]);
        }

        return [
            'type' => ChatMessage::CONTEXT_ORDER,
            'number' => $order->number,
            'status' => $order->status,
            'grandTotal' => $order->grandTotalInt(),
            'currency' => $order->currencyCode(),
            // Keluarga serah terima (pickup|door|port) agar label status mengikuti varian Loco/pelabuhan.
            'family' => $order->shipping_snapshot['family'] ?? ($order->isPickup() ? 'pickup' : ($order->isPort() ? 'port' : null)),
        ];
    }

    /**
     * Bentuk pesan di JSON. Nama admin hanya ditampilkan ke admin; customer melihat penjual sebagai satu pihak.
     * Pesan tamu (sender null) memakai nama dari formulir tamu. Pesan yang ditarik dikirim tanpa isi dan rujukan.
     * `editableSeconds` = sisa detik pemirsa masih boleh mengedit/menarik pesan ini (0 = bukan pesannya, sudah
     * ditarik, atau lewat batas); FE menghitung tenggat dari saat respons diterima, jadi tidak bergantung jam browser.
     *
     * @param  User|null  $viewer  admin yang melihat; diabaikan di sisi customer/tamu
     */
    public function presentMessage(ChatMessage $message, bool $forAdmin, ?string $guestName = null, ?User $viewer = null): array
    {
        $showName = $forAdmin || $message->sender_role === ChatMessage::ROLE_CUSTOMER;
        $name = null;
        if ($showName) {
            $name = $message->relationLoaded('sender') && $message->sender ? $message->sender->name : null;
            if ($name === null && $message->sender_role === ChatMessage::ROLE_CUSTOMER) {
                $name = $guestName;
            }
        }
        $retracted = $message->isRetracted();

        return [
            'id' => $message->id,
            'role' => $message->sender_role,
            'body' => $retracted ? '' : $message->body,
            'context' => $retracted ? null : $message->context,
            'senderName' => $name,
            'createdAt' => optional($message->created_at)->toApiString(),
            'editedAt' => $retracted ? null : optional($message->edited_at)->toApiString(),
            'retracted' => $retracted,
            'retractedAt' => optional($message->retracted_at)->toApiString(),
            'editableSeconds' => $this->editableSeconds($message, $forAdmin, $viewer),
        ];
    }

    /** Bentuk percakapan untuk customer. */
    public function presentForCustomer(?ChatConversation $conversation): ?array
    {
        if (! $conversation) {
            return null;
        }

        return [
            'id' => $conversation->id,
            'unread' => (int) $conversation->customer_unread,
            'lastMessageAt' => optional($conversation->last_message_at)->toApiString(),
            'revision' => (int) $conversation->revision,
        ];
    }

    /** Bentuk percakapan untuk kotak masuk admin (butuh with('customer.profile', 'archiver')); tamu → `guest` terisi, `customer` null. */
    public function presentForAdmin(ChatConversation $conversation): array
    {
        $customer = $conversation->customer;
        $archiver = $conversation->archived_by ? $conversation->archiver : null;

        return [
            'id' => $conversation->id,
            'kind' => $conversation->isGuest() ? 'guest' : 'customer',
            'customer' => $customer ? [
                'id' => $customer->id,
                'name' => $customer->name,
                'company' => $customer->profile?->company,
                'email' => $customer->email,
                'status' => $customer->status,
            ] : null,
            'guest' => $conversation->isGuest() ? [
                'name' => $conversation->guest_name,
                'email' => $conversation->guest_email,
                'phone' => $conversation->guest_phone,
            ] : null,
            'unread' => (int) $conversation->admin_unread,
            'lastMessagePreview' => $conversation->last_message_preview,
            // Pesan terakhir ditarik pengirimnya: pratinjau kosong, FE menampilkan "Pesan ditarik".
            'lastMessageRetracted' => $conversation->last_message_at !== null && $conversation->last_message_preview === null,
            'lastSenderRole' => $conversation->last_sender_role,
            'lastMessageAt' => optional($conversation->last_message_at)->toApiString(),
            'createdAt' => optional($conversation->created_at)->toApiString(),
            'revision' => (int) $conversation->revision,
            'archived' => $conversation->isArchived(),
            'archivedAt' => optional($conversation->archived_at)->toApiString(),
            'archivedBy' => $archiver ? ['id' => $archiver->id, 'name' => $archiver->name] : null,
        ];
    }

    /** Jumlah percakapan aktif (tidak diarsipkan) yang punya pesan customer belum dibaca (badge sidebar admin). */
    public function adminUnreadConversations(): int
    {
        return ChatConversation::whereNull('archived_at')->where('admin_unread', '>', 0)->count();
    }

    /** Jumlah percakapan di arsip (angka tab Arsip). */
    public function archivedConversations(): int
    {
        return ChatConversation::whereNotNull('archived_at')->whereNotNull('last_message_at')->count();
    }

    /** Kunci baris percakapan sampai transaksi selesai: kirim/edit/tarik pada satu percakapan berjalan berurutan. */
    private function lockConversation(int $id): object
    {
        $row = DB::table('chat_conversations')->where('id', $id)->lockForUpdate()->first();
        if (! $row) {
            throw ApiException::notFound();
        }

        return $row;
    }

    /** @throws ApiException pesan sudah ditarik atau jendela edit sudah lewat */
    private function assertChangeable(ChatMessage $message): void
    {
        if ($message->isRetracted()) {
            throw ApiException::conflict('CHAT_MESSAGE_RETRACTED', __('notifications.chat_message_retracted'));
        }

        $window = self::editWindowSeconds();
        // Jendela 0 = fitur dimatikan: tolak juga pesan yang dikirim pada detik yang sama.
        if ($window === 0 || ! $message->created_at || $message->created_at->copy()->addSeconds($window)->lt(now())) {
            throw ApiException::conflict('CHAT_EDIT_WINDOW_PASSED', __('notifications.chat_edit_window_passed', ['seconds' => $window]), ['windowSeconds' => $window]);
        }
    }

    /** Pesan milik pemirsa: sisi customer = semua pesan customer di percakapannya; admin = pesan yang ia kirim sendiri. */
    private function isOwn(ChatMessage $message, bool $forAdmin, ?User $viewer): bool
    {
        if (! $forAdmin) {
            return $message->sender_role === ChatMessage::ROLE_CUSTOMER;
        }

        return $message->sender_role === ChatMessage::ROLE_ADMIN && $viewer !== null && (int) $message->sender_id === (int) $viewer->id;
    }

    private function editableSeconds(ChatMessage $message, bool $forAdmin, ?User $viewer): int
    {
        if ($message->isRetracted() || ! $message->created_at || ! $this->isOwn($message, $forAdmin, $viewer)) {
            return 0;
        }

        return max(0, $message->created_at->getTimestamp() + self::editWindowSeconds() - now()->getTimestamp());
    }

    private function isLatest(ChatMessage $message): bool
    {
        return ! ChatMessage::where('conversation_id', $message->conversation_id)->where('id', '>', $message->id)->exists();
    }

    private function preview(string $body): string
    {
        return Str::limit(preg_replace('/\s+/u', ' ', $body), 150);
    }
}
