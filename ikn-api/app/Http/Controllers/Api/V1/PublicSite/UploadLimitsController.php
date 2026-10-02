<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use Symfony\Component\HttpFoundation\File\UploadedFile;

/**
 * Batas ukuran unggahan yang benar-benar berlaku (KB): nilai config aplikasi dibatasi lagi oleh batas PHP
 * (upload_max_filesize / post_max_size). FE memakainya untuk menolak berkas terlalu besar SEBELUM dikirim.
 */
class UploadLimitsController extends ApiController
{
    public function show()
    {
        $serverKb = (int) floor(UploadedFile::getMaxFilesize() / 1024);
        $limit = fn ($configKb) => $serverKb > 0 ? min((int) $configKb, $serverKb) : (int) $configKb;

        return $this->data([
            'imageKb' => $limit(config('ikn.media.image_max_kb')),
            'documentKb' => $limit(config('ikn.media.document_max_kb')),
            'videoKb' => $limit(config('ikn.media.video_max_kb')),
            'proofKb' => $limit(config('ikn.commerce.proof_max_kb')),
            'attachmentKb' => $limit(config('ikn.commerce.attachment_max_kb')),
            'wbsKb' => $limit(config('ikn.wbs.attachment_max_kb')),
            'serverKb' => $serverKb,
        ]);
    }
}
