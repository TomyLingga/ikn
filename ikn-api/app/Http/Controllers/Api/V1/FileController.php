<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

// Berkas privat hanya lewat sini, dengan MediaPolicy (KEPUTUSAN: tidak pernah di public/storage).
class FileController extends ApiController
{
    public function show(Request $request, Media $media)
    {
        $this->authorize('view', $media);

        $disk = Storage::disk($media->disk);

        abort_unless($disk->exists($media->path), 404);

        return response()->file($disk->path($media->path), [
            'Content-Type' => $media->mime,
            'Content-Disposition' => 'inline; filename="'.addslashes($media->original_name).'"',
            'Cache-Control' => 'private, max-age=0',
        ]);
    }
}
