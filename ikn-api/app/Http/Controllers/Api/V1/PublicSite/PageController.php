<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Models\Page;
use App\Services\Cms\BlockAliases;
use App\Services\Cms\PageRenderer;
use App\Services\Cms\SectionRegistry;

class PageController extends ApiController
{
    // Hanya halaman published; section tersembunyi disaring (kontrak 7).
    public function show(string $slug, PageRenderer $renderer)
    {
        $page = Page::published()->where('slug', $slug)->firstOrFail();

        return $this->data($renderer->render($page, true));
    }

    public function block(string $key, SectionRegistry $registry)
    {
        $section = BlockAliases::resolve($key, true) ?? throw ApiException::notFound();

        return $this->data([
            'key' => $key,
            'type' => $section->type,
            'data' => $registry->hydrate($section->type, $registry->normalize($section->type, $section->content ?? [])),
            'updatedAt' => optional($section->updated_at)->toApiString(),
        ]);
    }
}
