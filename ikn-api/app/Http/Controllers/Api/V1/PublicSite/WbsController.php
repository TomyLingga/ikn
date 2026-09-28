<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\PublicSite\StoreWbsRequest;
use App\Models\Media;
use App\Models\WbsReport;
use App\Services\Media\MediaService;
use App\Services\Wbs\WbsCodeGenerator;
use Illuminate\Support\Facades\DB;

// Laporan WBS publik (kontrak 8, ASUMSI A-21): lampiran ke disk private, identitas opsional.
class WbsController extends ApiController
{
    public function store(StoreWbsRequest $request, MediaService $media, WbsCodeGenerator $codes)
    {
        $data = $request->validated();
        $anonymous = (bool) ($data['isAnonymous'] ?? true);

        $attachment = $request->hasFile('attachment')
            ? $media->upload(
                $request->file('attachment'),
                'wbs',
                Media::DISK_PRIVATE,
                null,
                config('ikn.wbs.attachment_mimes'),
                config('ikn.wbs.attachment_max_kb')
            )
            : null;

        $report = DB::transaction(fn () => WbsReport::create([
            'code' => $codes->next(),
            'subject' => $data['subject'],
            'body' => $data['body'],
            'reporter_name' => $anonymous ? null : ($data['reporterName'] ?? null),
            'reporter_contact' => $anonymous ? null : ($data['reporterContact'] ?? null),
            'is_anonymous' => $anonymous,
            'attachment_media_id' => $attachment?->id,
            'status' => WbsReport::STATUS_NEW,
        ]));

        return $this->created(
            ['code' => $report->code, 'status' => $report->status, 'createdAt' => $report->created_at->toApiString()],
            ['message' => __('api.wbs_received')]
        );
    }

    public function show(string $code)
    {
        $report = WbsReport::where('code', strtoupper($code))->firstOrFail();

        return $this->data([
            'code' => $report->code,
            'status' => $report->status,
            'createdAt' => $report->created_at->toApiString(),
            'updatedAt' => $report->updated_at->toApiString(),
        ]);
    }
}
