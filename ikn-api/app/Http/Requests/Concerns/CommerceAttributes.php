<?php

namespace App\Http\Requests\Concerns;

// Nama atribut validasi area order & pembayaran (resources/lang/{id,en}/commerce.php kunci "attributes").
trait CommerceAttributes
{
    public function attributes(): array
    {
        $attributes = __('commerce.attributes');

        return is_array($attributes) ? $attributes : [];
    }
}
