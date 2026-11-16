<?php

namespace App\Http\Controllers\Api\V1\Customer;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Chat\EditChatMessageRequest;
use App\Http\Requests\Chat\SendChatMessageRequest;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Services\Chat\ChatService;
use Illuminate\Http\Request;

// Live chat sisi customer (ASUMSI A-73): satu percakapan dengan penjual, dibuat saat pesan pertama dikirim.
// Customer tidak bisa menghapus atau mengarsipkan percakapannya; ia hanya bisa mengedit/menarik pesannya sendiri
// selama jendela edit (ASUMSI A-99).
class ChatController extends ApiController
{
    public function __construct(private ChatService $chat)
    {
    }

    /**
     * Tanpa parameter = halaman pesan terbaru. ?before={id} = halaman lebih lama. ?after={id}&rev={revisi} =
     * polling: pesan baru + `changed` (pesan lama yang diedit/ditarik sejak revisi itu).
     */
    public function show(Request $request)
    {
        $query = $request->validate([
            'after' => ['nullable', 'integer', 'min:0'],
            'before' => ['nullable', 'integer', 'min:1'],
            'rev' => ['nullable', 'integer', 'min:0'],
        ]);

        $conversation = $this->chat->find($request->user());
        if (! $conversation) {
            return $this->data($this->chat->emptyThread());
        }

        return $this->data(
            ['conversation' => $this->chat->presentForCustomer($conversation)]
            + $this->chat->threadPayload($conversation, $query, false)
        );
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

    /** Edit pesan sendiri selama jendela edit; lewat batas → 409 CHAT_EDIT_WINDOW_PASSED. */
    public function update(EditChatMessageRequest $request, $message)
    {
        $conversation = $this->conversation($request);
        $edited = $this->chat->edit(
            $this->chat->ownMessage($conversation, (int) $message, ChatMessage::ROLE_CUSTOMER),
            $request->validated()['body']
        );

        return $this->changed($conversation, $edited);
    }

    /** Tarik pesan sendiri selama jendela edit; pesan tetap tampil sebagai "Pesan ditarik". */
    public function retract(Request $request, $message)
    {
        $conversation = $this->conversation($request);
        $retracted = $this->chat->retract($this->chat->ownMessage($conversation, (int) $message, ChatMessage::ROLE_CUSTOMER));

        return $this->changed($conversation, $retracted);
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

    private function conversation(Request $request): ChatConversation
    {
        $conversation = $this->chat->find($request->user());
        if (! $conversation) {
            throw ApiException::notFound();
        }

        return $conversation;
    }

    private function changed(ChatConversation $conversation, ChatMessage $message)
    {
        return $this->data([
            'conversation' => $this->chat->presentForCustomer($conversation->fresh()),
            'message' => $this->chat->presentMessage($message, false),
        ]);
    }
}
