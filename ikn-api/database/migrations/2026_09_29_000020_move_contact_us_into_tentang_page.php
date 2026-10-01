<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// "Hubungi Kami" di menu Tentang Kami tidak lagi melompat ke halaman Kontak: halaman Tentang mendapat section
// contact_summary (anchor #hubungi-kami; lokasi/email/sosial dibaca dari section contact_info halaman Kontak) di bawah
// nilai AKHLAK, dan item menu diarahkan ke anchor itu. Instalasi baru mendapat keduanya dari CmsPageSeeder/MenuSeeder;
// migrasi ini menyusulkan perubahan yang sama ke basis data yang sudah terisi.
class MoveContactUsIntoTentangPage extends Migration
{
    private const OLD_URL = '/kontak';
    private const NEW_URL = '/tentang#hubungi-kami';

    public function up(): void
    {
        $page = DB::table('pages')->where('slug', 'tentang')->first(['id']);
        if ($page && ! DB::table('page_sections')->where('page_id', $page->id)->where('key', 'contact')->exists()) {
            $order = (int) DB::table('page_sections')->where('page_id', $page->id)->max('sort_order');
            DB::table('page_sections')->insert([
                'page_id' => $page->id,
                'key' => 'contact',
                'type' => 'contact_summary',
                'sort_order' => $order + 1,
                'is_visible' => true,
                'content' => json_encode(self::content(), JSON_UNESCAPED_UNICODE),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->contactMenuItems(self::OLD_URL)->update(['url' => self::NEW_URL, 'updated_at' => now()]);
    }

    public function down(): void
    {
        $this->contactMenuItems(self::NEW_URL)->update(['url' => self::OLD_URL, 'updated_at' => now()]);

        $page = DB::table('pages')->where('slug', 'tentang')->first(['id']);
        if ($page) {
            DB::table('page_sections')->where('page_id', $page->id)
                ->where('key', 'contact')->where('type', 'contact_summary')->delete();
        }
    }

    /** Item "Hubungi Kami" di bawah item ber-key "tentang" (menu header maupun footer). */
    private function contactMenuItems(string $url)
    {
        $parents = DB::table('menu_items')->where('key', 'tentang')->pluck('id');

        return DB::table('menu_items')->whereIn('parent_id', $parents)->where('url', $url)->where('label->id', 'Hubungi Kami');
    }

    private static function content(): array
    {
        return [
            'label' => ['id' => '/ Hubungi kami', 'en' => '/ Contact us'],
            'heading' => ['id' => 'Mari terhubung.', 'en' => 'Let’s connect.'],
            'lead' => [
                'id' => 'Punya pertanyaan seputar produk, kemitraan, atau kunjungan pabrik? Tim kami siap membantu.',
                'en' => 'Questions about products, partnerships, or plant visits? Our team is ready to help.',
            ],
            'button_label' => ['id' => 'Kirim pesan', 'en' => 'Send a message'],
            'button_url' => '/kontak',
        ];
    }
}
