<?php

namespace App\Support;

// Daftar string per bahasa: jsonb { "id": ["..."], "en": ["..."] } (highlights, applications produk).
// Input boleh berupa string[] (dianggap bahasa Indonesia) atau { id: [], en: [] }; "en" kosong diisi dari "id".
final class I18nList
{
    /** @param mixed $value */
    public static function normalize($value): array
    {
        if (! is_array($value)) {
            return ['id' => [], 'en' => []];
        }

        if (array_is_list($value)) {
            $value = ['id' => $value];
        }

        $id = self::items($value['id'] ?? []);
        $en = self::items($value['en'] ?? []);

        return ['id' => $id, 'en' => $en ?: $id];
    }

    /** Aturan validasi (dot notation). */
    public static function rules(string $field, int $maxItems = 20, int $maxLength = 300): array
    {
        return [
            $field => ['nullable', 'array'],
            "$field.id" => ['nullable', 'array', "max:$maxItems"],
            "$field.id.*" => ['string', "max:$maxLength"],
            "$field.en" => ['nullable', 'array', "max:$maxItems"],
            "$field.en.*" => ['string', "max:$maxLength"],
        ];
    }

    private static function items($list): array
    {
        if (! is_array($list)) {
            return [];
        }

        $out = [];
        foreach ($list as $item) {
            if (is_scalar($item)) {
                $text = trim((string) $item);
                if ($text !== '') {
                    $out[] = $text;
                }
            }
        }

        return $out;
    }
}
