<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\StoreOrderAttachmentRequest;
use App\Http\Resources\OrderResource;
use App\Models\Media;
use App\Models\Order;
use App\Models\OrderAttachment;
use App\Services\Commerce\OrderNotifier;
use App\Services\Media\MediaService;
use Illuminate\Support\Facades\DB;

/**
 * Lampiran order dari admin (ASUMSI A-74), modul `orders`: faktur pajak, surat jalan, dokumen lain yang perlu
 * diterima customer. Berkas di disk private; customer mengunduh lewat GET /files/{media} (MediaPolicy).
 * Boleh ditambahkan pada status apa pun yang sudah dibayar (paid … completed).
 */
class OrderAttachmentController extends ApiController
{
    public function store(StoreOrderAttachmentRequest $request, Order $order, MediaService $mediaService, OrderNotifier $notifier)
    {
        if (! in_array($order->status, Order::PAID_STATUSES, true)) {
            throw ApiException::conflict('ATTACHMENT_NOT_ALLOWED', __('commerce.attachment_not_allowed'), ['status' => $order->status]);
        }

        $media = $mediaService->upload(
            $request->file('file'),
            'order-attachments',
            Media::DISK_PRIVATE,
            $request->user(),
            config('ikn.commerce.attachment_mimes'),
            (int) config('ikn.commerce.attachment_max_kb')
        );

        $attachment = DB::transaction(fn () => $order->attachments()->create([
            'media_id' => $media->id,
            'label' => trim((string) ($request->validated()['label'] ?? '')) ?: null,
            'created_by' => $request->user()->id,
        ]));
        $notifier->attachmentAdded($order, $attachment->load('media'));

        return $this->created(new OrderResource($order->fresh()));
    }

    public function destroy(Order $order, OrderAttachment $attachment, MediaService $mediaService)
    {
        if ((int) $attachment->order_id !== (int) $order->id) {
            throw ApiException::notFound();
        }

        DB::transaction(function () use ($attachment, $mediaService) {
            $media = $attachment->media;
            $attachment->delete();
            if ($media) {
                $mediaService->delete($media); // berkas privat hanya dirujuk lampiran ini
            }
        });

        return $this->data(new OrderResource($order->fresh()));
    }
}
