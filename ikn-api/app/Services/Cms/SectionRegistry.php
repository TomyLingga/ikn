<?php

namespace App\Services\Cms;

use App\Exceptions\ApiException;
use App\Models\Media;
use App\Support\I18n;

/**
 * Registry tipe section CMS (arsitektur bagian 11.1).
 *
 * Setiap tipe punya skema field. Skema dipakai untuk tiga hal sekaligus:
 * validasi konten (rules), normalisasi sebelum simpan (normalize), dan
 * form admin yang dibangun otomatis di FE (GET /admin/cms/section-types).
 * Tipe dan tampilannya tetap milik FE; admin hanya mengubah isi/urutan/tampil.
 */
class SectionRegistry
{
    public const FIELD_TYPES = [
        'text', 'textarea', 'number', 'boolean', 'url', 'icon', 'select', 'media', 'color',
        'i18n_text', 'i18n_textarea', 'i18n_richtext', 'list',
    ];

    // Mengikuti IconName di ikn-fe/lib/types.ts.
    public const ICONS = [
        'arrow', 'arrowDown', 'chevronLeft', 'chevronRight', 'play', 'leaf', 'flask', 'handshake', 'target',
        'compass', 'gear', 'pin', 'phone', 'mail', 'bag', 'image', 'trash', 'orders', 'wallet', 'shieldCheck',
        'package', 'truck', 'checkCircle', 'cancelCircle', 'trendUp', 'users', 'paymentCheck', 'drop', 'check',
        'plus', 'close', 'quote', 'sun', 'moon', 'menu', 'panelLeft',
    ];

    private ?array $definitions = null;

    /** @return array<string, array> */
    public function types(): array
    {
        return $this->definitions ??= SectionDefinitions::all();
    }

    public function has(string $type): bool
    {
        return array_key_exists($type, $this->types());
    }

    public function definition(string $type): array
    {
        if (! $this->has($type)) {
            throw new ApiException(422, 'VALIDATION_ERROR', __('api.section_type_unknown'), ['type' => $type]);
        }

        return $this->types()[$type];
    }

    /** Konten kosong sesuai skema (untuk section baru). */
    public function defaults(string $type): array
    {
        return $this->normalize($type, []);
    }

    // ---------------------------------------------------------------- rules

    public function rules(string $type, string $prefix = 'content'): array
    {
        $rules = [$prefix => ['required', 'array']];
        $this->fieldRules($prefix, $this->definition($type)['fields'], $rules);

        return $rules;
    }

    private function fieldRules(string $path, array $fields, array &$rules): void
    {
        foreach ($fields as $key => $field) {
            $fieldPath = "$path.$key";
            $required = ! empty($field['required']);
            $req = $required ? 'required' : 'nullable';
            $max = $field['max'] ?? 1000;

            switch ($field['type']) {
                case 'text':
                case 'textarea':
                case 'url':
                    $rules[$fieldPath] = [$req, 'string', "max:$max"];
                    break;
                case 'icon':
                    $rules[$fieldPath] = [$req, 'string', 'in:'.implode(',', self::ICONS)];
                    break;
                case 'color':
                    // Hex 6 digit (#rrggbb); kosong = warna bawaan tema.
                    $rules[$fieldPath] = [$req, 'string', 'regex:/^#[0-9a-fA-F]{6}$/'];
                    break;
                case 'select':
                    $rules[$fieldPath] = [$req, 'string', 'in:'.implode(',', array_keys($field['options'] ?? []))];
                    break;
                case 'number':
                    $rules[$fieldPath] = [$req, 'numeric'];
                    break;
                case 'boolean':
                    $rules[$fieldPath] = [$req, 'boolean'];
                    break;
                case 'media':
                    $rules[$fieldPath] = [$req, 'integer', 'exists:media,id'];
                    break;
                case 'i18n_text':
                case 'i18n_textarea':
                case 'i18n_richtext':
                    $max = $field['max'] ?? ($field['type'] === 'i18n_text' ? 500 : 20000);
                    $rules[$fieldPath] = [$req, 'array'];
                    $rules["$fieldPath.id"] = [$req, 'string', "max:$max"];
                    $rules["$fieldPath.en"] = ['nullable', 'string', "max:$max"];
                    break;
                case 'list':
                    $rules[$fieldPath] = [$req, 'array', 'max:'.($field['max_items'] ?? 100)];
                    $this->fieldRules("$fieldPath.*", $field['fields'], $rules);
                    break;
            }
        }
    }

