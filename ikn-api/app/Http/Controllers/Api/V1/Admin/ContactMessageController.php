<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\ContactMessageResource;
use App\Models\ContactMessage;
use Illuminate\Http\Request;

class ContactMessageController extends ApiController
{
    public function index(Request $request)
    {
        $query = ContactMessage::query()
            ->when($request->boolean('unread'), fn ($q) => $q->whereNull('read_at'))
            ->when($request->query('type'), fn ($q, $t) => $q->where('type', $t))
            ->orderByDesc('id');

        return $this->paginated($query->paginate($this->perPage(20)), ContactMessageResource::class);
    }

    public function markRead(ContactMessage $contactMessage)
    {
        if (! $contactMessage->read_at) {
            $contactMessage->forceFill(['read_at' => now()])->save();
        }

        return $this->data(new ContactMessageResource($contactMessage));
    }
}
