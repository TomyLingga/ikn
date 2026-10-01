<?php

use Database\Seeders\CmsPageSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Simpul bagan organisasi mendapat field `level` (warna kartu & legenda). Basis data yang sudah punya section
// org_chart tanpa level diisi dari peta seeder (per kunci); kunci di luar seeder dibiarkan '' (FE menurunkan dari
// kedalaman). down(): hapus field level.
class FillOrgChartNodeLevels extends Migration
{
    public function up(): void
    {
        $levels = CmsPageSeeder::orgChartLevels();
        foreach (DB::table('page_sections')->where('type', 'org_chart')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            $changed = false;
            foreach ($content['nodes'] ?? [] as $i => $node) {
                if (! is_array($node) || ($node['level'] ?? '') !== '') {
                    continue;
                }
                $key = (string) ($node['key'] ?? '');
                $content['nodes'][$i]['level'] = $levels[$key] ?? (array_key_exists($key, $levels) ? $levels[$key] : ($this->isSeedKey($key) ? 'pelaksana' : ''));
                $changed = true;
            }
            if ($changed) {
                DB::table('page_sections')->where('id', $row->id)
                    ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        foreach (DB::table('page_sections')->where('type', 'org_chart')->get(['id', 'content']) as $row) {
            $content = json_decode($row->content, true) ?: [];
            foreach ($content['nodes'] ?? [] as $i => $node) {
                unset($content['nodes'][$i]['level']);
            }
            DB::table('page_sections')->where('id', $row->id)
                ->update(['content' => json_encode($content, JSON_UNESCAPED_UNICODE), 'updated_at' => now()]);
        }
    }

    /** Kunci yang berasal dari seeder (bukan buatan admin) boleh diberi 'pelaksana' sebagai bawaan. */
    private function isSeedKey(string $key): bool
    {
        static $seedKeys = null;
        if ($seedKeys === null) {
            $t = fn (string $id, string $en) => ['id' => $id, 'en' => $en];
            $seedKeys = array_column(CmsPageSeeder::orgChartSection($t)['content']['nodes'], 'key');
        }

        return in_array($key, $seedKeys, true);
    }
}
