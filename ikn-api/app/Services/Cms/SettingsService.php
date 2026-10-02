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
        'site.footer_connect_text' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Ikuti kabar terbaru produk, sertifikasi, dan kegiatan PT IKN di media sosial kami.', 'en' => 'Follow the latest on PT IKN products, certifications, and activities on our social channels.']],
        'site.footer_contact_text' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Butuh penawaran, sampel, atau spesifikasi teknis? Tim marketing kami siap membantu.', 'en' => 'Need a quote, a sample, or technical specs? Our sales team is ready to help.']],
        'site.subsidiary_note' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Anak perusahaan PTPN III (Persero)', 'en' => 'Subsidiary of PTPN III (Persero)']],
        'seo.default_title' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'PT Industri Karet Nusantara — Hilir Karet Berkualitas', 'en' => 'PT Industri Karet Nusantara — Quality Downstream Rubber']],
        'seo.default_description' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'PT Industri Karet Nusantara (PT IKN) adalah perusahaan hilir karet berpengalaman sejak 1965, memproduksi Resiprene 35 dan aneka barang karet dari Medan, Sumatera Utara.', 'en' => 'PT Industri Karet Nusantara (PT IKN) is a downstream rubber company established in 1965, producing Resiprene 35 and rubber articles in Medan, North Sumatra.']],
        // Kanal chat & analitik (checklist digital marketing klien: WhatsApp Business, Google Analytics, Search Console).
        'contact.whatsapp' => ['type' => 'text', 'public' => true, 'default' => '628116123993'], // nomor uji pemilik 2026-10-01, ganti di Pengaturan Situs
        'contact.whatsapp_message' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Halo PT IKN, saya ingin bertanya tentang produk Anda.', 'en' => 'Hello PT IKN, I would like to ask about your products.']],
        // Nomor WhatsApp marketing tambahan [{label, number}] (maks. 10); bersama contact.whatsapp menjadi daftar
        // pilihan di tombol melayang, footer, dan halaman Kontak. Label = nama tim/orang, mis. "Marketing Resiprene".
        'contact.whatsapp_contacts' => ['type' => 'whatsapp_contacts', 'public' => true, 'default' => []],
        'analytics.ga_measurement_id' => ['type' => 'text', 'public' => true, 'default' => ''],
        'analytics.gsc_verification' => ['type' => 'text', 'public' => true, 'default' => ''],
        // Tema warna situs (logo IKN: biru dan putih). Hex #rrggbb; kosong = warna bawaan di ikn-fe/app/globals.css.
        // FE menyuntik nilai valid sebagai --theme-primary/--theme-primary-deep/--theme-accent di root layout (lib/theme.ts).
        'theme.primary' => ['type' => 'color', 'public' => true, 'default' => '#0b6fb8'],
        'theme.primary_deep' => ['type' => 'color', 'public' => true, 'default' => '#0a3f6b'],
        'theme.accent' => ['type' => 'color', 'public' => true, 'default' => '#1785cc'],
        // Panel foto/video halaman login, daftar, dan lupa password (ASUMSI A-79): [{mediaId, caption {id,en}}], maks. 6.
        // Kosong = foto bawaan di FE (components/auth/AuthVisual).
        'auth.slides' => ['type' => 'media_slides', 'public' => true, 'default' => []],
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
            [$clean, $error] = $this->clean($def['type'], $value, $key);
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

    private function clean(string $type, $value, string $key = ''): array
    {
        switch ($type) {
            case 'text':
                return [is_scalar($value) || $value === null ? trim((string) $value) : '', null];
            case 'color':
                $value = is_scalar($value) || $value === null ? strtolower(trim((string) $value)) : null;
                if ($value === '') {
                    return ['', null];
                }
                if ($value === null || ! preg_match('/^#[0-9a-f]{6}$/', $value)) {
                    return [null, __('validation.regex', ['attribute' => $key])];
                }

                return [$value, null];
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
            case 'whatsapp_contacts':
                return $this->cleanWhatsAppContacts($value, $key);
            case 'media_slides':
                return $this->cleanMediaSlides($value, $key);
        }

        return [$value, null];
    }

    /** Daftar slide {mediaId, caption}: media harus gambar atau video yang ada; maks. 6; baris tanpa media dibuang. */
    private function cleanMediaSlides($value, string $key): array
    {
        if ($value === null || $value === '') {
            return [[], null];
        }
        if (! is_array($value)) {
            return [null, __('validation.array', ['attribute' => $key])];
        }

        $out = [];
        foreach (array_values($value) as $i => $row) {
            $id = is_array($row) ? ($row['mediaId'] ?? ($row['media']['id'] ?? null)) : null;
            if ($id === null || $id === '') {
                continue;
            }
            $media = is_numeric($id) ? Media::find((int) $id) : null;
            if (! $media || ! (str_starts_with((string) $media->mime, 'image/') || str_starts_with((string) $media->mime, 'video/'))) {
                return [null, __('validation.exists', ['attribute' => "{$key}.{$i}.mediaId"])];
            }
            $out[] = ['mediaId' => (int) $media->id, 'caption' => I18n::normalize($row['caption'] ?? null)];
            if (count($out) > 6) {
                return [null, __('validation.max.array', ['attribute' => $key, 'max' => 6])];
            }
        }

        return [$out, null];
    }

    /** Daftar {label, number}: nomor dinormalkan ke 62…, baris kosong dibuang, nomor ganda ditolak. */
    private function cleanWhatsAppContacts($value, string $key): array
    {
        if ($value === null || $value === '') {
            return [[], null];
        }
        if (! is_array($value)) {
            return [null, __('validation.array', ['attribute' => $key])];
        }

        $out = [];
        foreach (array_values($value) as $i => $row) {
            $label = is_array($row) ? trim((string) ($row['label'] ?? '')) : '';
            $raw = is_array($row) ? (string) ($row['number'] ?? '') : (string) $row;
            $number = preg_replace('/[^0-9]/', '', $raw);
            if (str_starts_with($number, '0')) {
                $number = '62'.substr($number, 1);
            }
            if ($label === '' && $number === '') {
                continue;
            }
            if (strlen($number) < 9 || strlen($number) > 15) {
                return [null, __('validation.regex', ['attribute' => "{$key}.{$i}.number"])];
            }
            if (mb_strlen($label) > 60) {
                return [null, __('validation.max.string', ['attribute' => "{$key}.{$i}.label", 'max' => 60])];
            }
            if (in_array($number, array_column($out, 'number'), true)) {
                return [null, __('validation.distinct', ['attribute' => "{$key}.{$i}.number"])];
            }
            $out[] = ['label' => $label, 'number' => $number];
            if (count($out) > 10) {
                return [null, __('validation.max.array', ['attribute' => $key, 'max' => 10])];
            }
        }

        return [$out, null];
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
        if ($type === 'media_slides') {
            if (! is_array($value)) {
                return [];
            }
            $media = Media::whereIn('id', array_filter(array_column($value, 'mediaId')))->get()->keyBy('id');

            return array_values(array_filter(array_map(fn ($row) => isset($media[$row['mediaId'] ?? 0])
                ? ['media' => $media[$row['mediaId']]->toSummary(), 'caption' => I18n::normalize($row['caption'] ?? null)]
                : null, $value)));
        }
        if ($type === 'whatsapp_contacts') {
            return is_array($value) ? array_values(array_map(fn ($row) => ['label' => (string) ($row['label'] ?? ''), 'number' => (string) ($row['number'] ?? '')], $value)) : [];
        }

        return $value;
    }
}
