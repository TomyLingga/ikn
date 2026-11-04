<?php

namespace Tests\Unit;

use App\Support\Money;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

// Money (ASUMSI A-86): DB decimal satuan mayor ↔ JSON integer satuan terkecil (IDR rupiah, USD sen), half-up.
class MoneyTest extends TestCase
{
    public function test_to_minor_converts_decimal_strings_per_currency_with_half_up_rounding(): void
    {
        $this->assertSame(1250, Money::toMinor('12.50', 'USD'));
        $this->assertSame(1250, Money::toMinor(12.5, 'usd'));
        $this->assertSame(1251, Money::toMinor('12.505', 'USD'));
        $this->assertSame(1, Money::toMinor('0.01', 'USD'));
        $this->assertSame(125000, Money::toMinor('125000.00', 'IDR'));
        $this->assertSame(125001, Money::toMinor('125000.50', 'IDR'));
        $this->assertSame(125000, Money::toMinor('125000.49', 'IDR'));
        $this->assertSame(125000, Money::toMinor('125000,00', 'IDR')); // koma desimal dari sumber lama
        $this->assertNull(Money::toMinor(null, 'USD'));
        $this->assertNull(Money::toMinor('', 'IDR'));
    }

    public function test_from_minor_formats_decimal_strings_the_db_column_expects(): void
    {
        $this->assertSame('12.50', Money::fromMinor(1250, 'USD'));
        $this->assertSame('0.05', Money::fromMinor(5, 'USD'));
        $this->assertSame('1275.00', Money::fromMinor(127500, 'USD'));
        $this->assertSame('-12.50', Money::fromMinor(-1250, 'USD'));
        $this->assertSame('125000', Money::fromMinor(125000, 'IDR'));
        $this->assertSame('0', Money::fromMinor(0, 'IDR'));
    }

    public function test_round_trip_is_exact_for_cents(): void
    {
        foreach ([1, 99, 1250, 127500, 99999999] as $cents) {
            $this->assertSame($cents, Money::toMinor(Money::fromMinor($cents, 'USD'), 'USD'), "cents $cents");
        }
        foreach ([1, 125000, 17055217] as $rupiah) {
            $this->assertSame($rupiah, Money::toMinor(Money::fromMinor($rupiah, 'IDR'), 'IDR'), "rupiah $rupiah");
        }
    }

    public function test_to_int_keeps_legacy_rupiah_behaviour(): void
    {
        $this->assertSame(0, Money::toInt(null));
        $this->assertSame(125000, Money::toInt('125000.00'));
        $this->assertSame(125001, Money::toInt('125000.50'));
    }

    public function test_format_and_currency_helpers(): void
    {
        $this->assertSame('Rp 1.234.567', Money::format(1234567));
        $this->assertSame('Rp 1.234.567', Money::format(1234567, 'IDR'));
        $this->assertSame('USD 12.75', Money::format(1275, 'USD'));
        $this->assertSame('USD 1,275.00', Money::format(127500, 'USD'));

        $this->assertSame('IDR', Money::normalizeCurrency(null));
        $this->assertSame('IDR', Money::normalizeCurrency(''));
        $this->assertSame('USD', Money::normalizeCurrency(' usd '));
        $this->assertTrue(Money::isIdr(null));
        $this->assertTrue(Money::isUsd('usd'));
        $this->assertFalse(Money::isUsd('IDR'));

        $this->expectException(InvalidArgumentException::class);
        Money::normalizeCurrency('EUR');
    }

    public function test_allocate_sums_exactly(): void
    {
        $shares = Money::allocate(1000, [1, 1, 1]);
        $this->assertSame(1000, array_sum($shares));
        $this->assertSame([333, 334, 333], $shares);
        $this->assertSame([2500, 0, 7500], Money::allocate(10000, [25, 0, 75]));
        $this->assertSame([0, 0], Money::allocate(0, [1, 1]));
    }
}
