<?php

namespace App\Services\Cms;

use App\Models\Media;
use App\Models\Setting;
use App\Support\I18n;
use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

/**
 * Skema settings: kunci "group.name" → tipe, publik/privat, default.
 * GET mengembalikan bentuk bersarang { company: { name: ... } }.
 */
class SettingsService
{
    public const SCHEMA = [
        'company.name' => ['type' => 'text', 'public' => true, 'default' => 'PT Industri Karet Nusantara'],
        'company.short' => ['type' => 'text', 'public' => true, 'default' => 'PT IKN'],
        'company.parent' => ['type' => 'text', 'public' => true, 'default' => 'PT Perkebunan Nusantara III'],
        'company.since' => ['type' => 'text', 'public' => true, 'default' => '1965'],
        'company.location' => ['type' => 'text', 'public' => true, 'default' => 'Medan, Sumatera Utara'],
        'company.tagline' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Menghilirkan karet Nusantara jadi produk kelas dunia.', 'en' => 'Turning Nusantara rubber into world-class products.']],
        'company.profile_document' => ['type' => 'media', 'public' => true, 'default' => null],
        'site.footer_headline' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Karet hilir Nusantara, diproses untuk dunia.', 'en' => 'Nusantara downstream rubber, processed for the world.']],
        'site.footer_cta_label' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Mulai percakapan', 'en' => 'Start a conversation']],
        'site.subsidiary_note' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Anak perusahaan PTPN III (Persero)', 'en' => 'Subsidiary of PTPN III (Persero)']],
        'seo.default_title' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'PT Industri Karet Nusantara — Hilir Karet Berkualitas', 'en' => 'PT Industri Karet Nusantara — Quality Downstream Rubber']],
        'seo.default_description' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'PT Industri Karet Nusantara (PT IKN) adalah perusahaan hilir karet berpengalaman sejak 1965, memproduksi Resiprene 35 dan aneka barang karet dari Medan, Sumatera Utara.', 'en' => 'PT Industri Karet Nusantara (PT IKN) is a downstream rubber company established in 1965, producing Resiprene 35 and rubber articles in Medan, North Sumatra.']],
        // Kanal chat & analitik (checklist digital marketing klien: WhatsApp Business, Google Analytics, Search Console).
        'contact.whatsapp' => ['type' => 'text', 'public' => true, 'default' => ''],
        'contact.whatsapp_message' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Halo PT IKN, saya ingin bertanya tentang produk Anda.', 'en' => 'Hello PT IKN, I would like to ask about your products.']],
        'analytics.ga_measurement_id' => ['type' => 'text', 'public' => true, 'default' => ''],
        'analytics.gsc_verification' => ['type' => 'text', 'public' => true, 'default' => ''],
        'admin.help_guide' => ['type' => 'json', 'public' => false, 'default' => ['title' => 'Panduan Admin', 'type' => 'url', 'url' => '', 'mediaId' => null]],
    ];

    public function all(bool $publicOnly = false): array
    {
        $stored = Setting::all()->keyBy('key');
        $out = [];

        foreach (self::SCHEMA as $key => $def) {
            if ($publicOnly && ! $def['public']) {
                continue;
            }
            $value = isset($stored[$key]) ? $stored[$key]->value : $def['default'];
            Arr::set($out, $key, $this->present($def['type'], $value));
        }

        return $out;
    }

    public function get(string $key)
    {
        $def = self::SCHEMA[$key] ?? null;
        if (! $def) {
            return null;
        }

        return Setting::getValue($key, $def['default']);
    }

    /** Terima bentuk bersarang atau datar; hanya kunci di skema yang disimpan. */
    public function update(array $input): array
    {
        $flat = Arr::dot($input);
        $errors = [];

        foreach (self::SCHEMA as $key => $def) {
            $present = array_key_exists($key, $flat) || Arr::has($input, $key);
            if (! $present) {
                continue;
            }

            $value = Arr::get($input, $key);
            [$clean, $error] = $this->clean($def['type'], $value);
            if ($error) {
                $errors[$key] = [$error];
                continue;
            }

            Setting::putValue($key, $clean, explode('.', $key)[0], $def['public']);
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        return $this->all();
    }

    public function seedDefaults(): void
    {
        foreach (self::SCHEMA as $key => $def) {
            if (! Setting::find($key)) {
                Setting::putValue($key, $def['default'], explode('.', $key)[0], $def['public']);
            }
        }
    }

    private function clean(string $type, $value): array
    {
        switch ($type) {
            case 'text':
                return [is_scalar($value) || $value === null ? trim((string) $value) : '', null];
            case 'i18n':
                return [I18n::normalize($value), null];
            case 'media':
                if (is_array($value)) {
                    $value = $value['id'] ?? null;
                }
                if ($value === null || $value === '') {
                    return [null, null];
                }
                if (! is_numeric($value) || ! Media::where('id', (int) $value)->exists()) {
                    return [null, __('validation.exists', ['attribute' => 'mediaId'])];
                }

                return [(int) $value, null];
            case 'json':
                return [is_array($value) ? $value : null, null];
        }

        return [$value, null];
    }

    private function present(string $type, $value)
    {
        if ($type === 'i18n') {
            return I18n::normalize($value);
        }
        if ($type === 'media') {
            $media = $value ? Media::find((int) $value) : null;

            return $media ? $media->toSummary() : null;
        }

        return $value;
    }
}
