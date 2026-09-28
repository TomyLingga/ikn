<?php

namespace App\Services\Commerce;

use App\Models\Setting;
use Illuminate\Validation\ValidationException;

/**
 * Pengaturan commerce (kontrak 11.5): disimpan di tabel settings grup "commerce" (key "commerce.<name>", is_public=false).
 * Default dari config('ikn.commerce.defaults'). Terpisah dari SettingsService (pengaturan situs company profile, ASUMSI A-29).
 */
class CommerceSettings
{
    public const GROUP = 'commerce';

    /** key => [tipe, min, max] */
    public const SCHEMA = [
        'payment_due_hours' => ['int', 1, 720],
        'unique_code_enabled' => ['bool', null, null],
        'tax_rate' => ['float', 0, 100],
        'price_includes_tax' => ['bool', null, null],
        'auto_complete_days' => ['int', 0, 90],
        'reminder_hours_before_due' => ['int', 0, 168],
    ];

    /** Nama kunci di JSON (camelCase) ↔ kunci setting (snake_case). */
    public const JSON_KEYS = [
        'paymentDueHours' => 'payment_due_hours',
        'uniqueCodeEnabled' => 'unique_code_enabled',
        'taxRate' => 'tax_rate',
        'priceIncludesTax' => 'price_includes_tax',
        'autoCompleteDays' => 'auto_complete_days',
        'reminderHoursBeforeDue' => 'reminder_hours_before_due',
    ];

    /** @var array<string, mixed>|null cache per request */
    private ?array $cache = null;

    /** @return int|float|bool */
    public function get(string $key)
    {
        $all = $this->all();
        if (! array_key_exists($key, $all)) {
            throw new \InvalidArgumentException("Unknown commerce setting '{$key}'.");
        }

        return $all[$key];
    }

    /** Semua kunci (snake_case) dengan tipe yang sudah dicast. */
    public function all(): array
    {
        if ($this->cache !== null) {
            return $this->cache;
        }

        $stored = Setting::where('group', self::GROUP)->get()->keyBy('key');
        $out = [];
        foreach (self::SCHEMA as $key => [$type]) {
            $row = $stored[self::GROUP.'.'.$key] ?? null;
            $out[$key] = $this->cast($type, $row ? $row->value : $this->default($key));
        }

        return $this->cache = $out;
    }

    /** Bentuk JSON kontrak (camelCase). */
    public function toApi(): array
    {
        $all = $this->all();
        $out = [];
        foreach (self::JSON_KEYS as $json => $key) {
            $out[$json] = $all[$key];
        }

        return $out;
    }

    /**
     * Terima kunci camelCase (kontrak) atau snake_case; hanya kunci di skema yang disimpan (parsial boleh).
     *
     * @throws ValidationException
     */
    public function update(array $input): array
    {
        $errors = [];
        $clean = [];

        foreach ($input as $inputKey => $value) {
            $key = self::JSON_KEYS[$inputKey] ?? (array_key_exists($inputKey, self::SCHEMA) ? $inputKey : null);
            if ($key === null) {
                continue; // kunci asing diabaikan
            }
            [$type, $min, $max] = self::SCHEMA[$key];
            $jsonKey = array_search($key, self::JSON_KEYS, true) ?: $key;

            $casted = $this->validate($type, $value, $min, $max);
            if ($casted === null) {
                $errors[$jsonKey] = [__('catalog.setting_invalid', ['min' => $min, 'max' => $max])];
                continue;
            }
            $clean[$key] = $casted;
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }

        foreach ($clean as $key => $value) {
            Setting::putValue(self::GROUP.'.'.$key, $value, self::GROUP, false);
        }
        $this->cache = null;

        return $this->toApi();
    }

    /** Isi default untuk kunci yang belum ada (seeder). */
    public function seedDefaults(): void
    {
        foreach (self::SCHEMA as $key => $def) {
            $fullKey = self::GROUP.'.'.$key;
            if (! Setting::find($fullKey)) {
                Setting::putValue($fullKey, $this->default($key), self::GROUP, false);
            }
        }
        $this->cache = null;
    }

    public function forget(): void
    {
        $this->cache = null;
    }

    private function default(string $key)
    {
        return config('ikn.commerce.defaults.'.$key);
    }

    /** @return int|float|bool|null null = tidak valid */
    private function validate(string $type, $value, $min, $max)
    {
        switch ($type) {
            case 'bool':
                $bool = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

                return $bool;
            case 'int':
                if (! is_numeric($value) || (int) $value != $value) {
                    return null;
                }
                $int = (int) $value;

                return ($min !== null && $int < $min) || ($max !== null && $int > $max) ? null : $int;
            case 'float':
                if (! is_numeric($value)) {
                    return null;
                }
                $float = round((float) $value, 2);

                return ($min !== null && $float < $min) || ($max !== null && $float > $max) ? null : $float;
        }

        return null;
    }

    /** @return int|float|bool */
    private function cast(string $type, $value)
    {
        switch ($type) {
            case 'bool':
                return (bool) $value;
            case 'int':
                return (int) $value;
            case 'float':
                $float = (float) $value;

                return floor($float) == $float ? (int) $float : $float; // 11 tampil sebagai 11, 11.5 tetap 11.5
        }

        return $value;
    }
}
