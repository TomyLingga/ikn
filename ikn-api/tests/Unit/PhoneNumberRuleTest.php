<?php

namespace Tests\Unit;

use App\Rules\PhoneNumber;
use PHPUnit\Framework\TestCase;

// Nomor telepon internasional dengan kode negara (ASUMSI A-78).
class PhoneNumberRuleTest extends TestCase
{
    public function test_accepts_international_numbers_with_country_code(): void
    {
        $this->assertSame('+6281234567890', PhoneNumber::normalize('+62 812-3456-7890'));
        $this->assertSame('+60123456789', PhoneNumber::normalize('+60 12-345 6789')); // Malaysia
        $this->assertSame('+6591234567', PhoneNumber::normalize('+65 9123 4567')); // Singapura
        $this->assertSame('+14155552671', PhoneNumber::normalize('+1 (415) 555-2671')); // AS
        $this->assertSame('+31612345678', PhoneNumber::normalize('+31 6 12345678')); // Belanda
    }

    public function test_numbers_without_plus_are_treated_as_indonesian(): void
    {
        $this->assertSame('+6281234567890', PhoneNumber::normalize('081234567890'));
        $this->assertSame('+6281234567890', PhoneNumber::normalize('6281234567890'));
        $this->assertSame('+62618889999', PhoneNumber::normalize('061 888 9999'));
        $this->assertNull(PhoneNumber::normalize('81234567890')); // tanpa 0/62/+ → kode negara tidak jelas
    }

    public function test_rejects_invalid_numbers(): void
    {
        foreach (['', '12345', '+1 12', '+0 812345678', '+62 0812 3456 7890', '+1234567890123456', 'abc', '+62-81x'] as $bad) {
            $this->assertNull(PhoneNumber::normalize($bad), $bad);
        }
    }
}
