<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Chat\EditChatMessageRequest;
use App\Http\Requests\Chat\OpenChatRequest;
use App\Http\Requests\Chat\SendChatMessageRequest;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\Chat\ChatService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// Kotak masuk live chat admin (ASUMSI A-73), modul `chat`. Tidak lewat middleware audit: pesan chat sendiri
// adalah catatannya, dan mencatat setiap balasan akan membanjiri audit log. Pengecualian: arsip/keluarkan dari
// arsip dicatat audit (rute-nya memakai middleware audit). Tidak ada aksi hapus percakapan atau pesan (ASUMSI A-99).
class ChatController extends ApiController
{
    public function __construct(private ChatService $chat)
    {
    }

    /** Bawaan = percakapan aktif; `?archived=1` = arsip. Percakapan yang diarsipkan tidak dihitung di badge. */
    public function index(Request $request)
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'unread' => ['nullable', 'boolean'],
            'archived' => ['nullable', 'boolean'],
        ]);

        $query = ChatConversation::with(['customer.profile', 'archiver'])
            ->whereNotNull('last_message_at')
            ->when($request->boolean('archived'), fn ($q) => $q->whereNotNull('archived_at'), fn ($q) => $q->whereNull('archived_at'))
            ->when($request->boolean('unread'), fn ($q) => $q->where('admin_unread', '>', 0))
            ->when(trim((string) $request->query('q')), function ($q, $term) {
                $like = '%'.addcslashes($term, '%_\\').'%';
                $q->where(function ($w) use ($like) {
                    $w->whereHas('customer', function ($c) use ($like) {
                        $c->where('name', 'ILIKE', $like)
                            ->orWhere('email', 'ILIKE', $like)
                            ->orWhereHas('profile', fn ($p) => $p->where('company', 'ILIKE', $like));
                    })
                        ->orWhere('guest_name', 'ILIKE', $like)
                        ->orWhere('guest_email', 'ILIKE', $like)
                        ->orWhere('guest_phone', 'ILIKE', $like);
                });
            })
            ->orderByDesc('last_message_at')->orderByDesc('id');

        $paginator = $query->paginate($this->perPage(30, 100));

        return response()->json([
            'data' => collect($paginator->items())->map(fn (ChatConversation $c) => $this->chat->presentForAdmin($c))->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'perPage' => $paginator->perPage(),
                'total' => $paginator->total(),
                'lastPage' => $paginator->lastPage(),
                'unreadConversations' => $this->chat->adminUnreadConversations(),
                'archivedConversations' => $this->chat->archivedConversations(),
            ],
        ]);
    }

    /** Buka (atau buat) percakapan dengan customer tertentu, mis. dari halaman detail order/customer. */
    public function open(OpenChatRequest $request)
    {
        $customer = User::customers()->whereKey((int) $request->validated()['customerId'])->first();
        if (! $customer) {
            throw ValidationException::withMessages(['customerId' => [__('notifications.chat_customer_invalid')]]);
        }

        $conversation = $this->chat->conversationFor($customer)->load('customer.profile');

        return $this->data($this->chat->presentForAdmin($conversation));
    }

    /**
     * Tanpa parameter = halaman pesan terbaru. ?before={id} = halaman lebih lama. ?after={id}&rev={revisi} =
     * polling: pesan baru + `changed` (pesan lama yang diedit/ditarik sejak revisi itu).
     */
    public function show(Request $request, ChatConversation $conversation)
    {
        $query = $request->validate([
            'after' => ['nullable', 'integer', 'min:0'],
            'before' => ['nullable', 'integer', 'min:1'],
            'rev' => ['nullable', 'integer', 'min:0'],
        ]);

        return $this->data(
            ['conversation' => $this->chat->presentForAdmin($conversation->load('customer.profile'))]
            + $this->chat->threadPayload($conversation, $query, true, $request->user())
        );
    }

    /** Membalas percakapan yang diarsipkan diperbolehkan dan tidak mengeluarkannya dari arsip. */
    public function send(SendChatMessageRequest $request, ChatConversation $conversation)
    {
        $message = $this->chat->send($conversation, $request->user(), ChatMessage::ROLE_ADMIN, $request->validated()['body']);

        return $this->created($this->result($conversation, $message, $request->user()));
    }

    /** Edit pesan yang dikirim admin ini sendiri selama jendela edit; pesan admin lain → 403. */
    public function update(EditChatMessageRequest $request, ChatConversation $conversation, $message)
    {
        $admin = $request->user();
        $edited = $this->chat->edit(
            $this->chat->ownMessage($conversation, (int) $message, ChatMessage::ROLE_ADMIN, $admin),
            $request->validated()['body']
        );

        return $this->data($this->result($conversation, $edited, $admin));
    }

    /** Tarik pesan yang dikirim admin ini sendiri selama jendela edit; barisnya tetap tersimpan. */
    public function retract(Request $request, ChatConversation $conversation, $message)
    {
        $admin = $request->user();
        $retracted = $this->chat->retract($this->chat->ownMessage($conversation, (int) $message, ChatMessage::ROLE_ADMIN, $admin));

        return $this->data($this->result($conversation, $retracted, $admin));
    }

    public function archive(Request $request, ChatConversation $conversation)
    {
        $this->chat->archive($conversation, $request->user());

        return $this->data($this->chat->presentForAdmin($conversation->fresh()->load('customer.profile')), 200, [
            'meta' => ['unreadConversations' => $this->chat->adminUnreadConversations()],
        ]);
    }

    public function unarchive(ChatConversation $conversation)
    {
        $this->chat->unarchive($conversation);

        return $this->data($this->chat->presentForAdmin($conversation->fresh()->load('customer.profile')), 200, [
            'meta' => ['unreadConversations' => $this->chat->adminUnreadConversations()],
        ]);
    }

    public function read(ChatConversation $conversation)
    {
        $this->chat->markRead($conversation, ChatMessage::ROLE_ADMIN);

        return $this->data(['unread' => 0, 'unreadConversations' => $this->chat->adminUnreadConversations()]);
    }

    private function result(ChatConversation $conversation, ChatMessage $message, User $admin): array
    {
        return [
            'conversation' => $this->chat->presentForAdmin($conversation->fresh()->load('customer.profile')),
            'message' => $this->chat->presentMessage($message, true, $conversation->guest_name, $admin),
        ];
    }
}
