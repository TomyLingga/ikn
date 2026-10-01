<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\StorePageRequest;
use App\Http\Requests\Admin\UpdatePageRequest;
use App\Models\Page;
use App\Services\Cms\PageRenderer;
use App\Support\I18n;

// Halaman CMS (kontrak 11.6). Slug halaman bawaan dilindungi karena dirujuk route FE.
class PageController extends ApiController
{
    public function index()
    {
        // Urut judul (bahasa Indonesia, tanpa memandang huruf besar/kecil) agar daftar admin mudah dipindai.
        $pages = Page::withCount('sections')->orderByRaw("lower(title->>'id')")->orderBy('slug')->get()->map(fn (Page $p) => [
            'id' => $p->id,
            'slug' => $p->slug,
            'title' => $p->title,
            'status' => $p->status,
            'template' => $p->template,
            'sectionCount' => $p->sections_count,
            'isProtected' => $this->isProtected($p->slug),
            'updatedAt' => optional($p->updated_at)->toApiString(),
        ]);

        return $this->data($pages);
    }

    public function show(Page $page, PageRenderer $renderer)
    {
        return $this->data($renderer->render($page, false) + ['isProtected' => $this->isProtected($page->slug)]);
    }

    public function store(StorePageRequest $request, PageRenderer $renderer)
    {
        $data = $request->validated();
        $page = Page::create([
            'slug' => $data['slug'],
            'title' => $data['title'],
            'status' => $data['status'] ?? Page::STATUS_DRAFT,
            'seo' => $this->seo($data['seo'] ?? null),
            'template' => $data['template'] ?? 'default',
        ]);

        return $this->created($renderer->render($page, false));
    }

    public function update(UpdatePageRequest $request, Page $page, PageRenderer $renderer)
    {
        $data = $request->validated();

        if (array_key_exists('slug', $data) && $data['slug'] !== $page->slug && $this->isProtected($page->slug)) {
            throw ApiException::conflict('PAGE_PROTECTED', __('api.page_slug_reserved'));
        }

        foreach (['slug', 'title', 'status', 'template'] as $field) {
            if (array_key_exists($field, $data)) {
                $page->{$field} = $data[$field];
            }
        }
        if (array_key_exists('seo', $data)) {
            $page->seo = $this->seo($data['seo']);
        }
        $page->save();

        return $this->data($renderer->render($page->fresh(), false) + ['isProtected' => $this->isProtected($page->slug)]);
    }

    public function destroy(Page $page)
    {
        if ($this->isProtected($page->slug)) {
            throw ApiException::conflict('PAGE_PROTECTED', __('api.page_slug_reserved'));
        }

        $page->delete();

        return $this->deleted();
    }

    private function isProtected(string $slug): bool
    {
        return in_array($slug, config('ikn.cms.protected_pages', []), true);
    }

    private function seo(?array $seo): ?array
    {
        if (! $seo) {
            return null;
        }

        return [
            'title' => I18n::normalize($seo['title'] ?? ''),
            'description' => I18n::normalize($seo['description'] ?? ''),
        ];
    }
}
