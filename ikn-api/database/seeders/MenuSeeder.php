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
                self::c('Struktur Organisasi', 'Organisation Structure', '/tentang#struktur-organisasi', 'Susunan jabatan', 'Positions and units'),
                self::c('Nilai AKHLAK', 'AKHLAK Values', '/tentang#nilai', 'Cara kami bekerja', 'How we work'),
            ]),
            // Halaman Bisnis (/bisnis): lini bisnis + produk dari katalog; anchor resiprene-35 / barang-karet = key section.
            self::i('bisnis', 'Bisnis', 'Business', '/bisnis', [
                self::c('Resiprene 35', 'Resiprene 35', '/bisnis#resiprene-35', 'Cyclised natural rubber', 'Cyclised natural rubber'),
                self::c('Aneka Barang Karet', 'Rubber Articles', '/bisnis#barang-karet', 'Produk karet siap pakai', 'Ready-to-use rubber products'),
                // Menuju blok produk di halaman Bisnis; tombol di blok itu membawa ke toko (/catalog).
                self::c('Katalog Produk', 'Product Catalog', '/bisnis#produk', 'Produk kami & pemesanan online', 'Our products & online ordering'),
                self::c('Unduhan', 'Downloads', '/bisnis#unduhan', 'Brosur produk (PDF)', 'Product brochures (PDF)'),
            ]),
            // Media = halaman hub (/media) dengan kartu ke Berita dan Galeri.
            self::i('media', 'Media', 'Media', '/media', [
                self::c('Berita', 'News', '/berita', 'Kabar & rilis terkini', 'Recent updates & releases'),
                self::c('Galeri', 'Gallery', '/galeri', 'Foto & video', 'Photos & videos'),
            ]),
            // Keberlanjutan = satu halaman; anak menu menunjuk anchor section (key section).
            self::i('keberlanjutan', 'Keberlanjutan', 'Sustainability', '/keberlanjutan', [
                self::c('Lingkungan, Sosial, Tata Kelola', 'Environment, Social, Governance', '/keberlanjutan#esg', 'Komitmen ESG kami', 'Our ESG commitment'),
                self::c('Sertifikat', 'Certificates', '/keberlanjutan#sertifikat', 'ISO 37001 & REACH', 'ISO 37001 & REACH'),
                self::c('Pelanggan Kami', 'Our Customers', '/keberlanjutan#pelanggan', 'Mitra lintas industri', 'Partners across industries'),
                self::c('Whistle Blowing System', 'Whistle Blowing System', '/keberlanjutan#whistleblowing', 'Kanal pelaporan resmi', 'Official reporting channel'),
                self::c('REACH Compliance', 'REACH Compliance', '/keberlanjutan#reach', 'Kepatuhan pasar Eropa', 'EU market compliance'),
            ]),
            self::i('kontak', 'Kontak', 'Contact', '/kontak'),
        ];
    }
}
