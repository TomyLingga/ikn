<?php

use Database\Seeders\CmsPageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Section linimasa halaman Tentang (key "history") diisi sejarah perusahaan lengkap dari bagan klien
// (CmsPageSeeder::historyItems) hanya bila isinya masih placeholder seed lama (tiga tonggak 1965 / — / Kini);
// suntingan admin tidak ditimpa. Bentuk item bertambah field opsional `name` dan `products` (ASUMSI A-59).
class FillCompanyHistoryTimeline extends Migration
{
    public function up(): void
    {
        $row = $this->historySection();
        if (! $row) {
            return;
        }
        $content = json_decode($row->content, true) ?: [];
        $years = array_map(fn ($item) => $item['year'] ?? null, $content['items'] ?? []);
        if ($years !== ['1965', '—', 'Kini']) {
            return;
        }

        $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];
        $content['items'] = CmsPageSeeder::historyItems($t);
        if (($content['heading']['id'] ?? null) === 'Jejak singkat.') {
            $content['heading'] = $t('Sejarah perusahaan.', 'Company history.');
        }
        DB::table('page_sections')->where('id', $row->id)->update([
            'content' => json_encode($content, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        // Konten baru tetap valid untuk skema lama (field tambahan diabaikan); tidak ada yang perlu dipulihkan.
    }

    private function historySection(): ?object
    {
        $pageId = DB::table('pages')->where('slug', 'tentang')->value('id');
        if (! $pageId) {
            return null;
        }

        return DB::table('page_sections')->where('page_id', $pageId)->where('key', 'history')->where('type', 'timeline')->first(['id', 'content']);
    }
}
