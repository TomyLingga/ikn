<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

// Section hero: label meta memakai warna bebas (color picker) menggantikan pilihan Normal/Hijau,
// dan tombol menjadi daftar (0..3) menggantikan pasangan primary_*/secondary_* yang tetap.
class ConvertHeroSectionsToColorAndButtons extends Migration
{
    private const LEGACY_GREEN = '#8fd1a6'; // warna .label-green di atas hero (pages.css)

    public function up(): void
    {
        foreach (DB::table('page_sections')->where('type', 'hero')->get() as $row) {
            $content = json_decode($row->content, true) ?: [];

            $content['meta'] = array_map(function ($item) {
                $item = is_array($item) ? $item : [];
                if (! array_key_exists('color', $item)) {
                    $item['color'] = ($item['style'] ?? '') === 'green' ? self::LEGACY_GREEN : '';
                }
                unset($item['style']);

                return $item;
            }, $content['meta'] ?? []);

            if (! array_key_exists('buttons', $content)) {
                $buttons = [];
                foreach ([['primary', 'solid', false], ['secondary', 'outline', true]] as [$prefix, $style, $profile]) {
                    $label = $content[$prefix.'_label'] ?? null;
                    if (is_array($label) && trim((string) ($label['id'] ?? '')) !== '') {
                        $buttons[] = [
                            'label' => $label,
                            'url' => $content[$prefix.'_url'] ?? '',
                            'style' => $style,
                            'profile_document' => $profile,
                            'new_tab' => false,
                        ];
                    }
                }
                $content['buttons'] = $buttons;
            }
            unset($content['primary_label'], $content['primary_url'], $content['secondary_label'], $content['secondary_url']);

            DB::table('page_sections')->where('id', $row->id)->update(['content' => json_encode($content)]);
        }
    }

    public function down(): void
    {
        foreach (DB::table('page_sections')->where('type', 'hero')->get() as $row) {
            $content = json_decode($row->content, true) ?: [];

            $content['meta'] = array_map(function ($item) {
                $item = is_array($item) ? $item : [];
                $item['style'] = ($item['color'] ?? '') !== '' ? 'green' : 'plain';
                unset($item['color']);

                return $item;
            }, $content['meta'] ?? []);

            $buttons = array_values($content['buttons'] ?? []);
            $content['primary_label'] = $buttons[0]['label'] ?? ['id' => '', 'en' => ''];
            $content['primary_url'] = $buttons[0]['url'] ?? '';
            $content['secondary_label'] = $buttons[1]['label'] ?? ['id' => '', 'en' => ''];
            $content['secondary_url'] = $buttons[1]['url'] ?? '';
            unset($content['buttons']);

            DB::table('page_sections')->where('id', $row->id)->update(['content' => json_encode($content)]);
        }
    }
}
