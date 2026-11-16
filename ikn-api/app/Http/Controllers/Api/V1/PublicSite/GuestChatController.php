<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Chat\GuestChatRequest;
use App\Http\Requests\Chat\StartGuestChatRequest;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Services\Chat\ChatService;

/**
 * Live chat untuk pengunjung yang belum login (ASUMSI A-73). Tamu mengisi nama/email/telepon + pesan pertama,
 * menerima `token` acak yang disimpan browsernya, lalu memakai token itu untuk membaca/mengirim pesan.
 * Token salah → 404. Setelah login, token bisa diambil alih lewat POST /customer/chat/claim.
 * Tamu juga bisa mengedit/menarik pesannya sendiri selama jendela edit (ASUMSI A-99); tidak ada penghapusan.
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
            'editWindowSeconds' => ChatService::editWindowSeconds(),
        ]);
    }

    public function show(GuestChatRequest $request)
    {
        $conversation = $this->conversation($request);

        return $this->data(
            ['conversation' => $this->chat->presentForCustomer($conversation)]
            + $this->chat->threadPayload($conversation, $request->validated(), false)
        );
    }

    public function send(GuestChatRequest $request)
    {
        $conversation = $this->conversation($request);
        $message = $this->chat->send($conversation, null, ChatMessage::ROLE_CUSTOMER, (string) $request->validated()['body']);

        return $this->created($this->result($conversation, $message));
    }

    /** Edit pesan sendiri selama jendela edit; lewat batas → 409 CHAT_EDIT_WINDOW_PASSED. */
    public function update(GuestChatRequest $request, $message)
    {
        $conversation = $this->conversation($request);
        $edited = $this->chat->edit(
            $this->chat->ownMessage($conversation, (int) $message, ChatMessage::ROLE_CUSTOMER),
            (string) $request->validated()['body']
        );

        return $this->data($this->result($conversation, $edited));
    }

    /** Tarik pesan sendiri selama jendela edit; pesan tetap tampil sebagai "Pesan ditarik". */
    public function retract(GuestChatRequest $request, $message)
    {
        $conversation = $this->conversation($request);
        $retracted = $this->chat->retract($this->chat->ownMessage($conversation, (int) $message, ChatMessage::ROLE_CUSTOMER));

        return $this->data($this->result($conversation, $retracted));
    }

    public function read(GuestChatRequest $request)
    {
        $this->chat->markRead($this->conversation($request), ChatMessage::ROLE_CUSTOMER);

        return $this->data(['unread' => 0]);
    }

    private function conversation(GuestChatRequest $request): ChatConversation
    {
        $conversation = $this->chat->findGuest($request->token());
        if (! $conversation) {
            throw ApiException::notFound();
        }

        return $conversation;
    }

    private function result(ChatConversation $conversation, ChatMessage $message): array
    {
        return [
            'conversation' => $this->chat->presentForCustomer($conversation->fresh()),
            'message' => $this->chat->presentMessage($message, false, $conversation->guest_name),
        ];
    }
}
