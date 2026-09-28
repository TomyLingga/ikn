<?php

namespace App\Http\Requests\Concerns;

// Nama atribut validasi area katalog (resources/lang/{id,en}/catalog.php kunci "attributes").
trait CatalogAttributes
{
    public function attributes(): array
    {
        $attributes = __('catalog.attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
