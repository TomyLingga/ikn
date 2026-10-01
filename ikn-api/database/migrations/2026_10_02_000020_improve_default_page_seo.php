<?php

use App\Models\Page;
use Database\Seeders\CmsPageSeeder;
use Illuminate\Database\Migrations\Migration;

// Judul & deskripsi SEO halaman bawaan dibuat kaya kata kunci (ASUMSI A-80). Hanya halaman yang SEO-nya masih
// isi seeder lama (judul SEO = judul halaman, mis. "Beranda") yang diganti; SEO buatan admin dibiarkan.
class ImproveDefaultPageSeo extends Migration
{
    public function up()
    {
        foreach (CmsPageSeeder::seoDefaults() as $slug => $seo) {
            $page = Page::where('slug', $slug)->first();
            if (! $page) {
                continue;
            }
            $current = is_array($page->seo) ? $page->seo : [];
            $titleId = trim((string) ($current['title']['id'] ?? ''));
            $pageTitleId = trim((string) (is_array($page->title) ? ($page->title['id'] ?? '') : $page->title));
            if ($titleId !== '' && $titleId !== $pageTitleId) {
                continue; // sudah diubah admin
            }
            $page->seo = array_merge($current, $seo);
            $page->save();
        }
    }

    public function down()
    {
        foreach (CmsPageSeeder::seoDefaults() as $slug => $seo) {
            $page = Page::where('slug', $slug)->first();
            if (! $page || ($page->seo['title']['id'] ?? null) !== $seo['title']['id']) {
                continue;
            }
            $page->seo = ['title' => $page->title, 'description' => $page->seo['description'] ?? ['id' => '', 'en' => '']];
            $page->save();
        }
    }
}
