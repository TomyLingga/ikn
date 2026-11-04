<?php

namespace Tests\Feature\Cms;

use Database\Seeders\CmsPageSeeder;
use Database\Seeders\MediaSeeder;
use Database\Seeders\MenuSeeder;
use App\Models\PageSection;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

// Susunan halaman bawaan: satu halaman per menu utama, sub-bagian sebagai section ber-anchor.
class SeededPagesTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeded_pages_follow_one_page_per_menu_layout(): void
    {
        Storage::fake('public'); // MediaSeeder menyalin foto seed; kepala halaman merujuk media itu.
        $this->seed(MediaSeeder::class);
        $this->seed(MenuSeeder::class);
        $this->seed(CmsPageSeeder::class);

        // Beranda (brief 2026-11-04): hero, sekilas, tentang, bisnis, manufaktur, sejarah, kualitas, keberlanjutan,
        // pelanggan, berita, galeri + video, CTA.
        $home = $this->getJson('/api/v1/content/pages/home')->assertOk()->json('data.sections');
        $this->assertSame(
            ['hero', 'glance', 'about', 'products', 'manufaktur', 'fasilitas', 'history', 'kualitas', 'sertifikat', 'keberlanjutan', 'pilar-keberlanjutan', 'pelanggan', 'news', 'galeri', 'videos', 'cta'],
            array_column($home, 'key')
        );
        $this->assertSame('Engineering Rubber Solutions'."\n".'for a Better Tomorrow.', $home[0]['content']['title']['en']);
        $this->assertCount(2, $home[3]['content']['items']);
        $this->assertNotEmpty($home[3]['content']['items'][0]['applications']);
        $this->assertCount(7, $home[6]['content']['items']); // tonggak sejarah sejak 1965
        $this->assertSame('/galeri', $home[13]['content']['link_url']);

        // Susunan konten brief 2026-11-04 (About, Business, Quality, Sustainability, News & Media, Partnership, Contact).
        $keys = fn (string $slug) => array_column($this->getJson("/api/v1/content/pages/{$slug}")->assertOk()->json('data.sections'), 'key');

        $tentang = $this->getJson('/api/v1/content/pages/tentang')->assertOk()->json('data.sections');
        $this->assertSame(['header', 'profile', 'history', 'vision-mission', 'values', 'komisaris', 'manajemen', 'struktur', 'struktur-korporasi', 'cta'], array_column($tentang, 'key'));
        // Slideshow kepala halaman: dua foto seed (dihidrasi menjadi ringkasan media), 6 detik per foto, tata letak split.
        $this->assertCount(2, $tentang[0]['content']['media']);
        $this->assertStringStartsWith('image/', $tentang[0]['content']['media'][0]['file']['mime']);
        $this->assertSame(6, $tentang[0]['content']['interval']);
        $this->assertSame('cover', $tentang[0]['content']['layout']);
        $this->assertSame('org_chart', $tentang[7]['type']);
        $this->assertGreaterThan(60, count($tentang[7]['content']['nodes']));
        $this->assertSame('rups', $tentang[7]['content']['nodes'][0]['level']);
        $this->assertSame('pelaksana', collect($tentang[7]['content']['nodes'])->firstWhere('key', 'driver')['level']);

        $kontak = $this->getJson('/api/v1/content/pages/kontak')->assertOk()->json('data.sections');
        $this->assertSame(['header', 'kantor-pusat', 'lokasi-pabrik', 'contact-info', 'form'], array_column($kontak, 'key'));
        $this->assertSame(3.5387, $kontak[3]['content']['locations'][0]['geo']['lat']);

        // Anchor dropdown navbar (#esg, #sertifikat, #pelanggan, #reach, #whistleblowing) tetap ada.
        $this->assertSame(['header', 'lingkungan', 'k3', 'tata-kelola', 'esg', 'reach', 'sertifikat', 'pelanggan', 'whistleblowing', 'wbs-form'], $keys('keberlanjutan'));
        $this->assertSame(['header', 'lini-bisnis', 'ragam-produk', 'fasilitas', 'fasilitas-foto', 'kapabilitas', 'cara-pesan', 'links', 'unduhan', 'tanya-jawab', 'cta'], $keys('bisnis'));
        $this->assertSame(['header', 'jaminan-mutu', 'pengembangan', 'laboratorium', 'standar-produk', 'sertifikasi', 'cta'], $keys('kualitas'));
        $this->assertSame(['header', 'berita-terbaru', 'kegiatan', 'galeri', 'video'], $keys('media'));
        $this->assertSame(['header', 'pelanggan', 'pelanggan-resiprene', 'kerja-sama', 'form', 'permintaan-produk'], $keys('kemitraan'));

        // Navbar tetap 6 menu; halaman Kualitas & Kemitraan hanya di footer.
        $header = $this->getJson('/api/v1/content/menus/header')->assertOk()->json('data.items');
        $this->assertSame(['home', 'tentang', 'bisnis', 'media', 'keberlanjutan', 'kontak'], array_column($header, 'key'));
        $footer = array_column($this->getJson('/api/v1/content/menus/footer')->assertOk()->json('data.items'), 'url');
        $this->assertSame(['/', '/tentang', '/bisnis', '/kualitas', '/keberlanjutan', '/media', '/kemitraan', '/kontak'], $footer);

        foreach (['sertifikat', 'pelanggan', 'reach', 'whistleblowing', 'unduhan', 'produk'] as $gone) {
            $this->getJson("/api/v1/content/pages/{$gone}")->assertStatus(404);
        }

        $urls = collect($this->getJson('/api/v1/content/menus/header')->assertOk()->json('data.items'))
            ->flatMap(fn ($item) => array_merge([$item['url']], array_column($item['children'] ?? [], 'url')));
        $this->assertTrue($urls->contains('/media'));
        $this->assertTrue($urls->contains('/tentang#struktur-organisasi'));
        $this->assertTrue($urls->contains('/keberlanjutan#sertifikat'));
        $this->assertTrue($urls->contains('/bisnis#unduhan'));
        $this->assertTrue($urls->contains('/bisnis#produk'));
        $this->assertFalse($urls->contains('/catalog'));
        $this->assertFalse($urls->contains(fn ($url) => str_starts_with($url, '/keberlanjutan/') || $url === '/unduhan' || str_starts_with($url, '/produk')));
    }

    public function test_every_seeded_section_passes_admin_validation(): void
    {
        // Seeder menulis konten langsung ke DB; pastikan editor admin bisa menyimpannya kembali tanpa galat validasi.
        Storage::fake('public');
        $this->seed(MediaSeeder::class);
        $this->seed(MenuSeeder::class);
        $this->seed(CmsPageSeeder::class);
        $admin = $this->superAdmin();

        foreach (PageSection::with('page')->get() as $section) {
            $this->actingAs($admin)->putJson('/api/v1/admin/sections/'.$section->id, ['content' => $section->content])
                ->assertOk()
                ->assertJsonPath('data.key', $section->key, "{$section->page->slug}#{$section->key}");
        }
    }
}
