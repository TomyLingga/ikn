<?php

namespace App\Support;

// Trait model: kolom di $translatable selalu dinormalisasi {id,en} saat disimpan dan dibaca.
trait HasTranslations
{
    public function initializeHasTranslations(): void
    {
        foreach ($this->translatable ?? [] as $field) {
            $this->casts[$field] = 'array';
        }
    }

    public function setAttribute($key, $value)
    {
        if (in_array($key, $this->translatable ?? [], true)) {
            $value = I18n::normalize($value);
        }

        return parent::setAttribute($key, $value);
    }

    public function getAttribute($key)
    {
        $value = parent::getAttribute($key);

        if (in_array($key, $this->translatable ?? [], true)) {
            return I18n::normalize($value);
        }

        return $value;
    }

    /** Teks satu bahasa (mengikuti locale aktif). */
    public function tr(string $field, ?string $locale = null): string
    {
        return I18n::pick($this->getAttribute($field), $locale);
    }
}
