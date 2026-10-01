<?php

namespace App\Policies;

use App\Models\Media;
use App\Models\OrderAttachment;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

// Akses berkas privat: admin aktif, atau customer pemilik order untuk bukti bayar dan lampiran order miliknya
// (payments.proof_media_id / order_attachments.media_id → orders.user_id; KEPUTUSAN pembayaran, diperluas BE-3, A-74).
class MediaPolicy
{
    use HandlesAuthorization;

    public function view(User $user, Media $media): bool
    {
        if ($media->isPublic()) {
            return true;
        }

        if ($user->isAdmin()) {
            return $user->isActive();
        }

        if ($user->isCustomer()) {
            $owns = fn ($q) => $q->where('user_id', $user->id);

            return Payment::where('proof_media_id', $media->id)->whereHas('order', $owns)->exists()
                || OrderAttachment::where('media_id', $media->id)->whereHas('order', $owns)->exists();
        }

        return false;
    }
}
