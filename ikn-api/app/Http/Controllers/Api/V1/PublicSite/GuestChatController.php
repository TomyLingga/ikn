<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Chat\GuestChatRequest;
use App\Http\Requests\Chat\StartGuestChatRequest;
use App\Models\ChatMessage;
use App\Services\Chat\ChatService;

/**
 * Live chat untuk pengunjung yang belum login (ASUMSI A-73). Tamu mengisi nama/email/telepon + pesan pertama,
 * menerima `token` acak yang disimpan browsernya, lalu memakai token itu untuk membaca/mengirim pesan.
 * Token salah → 404. Setelah login, token bisa diambil alih lewat POST /customer/chat/claim.
 */
class GuestChatController extends ApiController
{
    public function __construct(private ChatService $chat)
    {
    }

    public function start(StartGuestChatRequest $request)
    {
        $data = $request->validated();
        $conversation = $this->chat->startGuest($data);
        $message = $this->chat->send($conversation, null, ChatMessage::ROLE_CUSTOMER, $data['body']);

        return $this->created([
            'token' => $conversation->guest_token,
            'conversation' => $this->chat->presentForCustomer($conversation->fresh()),
            'message' => $this->chat->presentMessage($message, false, $conversation->guest_name),
        ]);
    }

    public function show(GuestChatRequest $request)
    {
        $conversation = $this->conversation($request);
        [$messages, $hasMore] = $this->chat->messages(
            $conversation,
            $request->filled('after') ? (int) $request->query('after') : null,
            $request->filled('before') ? (int) $request->query('before') : null
        );

        return $this->data([
            'conversation' => $this->chat->presentForCustomer($conversation),
            'messages' => $messages->map(fn (ChatMessage $m) => $this->chat->presentMessage($m, false, $conversation->guest_name))->values()->all(),
            'hasMore' => $hasMore,
        ]);
    }

    public function send(GuestChatRequest $request)
    {
        $conversation = $this->conversation($request);
        $message = $this->chat->send($conversation, null, ChatMessage::ROLE_CUSTOMER, (string) $request->validated()['body']);

        return $this->created([
            'conversation' => $this->chat->presentForCustomer($conversation->fresh()),
            'message' => $this->chat->presentMessage($message, false, $conversation->guest_name),
        ]);
    }

    public function read(GuestChatRequest $request)
    {
        $this->chat->markRead($this->conversation($request), ChatMessage::ROLE_CUSTOMER);

        return $this->data(['unread' => 0]);
    }

    private function conversation(GuestChatRequest $request)
    {
        $conversation = $this->chat->findGuest($request->token());
        if (! $conversation) {
            throw ApiException::notFound();
        }

        return $conversation;
    }
}
