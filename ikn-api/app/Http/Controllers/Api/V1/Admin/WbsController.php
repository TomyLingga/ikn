<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\UpdateWbsRequest;
use App\Http\Requests\Admin\WbsUploadRequest;
use App\Http\Resources\DocLinkResource;
use App\Http\Resources\WbsReportResource;
use App\Models\DocLink;
use App\Models\Media;
use App\Models\WbsReport;
use App\Services\Media\MediaService;
use Illuminate\Http\Request;

// Tindak lanjut laporan WBS + dokumen SOP WBS (doc-link kategori "wbs", kontrak 11.6).
class WbsController extends ApiController
{
    public function index(Request $request)
    {
        $reports = WbsReport::with(['handler', 'attachment'])
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('id')->get();

        return $this->data(WbsReportResource::collection($reports));
    }

    public function show(WbsReport $wbsReport)
    {
        return $this->data(new WbsReportResource($wbsReport->load(['handler', 'attachment'])));
    }

    public function update(UpdateWbsRequest $request, WbsReport $wbsReport)
    {
        $data = $request->validated();

        $wbsReport->fill([
            'status' => $data['status'] ?? $wbsReport->status,
            'admin_notes' => array_key_exists('adminNotes', $data) ? $data['adminNotes'] : $wbsReport->admin_notes,
            'handled_by' => $request->user()->id,
        ])->save();

        return $this->data(new WbsReportResource($wbsReport->fresh(['handler', 'attachment'])));
    }

    public function config()
    {
        $doc = $this->document();

        return $this->data(['document' => $doc ? new DocLinkResource($doc) : null]);
    }

    public function upload(WbsUploadRequest $request, MediaService $media)
    {
        $uploaded = $media->upload(
            $request->file('file'),
            'wbs',
            Media::DISK_PUBLIC,
            $request->user(),
            config('ikn.media.document_mimes')
        );

        $doc = $this->document() ?? new DocLink(['category' => DocLink::CATEGORY_WBS, 'sort_order' => 0]);
        $doc->fill([
            'label' => $request->input('label') ?: ($doc->exists ? $doc->label : ['id' => 'Dokumen Whistle Blowing System', 'en' => 'Whistle Blowing System Document']),
            'description' => $request->input('description') ?: ($doc->exists ? $doc->description : ['id' => 'Kanal pelaporan resmi PT IKN', 'en' => 'Official PT IKN reporting channel']),
            'media_id' => $uploaded->id,
            'is_active' => true,
        ])->save();

        return $this->data(['document' => new DocLinkResource($doc->fresh('media'))]);
    }

    private function document(): ?DocLink
    {
        return DocLink::with('media')->where('category', DocLink::CATEGORY_WBS)->orderBy('sort_order')->orderBy('id')->first();
    }
}
