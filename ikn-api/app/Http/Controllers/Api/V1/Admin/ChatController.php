<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Chat\OpenChatRequest;
use App\Http\Requests\Chat\SendChatMessageRequest;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\User;
use App\Services\Chat\ChatService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

// Kotak masuk live chat admin (ASUMSI A-73), modul `chat`. Tidak lewat middleware audit: pesan chat sendiri
// adalah catatannya, dan mencatat setiap balasan akan membanjiri audit log.
class ChatController extends ApiController
{
    public function __construct(private ChatService $chat)
    {
    }

    public function index(Request $request)
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'unread' => ['nullable', 'boolean'],
        ]);

        $query = ChatConversation::with('customer.profile')
            ->whereNotNull('last_message_at')
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

    public function show(Request $request, ChatConversation $conversation)
    {
        $request->validate([
            'after' => ['nullable', 'integer', 'min:0'],
            'before' => ['nullable', 'integer', 'min:1'],
        ]);

        [$messages, $hasMore] = $this->chat->messages(
            $conversation,
            $request->filled('after') ? (int) $request->query('after') : null,
            $request->filled('before') ? (int) $request->query('before') : null
        );

        return $this->data([
            'conversation' => $this->chat->presentForAdmin($conversation->load('customer.profile')),
            'messages' => $messages->map(fn (ChatMessage $m) => $this->chat->presentMessage($m, true, $conversation->guest_name))->values()->all(),
            'hasMore' => $hasMore,
        ]);
    }

    public function send(SendChatMessageRequest $request, ChatConversation $conversation)
    {
        $message = $this->chat->send($conversation, $request->user(), ChatMessage::ROLE_ADMIN, $request->validated()['body']);

        return $this->created([
            'conversation' => $this->chat->presentForAdmin($conversation->fresh()->load('customer.profile')),
            'message' => $this->chat->presentMessage($message, true),
        ]);
    }

    public function read(ChatConversation $conversation)
    {
        $this->chat->markRead($conversation, ChatMessage::ROLE_ADMIN);

        return $this->data(['unread' => 0, 'unreadConversations' => $this->chat->adminUnreadConversations()]);
    }
}
