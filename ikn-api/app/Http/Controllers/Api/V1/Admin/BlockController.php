<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\Admin\Concerns\ValidatesSectionContent;
use App\Http\Controllers\Api\V1\ApiController;
use App\Services\Cms\BlockAliases;
use App\Services\Cms\SectionRegistry;
use Illuminate\Http\Request;

// Alias kompatibilitas GET/PUT /admin/blocks/{history|vision-mission|contact} → section terkait.
class BlockController extends ApiController
{
    use ValidatesSectionContent;

    public function show(string $key, SectionRegistry $registry)
    {
        $section = BlockAliases::resolve($key) ?? throw ApiException::notFound();

        return $this->data($this->present($section, $registry));
    }

    public function update(Request $request, string $key, SectionRegistry $registry)
    {
        $section = BlockAliases::resolve($key) ?? throw ApiException::notFound();

        $section->content = $this->validatedContent($registry, $section->type, $request->input('data', $request->input('content', [])));
        $section->save();

        return $this->data($this->present($section->fresh(), $registry));
    }

    private function present($section, SectionRegistry $registry): array
    {
        return [
            'key' => array_search(['page' => $section->page->slug, 'key' => $section->key], BlockAliases::MAP, true) ?: $section->key,
            'type' => $section->type,
            'data' => $registry->hydrate($section->type, $registry->normalize($section->type, $section->content ?? [])),
            'updatedAt' => optional($section->updated_at)->toApiString(),
        ];
    }
}
