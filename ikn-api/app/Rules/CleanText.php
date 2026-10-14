<?php

namespace App\Rules;

use App\Support\Profanity;
use Illuminate\Contracts\Validation\Rule;

// Menolak teks yang mengandung kata kasar (config/profanity.php). Dipakai pada isi ulasan customer.
class CleanText implements Rule
{
    public function __construct(private string $messageKey = 'commerce.review_profanity')
    {
    }

    public function passes($attribute, $value): bool
    {
        return ! is_string($value) || ! Profanity::contains($value);
    }

    public function message(): string
    {
        return __($this->messageKey);
    }
}
