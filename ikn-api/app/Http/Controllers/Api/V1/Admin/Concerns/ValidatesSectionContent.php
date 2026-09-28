<?php

namespace App\Http\Controllers\Api\V1\Admin\Concerns;

use App\Services\Cms\SectionRegistry;
use Illuminate\Support\Facades\Validator;

// Normalisasi lalu validasi konten section terhadap skema registry.
trait ValidatesSectionContent
{
    protected function validatedContent(SectionRegistry $registry, string $type, $input): array
    {
        $content = $registry->normalize($type, $input);

        Validator::make(['content' => $content], $registry->rules($type))->validate();

        return $content;
    }
}
