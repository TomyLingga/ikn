<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\HelpGuideRequest;
use App\Models\Media;
use App\Models\Setting;
use App\Services\Cms\SettingsService;
use App\Services\Media\MediaService;

// Panduan admin (tautan atau berkas) yang tampil di AdminShell (kontrak 11.4).
class HelpGuideController extends ApiController
{
    private const KEY = 'admin.help_guide';

    public function show(SettingsService $settings)
    {
        return $this->data($this->present($settings->get(self::KEY)));
    }

    public function store(HelpGuideRequest $request, MediaService $media, SettingsService $settings)
    {
        $current = $settings->get(self::KEY) ?? [];
        $value = [
            'title' => $request->input('title'),
            'type' => $request->input('type'),
            'url' => $request->input('type') === 'url' ? (string) $request->input('url') : '',
            'mediaId' => $current['mediaId'] ?? null,
        ];

        if ($request->input('type') === 'file' && $request->hasFile('file')) {
            $uploaded = $media->upload($request->file('file'), 'help-guide', Media::DISK_PUBLIC, $request->user());
            $value['mediaId'] = $uploaded->id;
        }

        Setting::putValue(self::KEY, $value, 'admin', false);

        return $this->data($this->present($value));
    }

    private function present($value): array
    {
        $value = is_array($value) ? $value : [];
        $file = ! empty($value['mediaId']) ? Media::find($value['mediaId']) : null;

        return [
            'title' => $value['title'] ?? '',
            'type' => $value['type'] ?? 'url',
            'url' => $value['url'] ?? '',
            'file' => $file ? $file->toSummary() : null,
        ];
    }
}
