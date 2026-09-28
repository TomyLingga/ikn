<?php

namespace App\Services\Cms;

use App\Models\Page;
use App\Models\PageSection;
use App\Support\I18n;

// Menyusun payload halaman untuk API: section terurut, media terhidrasi, SEO dengan fallback.
class PageRenderer
{
    public function __construct(private SectionRegistry $registry)
    {
    }

    public function render(Page $page, bool $publicOnly = true): array
    {
        $sections = $page->sections()->get();

        if ($publicOnly) {
            $sections = $sections->filter(fn (PageSection $s) => $s->is_visible && $this->registry->has($s->type));
        }

        return [
            'id' => $page->id,
            'slug' => $page->slug,
            'title' => $page->title,
            'status' => $page->status,
            'template' => $page->template,
            'seo' => $this->seo($page),
            'sections' => $sections->values()->map(fn (PageSection $s) => $this->section($s))->all(),
            'updatedAt' => optional($page->updated_at)->toApiString(),
        ];
    }

    public function section(PageSection $section): array
    {
        $content = $this->registry->has($section->type)
            ? $this->registry->hydrate($section->type, $this->registry->normalize($section->type, $section->content ?? []))
            : ($section->content ?? []);

        return [
            'id' => $section->id,
            'key' => $section->key,
            'type' => $section->type,
            'sortOrder' => $section->sort_order,
            'isVisible' => $section->is_visible,
            'content' => $content,
            'updatedAt' => optional($section->updated_at)->toApiString(),
        ];
    }

    private function seo(Page $page): array
    {
        $seo = $page->seo ?? [];

        return [
            'title' => I18n::normalize($seo['title'] ?? $page->title),
            'description' => I18n::normalize($seo['description'] ?? ''),
        ];
    }
}
