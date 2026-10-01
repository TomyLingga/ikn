<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Api\V1\Admin\Concerns\ValidatesSectionContent;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\ReorderSectionsRequest;
use App\Http\Requests\Admin\StoreSectionRequest;
use App\Http\Requests\Admin\UpdateSectionRequest;
use App\Models\Page;
use App\Models\PageSection;
use App\Services\Cms\PageRenderer;
use App\Services\Cms\SectionDefinitions;
use App\Services\Cms\SectionRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

// Section halaman: isi, urutan, tampil/sembunyi (KEPUTUSAN: tipe & desain tetap milik FE).
class SectionController extends ApiController
{
    use ValidatesSectionContent;

    public function types(SectionRegistry $registry)
    {
        // `groups` = kelompok tipe (urutan tampil) untuk pemilih "Tambah section"; tiap tipe membawa kunci `group`.
        return $this->data(['types' => $registry->types(), 'groups' => SectionDefinitions::GROUPS, 'icons' => SectionRegistry::ICONS]);
    }

    public function index(Page $page, PageRenderer $renderer)
    {
        return $this->data($page->sections()->get()->map(fn (PageSection $s) => $renderer->section($s))->values());
    }

    public function store(StoreSectionRequest $request, Page $page, SectionRegistry $registry, PageRenderer $renderer)
    {
        $data = $request->validated();
        $content = $this->validatedContent($registry, $data['type'], $data['content'] ?? []);

        if (! empty($data['key']) && $page->sections()->where('key', $data['key'])->exists()) {
            throw ValidationException::withMessages(['key' => [__('validation.unique', ['attribute' => 'key'])]]);
        }

        $section = $page->sections()->create([
            'key' => $data['key'] ?? null,
            'type' => $data['type'],
            'content' => $content,
            'is_visible' => $data['isVisible'] ?? true,
            'sort_order' => $data['sortOrder'] ?? ((int) $page->sections()->max('sort_order') + 1),
        ]);

        return $this->created($renderer->section($section));
    }

    public function update(UpdateSectionRequest $request, PageSection $section, SectionRegistry $registry, PageRenderer $renderer)
    {
        $data = $request->validated();

        if (array_key_exists('content', $data)) {
            $section->content = $this->validatedContent($registry, $section->type, $data['content']);
        }
        if (array_key_exists('isVisible', $data)) {
            $section->is_visible = $data['isVisible'];
        }
        if (array_key_exists('key', $data)) {
            $exists = PageSection::where('page_id', $section->page_id)->where('key', $data['key'])->where('id', '!=', $section->id)->exists();
            if ($data['key'] !== null && $exists) {
                throw ValidationException::withMessages(['key' => [__('validation.unique', ['attribute' => 'key'])]]);
            }
            $section->key = $data['key'];
        }
        if (array_key_exists('sortOrder', $data)) {
            $section->sort_order = $data['sortOrder'];
        }

        $section->save();

        return $this->data($renderer->section($section->fresh()));
    }

    public function destroy(PageSection $section)
    {
        $section->delete();

        return $this->deleted();
    }

    public function reorder(ReorderSectionsRequest $request, Page $page, PageRenderer $renderer)
    {
        $ids = array_map('intval', $request->validated()['ids']);
        $owned = $page->sections()->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (array_diff($ids, $owned)) {
            throw ValidationException::withMessages(['ids' => [__('validation.exists', ['attribute' => 'ids'])]]);
        }

        DB::transaction(function () use ($ids, $page) {
            foreach ($ids as $position => $id) {
                PageSection::where('id', $id)->where('page_id', $page->id)->update(['sort_order' => $position]);
            }
        });

        return $this->data($renderer->render($page->fresh(), false));
    }
}
