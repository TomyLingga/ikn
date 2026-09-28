<?php

namespace App\Support;

// Field translatable disimpan sebagai jsonb { "id": "...", "en": "..." }.
// Server menjamin "en" tidak pernah kosong (fallback ke "id"), lihat ASUMSI A-3.
final class I18n
{
    public const LOCALES = ['id', 'en'];

    /** @param mixed $value string|array|null */
    public static function normalize($value): array
    {
        if (is_string($value)) {
            $value = ['id' => $value];
        }

        if (! is_array($value)) {
            $value = [];
        }

        $id = self::clean($value['id'] ?? '');
        $en = self::clean($value['en'] ?? '');

        return ['id' => $id, 'en' => $en !== '' ? $en : $id];
    }

    /** Seperti normalize(), tetapi tiap bahasa disanitasi sebagai HTML (lihat Html::clean). */
    public static function normalizeHtml($value): array
    {
        $normalized = self::normalize($value);
        $id = Html::clean($normalized['id']);
        $en = Html::clean($normalized['en']);

        return ['id' => $id, 'en' => $en !== '' ? $en : $id];
    }

    public static function isEmpty($value): bool
    {
        $normalized = self::normalize($value);

        return $normalized['id'] === '' && $normalized['en'] === '';
    }

    /** Ambil satu bahasa dengan fallback. */
    public static function pick($value, ?string $locale = null): string
    {
        $locale = $locale ?: app()->getLocale();
        $normalized = self::normalize($value);

        return $normalized[$locale] !== '' ? $normalized[$locale] : $normalized['id'];
    }

    /** Aturan validasi untuk satu field translatable (dot notation). */
    public static function rules(string $field, bool $required = true, int $max = 5000): array
    {
        return [
            $field => [$required ? 'required' : 'nullable', 'array'],
            "$field.id" => [$required ? 'required' : 'nullable', 'string', "max:$max"],
            "$field.en" => ['nullable', 'string', "max:$max"],
        ];
    }

    private static function clean($value): string
    {
        return is_scalar($value) ? trim((string) $value) : '';
    }
}