    // ------------------------------------------------------------ normalize

    /** Bentuk konten menjadi rapi: semua key ada, i18n lengkap, media jadi id. */
    public function normalize(string $type, $content): array
    {
        return $this->normalizeFields($this->definition($type)['fields'], is_array($content) ? $content : []);
    }

    private function normalizeFields(array $fields, array $input): array
    {
        $out = [];
        foreach ($fields as $key => $field) {
            $out[$key] = $this->normalizeField($field, $input[$key] ?? null);
        }

        return $out;
    }

    private function normalizeField(array $field, $value)
    {
        switch ($field['type']) {
            case 'text':
            case 'textarea':
            case 'url':
            case 'icon':
            case 'select':
                return is_scalar($value) ? trim((string) $value) : '';
            case 'number':
                return is_numeric($value) ? $value + 0 : null;
            case 'color':
                // Valid -> lowercase; kosong -> ''; tidak valid dibiarkan agar validator menolak (422).
                $value = is_string($value) ? trim($value) : '';

                return preg_match('/^#[0-9a-fA-F]{6}$/', $value) ? strtolower($value) : $value;
            case 'boolean':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
            case 'media':
                if (is_array($value)) {
                    $value = $value['id'] ?? null;
                }

                return is_numeric($value) && (int) $value > 0 ? (int) $value : null;
            case 'i18n_text':
            case 'i18n_textarea':
                return I18n::normalize($value);
            case 'i18n_richtext':
                return I18n::normalizeHtml($value);
            case 'list':
                if (! is_array($value)) {
                    return [];
                }

                return array_values(array_map(
                    fn ($item) => $this->normalizeFields($field['fields'], is_array($item) ? $item : []),
                    $value
                ));
        }

        return $value;
    }

    // -------------------------------------------------------------- hydrate

    /** Untuk output: field media diganti ringkasan { id, url, mime, originalName }. */
    public function hydrate(string $type, array $content): array
    {
        $ids = $this->collectMediaIds($type, $content);
        $media = $ids ? Media::whereIn('id', $ids)->get()->keyBy('id') : collect();

        return $this->hydrateFields($this->definition($type)['fields'], $content, $media);
    }

    private function hydrateFields(array $fields, array $content, $media): array
    {
        foreach ($fields as $key => $field) {
            if (! array_key_exists($key, $content)) {
                continue;
            }
            if ($field['type'] === 'media') {
                $id = $content[$key];
                $content[$key] = $id && isset($media[$id]) ? $media[$id]->toSummary() : null;
            } elseif ($field['type'] === 'list' && is_array($content[$key])) {
                $content[$key] = array_map(
                    fn ($item) => $this->hydrateFields($field['fields'], is_array($item) ? $item : [], $media),
                    $content[$key]
                );
            }
        }

        return $content;
    }

    /** @return int[] */
    public function collectMediaIds(string $type, array $content): array
    {
        if (! $this->has($type)) {
            return [];
        }

        $ids = [];
        $this->walkMedia($this->types()[$type]['fields'], $content, $ids);

        return array_values(array_unique(array_map('intval', $ids)));
    }

    private function walkMedia(array $fields, array $content, array &$ids): void
    {
        foreach ($fields as $key => $field) {
            $value = $content[$key] ?? null;
            if ($field['type'] === 'media') {
                $id = is_array($value) ? ($value['id'] ?? null) : $value;
                if (is_numeric($id) && (int) $id > 0) {
                    $ids[] = (int) $id;
                }
            } elseif ($field['type'] === 'list' && is_array($value)) {
                foreach ($value as $item) {
                    if (is_array($item)) {
                        $this->walkMedia($field['fields'], $item, $ids);
                    }
                }
            }
        }
    }
}
