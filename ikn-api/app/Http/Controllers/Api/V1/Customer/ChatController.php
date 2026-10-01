<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Chat\SendChatMessageRequest;
use App\Models\ChatMessage;
use App\Services\Chat\ChatService;
use Illuminate\Http\Request;

// Live chat sisi customer (ASUMSI A-73): satu percakapan dengan penjual, dibuat saat pesan pertama dikirim.
class ChatController extends ApiController
{
    public function __construct(private ChatService $chat)
    {
    }

    /** ?after={id} untuk polling pesan baru, ?before={id} untuk memuat pesan lama. */
    public function show(Request $request)
    {
        $request->validate([
            'after' => ['nullable', 'integer', 'min:0'],
            'before' => ['nullable', 'integer', 'min:1'],
        ]);

        $conversation = $this->chat->find($request->user());
        if (! $conversation) {
            return $this->data(['conversation' => null, 'messages' => [], 'hasMore' => false]);
        }

        [$messages, $hasMore] = $this->chat->messages(
            $conversation,
            $request->filled('after') ? (int) $request->query('after') : null,
            $request->filled('before') ? (int) $request->query('before') : null
        );

        return $this->data([
            'conversation' => $this->chat->presentForCustomer($conversation),
            'messages' => $messages->map(fn (ChatMessage $m) => $this->chat->presentMessage($m, false))->values()->all(),
            'hasMore' => $hasMore,
        ]);
    }

    public function send(SendChatMessageRequest $request)
    {
        $user = $request->user();
        $data = $request->validated();
        $context = $this->chat->resolveContext($user, $data['context'] ?? null);

        $conversation = $this->chat->conversationFor($user);
        $message = $this->chat->send($conversation, $user, ChatMessage::ROLE_CUSTOMER, $data['body'], $context);

        return $this->created([
            'conversation' => $this->chat->presentForCustomer($conversation->fresh()),
            'message' => $this->chat->presentMessage($message, false),
        ]);
    }

    /** Tamu yang baru login: ambil alih percakapan tamunya (token dari browser) ke akun ini. */
    public function claim(Request $request)
    {
        $data = $request->validate(['token' => ['required', 'string', 'max:64']]);
        $guest = $this->chat->findGuest($data['token']);
        $conversation = $guest ? $this->chat->claim($guest, $request->user()) : $this->chat->find($request->user());

        return $this->data(['conversation' => $this->chat->presentForCustomer($conversation), 'claimed' => $guest !== null]);
    }

    public function read(Request $request)
    {
        $conversation = $this->chat->find($request->user());
        if ($conversation) {
            $this->chat->markRead($conversation, ChatMessage::ROLE_CUSTOMER);
        }

        return $this->data(['unread' => 0]);
    }
}
