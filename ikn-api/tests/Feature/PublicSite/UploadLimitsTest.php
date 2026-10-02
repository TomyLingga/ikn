<?php

namespace Tests\Feature\PublicSite;

use Symfony\Component\HttpFoundation\File\UploadedFile;
use Tests\TestCase;

class UploadLimitsTest extends TestCase
{
    public function test_upload_limits_are_capped_by_the_php_limit(): void
    {
        $serverKb = (int) floor(UploadedFile::getMaxFilesize() / 1024);
        config(['ikn.media.video_max_kb' => $serverKb + 1000, 'ikn.media.image_max_kb' => 100]);

        $this->getJson('/api/v1/upload-limits')
            ->assertOk()
            ->assertJsonPath('data.serverKb', $serverKb)
            ->assertJsonPath('data.videoKb', $serverKb)
            ->assertJsonPath('data.imageKb', min(100, $serverKb))
            ->assertJsonStructure(['data' => ['imageKb', 'documentKb', 'videoKb', 'proofKb', 'attachmentKb', 'wbsKb', 'serverKb']]);
    }
}
