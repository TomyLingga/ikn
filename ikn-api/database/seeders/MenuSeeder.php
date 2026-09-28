<?php

namespace Database\Seeders;

use App\Models\Menu;
use Illuminate\Database\Seeder;

// Menu header/footer dari navTree di ikn-fe/lib/i18n.ts (KEPUTUSAN: seed awal dari mockup).
class MenuSeeder extends Seeder
{
    public function run()
    {
        $tree = self::headerTree();

        $header = Menu::firstOrCreate(['location' => Menu::LOCATION_HEADER]);
        if ($header->items()->count() === 0) {
            $this->insert($header, $tree, null);
        }

        $footer = Menu::firstOrCreate(['location' => Menu::LOCATION_FOOTER]);
        if ($footer->items()->count() === 0) {
            $this->insert($footer, array_map(fn ($item) => array_diff_key($item, ['children' => 1]), $tree), null);
        }
    }

    private function insert(Menu $menu, array $items, ?int $parentId): void
    {
        foreach ($items as $position => $item) {
            $row = $menu->items()->create([
                'parent_id' => $parentId,
                'key' => $item['key'] ?? null,
                'label' => $item['label'],
                'description' => $item['description'] ?? null,
                'url' => $item['url'],
                'sort_order' => $position,
                'is_active' => true,
            ]);
            if (! empty($item['children'])) {
                $this->insert($menu, $item['children'], $row->id);
            }
        }
    }

    private static function i(string $key, string $id, string $en, string $url, array $children = []): array
    {
        return ['key' => $key, 'label' => ['id' => $id, 'en' => $en], 'url' => $url, 'children' => $children];
    }

    private static function c(string $id, string $en, string $url, string $descId, string $descEn): array
    {
        return ['label' => ['id' => $id, 'en' => $en], 'url' => $url, 'description' => ['id' => $descId, 'en' => $descEn]];
    }

    public static function headerTree(): array
    {
        return [
            self::i('home', 'Beranda', 'Home', '/'),
            self::i('tentang', 'Tentang Kami', 'About Us', '/tentang', [
                self::c('Sejarah', 'History', '/tentang#sejarah', 'Perjalanan sejak 1965', 'Our journey since 1965'),
                self::c('Visi & Misi', 'Vision & Mission', '/tentang#visi-misi', 'Arah dan tujuan kami', 'Our direction and goals'),
                self::c('Nilai AKHLAK', 'AKHLAK Values', '/tentang#nilai', 'Cara kami bekerja', 'How we work'),
                self::c('Hubungi Kami', 'Contact Us', '/kontak', 'Lokasi & kontak', 'Locations & contact'),
            ]),
            self::i('bisnis', 'Bisnis', 'Business', '/produk', [
                self::c('Katalog Produk', 'Product Catalog', '/catalog', 'Belanja & lihat semua produk', 'Shop & browse all products'),
                self::c('Resiprene 35', 'Resiprene 35', '/produk#resiprene-35', 'Cyclised natural rubber', 'Cyclised natural rubber'),
                self::c('Aneka Barang Karet', 'Rubber Articles', '/produk#barang-karet', 'Rubber article products', 'Rubber article products'),
                self::c('Unduhan', 'Downloads', '/unduhan', 'Brosur produk (PDF)', 'Product brochures (PDF)'),
            ]),
            self::i('media', 'Media', 'Media', '/berita', [
                self::c('Berita Terbaru', 'Latest News', '/berita', 'Kabar & rilis terkini', 'Recent updates & releases'),
                self::c('Galeri', 'Gallery', '/galeri', 'Foto & video', 'Photos & videos'),
            ]),
            self::i('keberlanjutan', 'Keberlanjutan', 'Sustainability', '/keberlanjutan', [
                self::c('Lingkungan, Sosial, Tata Kelola', 'Environment, Social, Governance', '/keberlanjutan', 'Komitmen ESG kami', 'Our ESG commitment'),
                self::c('Sertifikat', 'Certificates', '/keberlanjutan/sertifikat', 'ISO 37001 & REACH', 'ISO 37001 & REACH'),
                self::c('Pelanggan Kami', 'Our Customers', '/keberlanjutan/pelanggan', 'Mitra lintas industri', 'Partners across industries'),
                self::c('Whistle Blowing System', 'Whistle Blowing System', '/keberlanjutan/whistleblowing', 'Kanal pelaporan resmi', 'Official reporting channel'),
                self::c('REACH Compliance', 'REACH Compliance', '/keberlanjutan/reach', 'Kepatuhan pasar Eropa', 'EU market compliance'),
            ]),
            self::i('kontak', 'Kontak', 'Contact', '/kontak'),
        ];
    }
}
