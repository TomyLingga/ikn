<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\PublicSite\StoreContactRequest;
use App\Models\ContactMessage;

// Formulir kontak publik (ASUMSI A-22). Notifikasi email admin menyusul saat SMTP relay dikonfigurasi.
class ContactController extends ApiController
{
    public function store(StoreContactRequest $request)
    {
        $data = $request->validated();

        $message = ContactMessage::create([
            'type' => $data['type'] ?? ContactMessage::TYPE_CONTACT,
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'subject' => $data['subject'] ?? null,
            'message' => $data['message'],
            'meta' => array_filter([
                'productSlug' => $data['productSlug'] ?? null,
                'ip' => $request->ip(),
                'userAgent' => mb_substr((string) $request->userAgent(), 0, 255),
            ]),
        ]);

        return $this->created(
            ['id' => $message->id, 'receivedAt' => $message->created_at->toApiString()],
            ['message' => __('api.contact_received')]
        );
    }
}
