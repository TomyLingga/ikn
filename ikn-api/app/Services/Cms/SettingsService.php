<?php

namespace App\Services\Cms;

use App\Models\Media;
use App\Models\Setting;
use App\Support\I18n;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Skema settings: kunci "group.name" → tipe, publik/privat, default.
 * GET mengembalikan bentuk bersarang { company: { name: ... } }.
 *
 * Tipe: text, i18n, media, json, color, whatsapp_contacts, media_slides, bool, int (min/max), enum (options),
 * email, secret (dienkripsi di DB, output selalu SECRET_MASK bila terisi; kirim balik mask = tidak mengubah).
 */
class SettingsService
{
    /** Nilai pengganti rahasia pada output; PUT dengan nilai ini mempertahankan rahasia tersimpan. */
    public const SECRET_MASK = '********';

    public const MAIL_MODES = ['server', 'smtp', 'off'];
    public const MAIL_ENCRYPTIONS = ['ssl', 'tls', ''];

    public const SCHEMA = [
        'company.name' => ['type' => 'text', 'public' => true, 'default' => 'PT Industri Karet Nusantara'],
        'company.short' => ['type' => 'text', 'public' => true, 'default' => 'PT IKN'],
        'company.parent' => ['type' => 'text', 'public' => true, 'default' => 'PT Perkebunan Nusantara III'],
        'company.since' => ['type' => 'text', 'public' => true, 'default' => '1965'],
        'company.location' => ['type' => 'text', 'public' => true, 'default' => 'Medan, Sumatera Utara'],
        'company.tagline' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Resiprene 35 dan barang karet industri dari Sumatera Utara.', 'en' => 'Resiprene 35 and industrial rubber goods from North Sumatra.']],
        'company.profile_document' => ['type' => 'media', 'public' => true, 'default' => null],
        'site.footer_headline' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Barang karet industri dari Medan, sejak 1965.', 'en' => 'Industrial rubber goods from Medan since 1965.']],
        'site.footer_cta_label' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Mulai percakapan', 'en' => 'Start a conversation']],
        'site.footer_connect_text' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Ikuti kabar terbaru produk, sertifikasi, dan kegiatan PT IKN di media sosial kami.', 'en' => 'Follow the latest on PT IKN products, certifications, and activities on our social channels.']],
        'site.footer_contact_text' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Butuh penawaran, sampel, atau spesifikasi teknis? Tim marketing kami siap membantu.', 'en' => 'Need a quote, a sample, or technical specs? Our sales team is ready to help.']],
        'site.subsidiary_note' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'Anak perusahaan PTPN III (Persero)', 'en' => 'Subsidiary of PTPN III (Persero)']],
        'seo.default_title' => ['type' => 'i18n', 'public' => true, 'default' => ['id' => 'PT Industri Karet Nusantara | Pabrik Karet Industri Medan', 'en' => 'PT Industri Karet Nusantara | Industrial Rubber Maker, Medan']],
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
        // Kop dan kaki cetakan invoice dari gambar (ASUMSI A-83): lebar penuh halaman, PNG/JPG; kosong = kop/kaki
        // dirender FE dari teks. Bawaan diisi MediaSeeder (hasil pindai kop surat klien).
        'invoice.header_image' => ['type' => 'media', 'mime' => 'image/', 'public' => true, 'default' => null],
        'invoice.footer_image' => ['type' => 'media', 'mime' => 'image/', 'public' => true, 'default' => null],
        // Pengiriman email notifikasi (ASUMSI A-82), privat. mode: server = ikut MAIL_* di .env server;
        // smtp = SMTP di bawah (webmail/cPanel/Hostinger milik klien); off = email tidak dikirim, notifikasi
        // dalam aplikasi tetap berjalan. Diterapkan ke config mail saat runtime oleh App\Services\Mail\MailConfigurator.
        'mail.mode' => ['type' => 'enum', 'options' => self::MAIL_MODES, 'public' => false, 'default' => 'server'],
        'mail.host' => ['type' => 'text', 'public' => false, 'default' => ''],
        'mail.port' => ['type' => 'int', 'min' => 1, 'max' => 65535, 'public' => false, 'default' => 465],
        'mail.encryption' => ['type' => 'enum', 'options' => self::MAIL_ENCRYPTIONS, 'public' => false, 'default' => 'ssl'],
        'mail.username' => ['type' => 'text', 'public' => false, 'default' => ''],
        'mail.password' => ['type' => 'secret', 'public' => false, 'default' => ''],
        'mail.from_address' => ['type' => 'email', 'public' => false, 'default' => ''],
        'mail.from_name' => ['type' => 'text', 'public' => false, 'default' => 'PT Industri Karet Nusantara'],
    ];

    /** Kunci setting bertipe media (nilai = id media), dipakai MediaService untuk melindungi berkas dari hapus. */
    public static function mediaKeys(): array
    {
        return array_keys(array_filter(self::SCHEMA, fn ($def) => $def['type'] === 'media'));
    }

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

    /** Nilai asli setting bertipe secret (didekripsi). Gagal dekripsi (APP_KEY berganti) dianggap kosong. */
    public function secret(string $key): string
    {
        $def = self::SCHEMA[$key] ?? null;
        if (! $def || $def['type'] !== 'secret') {
            return '';
        }
        $stored = Setting::getValue($key, '');
        if (! is_string($stored) || $stored === '') {
            return '';
        }

        try {
            return Crypt::decryptString($stored);
        } catch (DecryptException $e) {
            Log::warning("setting {$key} cannot be decrypted (APP_KEY changed?)");

            return '';
        }
    }

    /**
     * Terima bentuk bersarang atau datar; hanya kunci di skema yang disimpan.
     * Semua nilai dibersihkan dulu; bila ada yang tidak valid, tidak ada yang ditulis.
     */
    public function update(array $input): array
    {
        $flat = Arr::dot($input);
        $errors = [];
        $pending = [];

        foreach (self::SCHEMA as $key => $def) {
            $present = array_key_exists($key, $flat) || Arr::has($input, $key);
            if (! $present) {
                continue;
            }

            $value = Arr::get($input, $key);
            if ($def['type'] === 'secret' && $value === self::SECRET_MASK) {
                continue; // mask dikirim balik = rahasia tidak diubah
            }
            [$clean, $error] = $this->clean($def, $value, $key);
            if ($error) {
                $errors[$key] = [$error];
                continue;
            }

            $pending[$key] = $clean;
        }

        $errors += $this->validateMailGroup($pending);

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        foreach ($pending as $key => $clean) {
            $def = self::SCHEMA[$key];
            if ($def['type'] === 'secret' && $clean !== '') {
                $clean = Crypt::encryptString($clean);
            }
            Setting::putValue($key, $clean, explode('.', $key)[0], $def['public']);
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

    /** Mode smtp butuh host dan alamat pengirim (nilai tersimpan dihitung bila tidak dikirim). */
    private function validateMailGroup(array $pending): array
    {
        if (! array_filter(array_keys($pending), fn ($key) => str_starts_with($key, 'mail.'))) {
            return [];
        }
        $mode = $pending['mail.mode'] ?? ($this->get('mail.mode') ?: 'server');
        if ($mode !== 'smtp') {
            return [];
        }

        $errors = [];
        foreach (['mail.host', 'mail.from_address'] as $key) {
            $value = array_key_exists($key, $pending) ? $pending[$key] : (string) $this->get($key);
            if (trim((string) $value) === '') {
                $errors[$key] = [__('validation.required', ['attribute' => $key])];
            }
        }

        return $errors;
    }

    private function clean(array $def, $value, string $key = ''): array
    {
        switch ($def['type']) {
            case 'text':
                return [is_scalar($value) || $value === null ? trim((string) $value) : '', null];
            case 'secret':
                return [is_scalar($value) || $value === null ? (string) $value : '', null];
            case 'email':
                $value = is_scalar($value) || $value === null ? trim((string) $value) : null;
                if ($value === '') {
                    return ['', null];
                }
                if ($value === null || filter_var($value, FILTER_VALIDATE_EMAIL) === false) {
                    return [null, __('validation.email', ['attribute' => $key])];
                }

                return [strtolower($value), null];
            case 'bool':
                return [filter_var($value, FILTER_VALIDATE_BOOLEAN), null];
            case 'int':
                if ($value === '' || $value === null || ! is_numeric($value) || (int) $value != $value) {
                    return [null, __('validation.integer', ['attribute' => $key])];
                }
                $value = (int) $value;
                if (isset($def['min']) && $value < $def['min']) {
                    return [null, __('validation.min.numeric', ['attribute' => $key, 'min' => $def['min']])];
                }
                if (isset($def['max']) && $value > $def['max']) {
                    return [null, __('validation.max.numeric', ['attribute' => $key, 'max' => $def['max']])];
                }

                return [$value, null];
            case 'enum':
                $value = is_scalar($value) || $value === null ? strtolower(trim((string) $value)) : null;
                if ($value === null || ! in_array($value, $def['options'], true)) {
                    return [null, __('validation.in', ['attribute' => $key])];
                }

                return [$value, null];
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
                $media = is_numeric($value) ? Media::find((int) $value) : null;
                if (! $media) {
                    return [null, __('validation.exists', ['attribute' => 'mediaId'])];
                }
                if (! empty($def['mime']) && ! str_starts_with((string) $media->mime, $def['mime'])) {
                    return [null, __('validation.mimes', ['attribute' => $key, 'values' => rtrim($def['mime'], '/')])];
                }

                return [(int) $media->id, null];
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
        if ($type === 'secret') {
            return is_string($value) && $value !== '' ? self::SECRET_MASK : '';
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
