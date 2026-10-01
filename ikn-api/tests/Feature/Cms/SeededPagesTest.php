<?php

namespace Tests\Feature\Cms;

use Database\Seeders\CmsPageSeeder;
use Database\Seeders\MediaSeeder;
use Database\Seeders\MenuSeeder;
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

        $tentang = $this->getJson('/api/v1/content/pages/tentang')->assertOk()->json('data.sections');
        $this->assertSame(['header', 'profile', 'history', 'vision-mission', 'struktur', 'values'], array_column($tentang, 'key'));
        // Slideshow kepala halaman: dua foto seed (dihidrasi menjadi ringkasan media), 6 detik per foto, tata letak split.
        $this->assertCount(2, $tentang[0]['content']['media']);
        $this->assertStringStartsWith('image/', $tentang[0]['content']['media'][0]['file']['mime']);
        $this->assertSame(6, $tentang[0]['content']['interval']);
        $this->assertSame('split', $tentang[0]['content']['layout']);
        $this->assertSame('org_chart', $tentang[4]['type']);
        $this->assertGreaterThan(60, count($tentang[4]['content']['nodes']));
        $this->assertSame('rups', $tentang[4]['content']['nodes'][0]['level']);
        $this->assertSame('pelaksana', collect($tentang[4]['content']['nodes'])->firstWhere('key', 'driver')['level']);

        $kontak = $this->getJson('/api/v1/content/pages/kontak')->assertOk()->json('data.sections');
        $this->assertSame(3.5387, $kontak[1]['content']['locations'][0]['geo']['lat']);

        $keberlanjutan = $this->getJson('/api/v1/content/pages/keberlanjutan')->assertOk()->json('data.sections');
        $this->assertSame(['header', 'esg', 'sertifikat', 'pelanggan', 'reach', 'whistleblowing', 'wbs-form'], array_column($keberlanjutan, 'key'));

        $bisnis = $this->getJson('/api/v1/content/pages/bisnis')->assertOk()->json('data.sections');
        $this->assertSame(['header', 'resiprene-35', 'barang-karet', 'links', 'unduhan', 'cta'], array_column($bisnis, 'key'));

        $media = $this->getJson('/api/v1/content/pages/media')->assertOk()->json('data.sections');
        $this->assertSame(['page_header', 'link_cards'], array_column($media, 'type'));

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
}
