<?php

namespace App\Services\Chat;

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
 */
class ChatService
{
    public const PAGE_SIZE = 50;

    public const GUEST_TOKEN_LENGTH = 48;

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
     */
    public function claim(ChatConversation $guest, User $customer): ChatConversation
    {
        return DB::transaction(function () use ($guest, $customer) {
            $existing = ChatConversation::where('user_id', $customer->id)->first();
            if (! $existing) {
                $guest->forceFill(['user_id' => $customer->id, 'guest_token' => null])->save();

                return $guest->fresh();
            }

            ChatMessage::where('conversation_id', $guest->id)->update(['conversation_id' => $existing->id]);
            ChatConversation::whereKey($existing->id)->update([
                'customer_unread' => DB::raw('customer_unread + '.(int) $guest->customer_unread),
                'admin_unread' => DB::raw('admin_unread + '.(int) $guest->admin_unread),
                'last_message_preview' => $guest->last_message_at && (! $existing->last_message_at || $guest->last_message_at->gt($existing->last_message_at))
                    ? $guest->last_message_preview : $existing->last_message_preview,
                'last_sender_role' => $guest->last_message_at && (! $existing->last_message_at || $guest->last_message_at->gt($existing->last_message_at))
                    ? $guest->last_sender_role : $existing->last_sender_role,
                'last_message_at' => $guest->last_message_at && (! $existing->last_message_at || $guest->last_message_at->gt($existing->last_message_at))
                    ? $guest->last_message_at : $existing->last_message_at,
            ]);
            $guest->delete();

            return $existing->fresh();
        });
    }

    /** @param  array|null  $context  hasil resolveContext(); $sender null = tamu */
    public function send(ChatConversation $conversation, ?User $sender, string $role, string $body, ?array $context = null): ChatMessage
    {
        $body = trim($body);

        return DB::transaction(function () use ($conversation, $sender, $role, $body, $context) {
            $message = ChatMessage::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender?->id,
                'sender_role' => $role,
                'body' => $body,
                'context' => $context,
            ]);

            // Pengirim dianggap sudah membaca pesan lawan; penghitung lawan naik satu (atomik di DB).
            $theirs = $role === ChatMessage::ROLE_CUSTOMER ? 'admin_unread' : 'customer_unread';
            $mine = $role === ChatMessage::ROLE_CUSTOMER ? 'customer_unread' : 'admin_unread';
            ChatConversation::whereKey($conversation->id)->update([
                $theirs => DB::raw($theirs.' + 1'),
                $mine => 0,
                'last_message_preview' => Str::limit(preg_replace('/\s+/u', ' ', $body), 150),
                'last_sender_role' => $role,
                'last_message_at' => now(),
            ]);

            $message->setRelation('sender', $sender);

            return $message->setRelation('conversation', $conversation);
        });
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
            return [$query->where('id', '>', $after)->orderBy('id')->limit(200)->get(), false];
        }

        $rows = $query->when($before !== null, fn ($q) => $q->where('id', '<', $before))
            ->orderByDesc('id')->limit(self::PAGE_SIZE + 1)->get();
        $hasMore = $rows->count() > self::PAGE_SIZE;

        return [$rows->take(self::PAGE_SIZE)->reverse()->values(), $hasMore];
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
                'price' => $product->effectivePrice(),
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
        ];
    }

    /**
     * Bentuk pesan di JSON. Nama admin hanya ditampilkan ke admin; customer melihat penjual sebagai satu pihak.
     * Pesan tamu (sender null) memakai nama dari formulir tamu.
     */
    public function presentMessage(ChatMessage $message, bool $forAdmin, ?string $guestName = null): array
    {
        $showName = $forAdmin || $message->sender_role === ChatMessage::ROLE_CUSTOMER;
        $name = null;
        if ($showName) {
            $name = $message->relationLoaded('sender') && $message->sender ? $message->sender->name : null;
            if ($name === null && $message->sender_role === ChatMessage::ROLE_CUSTOMER) {
                $name = $guestName;
            }
        }

        return [
            'id' => $message->id,
            'role' => $message->sender_role,
            'body' => $message->body,
            'context' => $message->context,
            'senderName' => $name,
            'createdAt' => optional($message->created_at)->toApiString(),
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
        ];
    }

    /** Bentuk percakapan untuk kotak masuk admin (butuh with('customer.profile')); tamu → `guest` terisi, `customer` null. */
    public function presentForAdmin(ChatConversation $conversation): array
    {
        $customer = $conversation->customer;

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
            'lastSenderRole' => $conversation->last_sender_role,
            'lastMessageAt' => optional($conversation->last_message_at)->toApiString(),
            'createdAt' => optional($conversation->created_at)->toApiString(),
        ];
    }

    /** Jumlah percakapan yang punya pesan customer belum dibaca (badge sidebar admin). */
    public function adminUnreadConversations(): int
    {
        return ChatConversation::where('admin_unread', '>', 0)->count();
    }
}
