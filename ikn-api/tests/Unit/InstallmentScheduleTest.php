<?php

namespace Tests\Unit;

use App\Services\Commerce\InstallmentSchedule;
use Tests\TestCase;

// Jadwal termin (ASUMSI A-97): normalisasi, aturan, dan pembagian nominal yang jumlahnya selalu sama dengan total.
class InstallmentScheduleTest extends TestCase
{
    private function rows(array $percents): array
    {
        return array_map(fn ($percent, $i) => [
            'key' => 'row_'.$i, 'label' => ['id' => 'Termin '.$i], 'percent' => $percent,
            'trigger' => $i === 0 ? 'order' : 'shipped', 'dueDays' => 7,
        ], $percents, array_keys($percents));
    }

    public function test_amounts_always_sum_to_the_total_and_the_last_row_takes_the_remainder(): void
    {
        // 30% dari 33.033 sen = 9.909,9 → 9.910; sisanya 23.123.
        $this->assertSame([9910, 23123], InstallmentSchedule::amounts(33033, $this->rows([30, 70])));
        // Tiga termin 33,33 / 33,33 / 33,34 dari 1.001: 333,63 → 334; 334; sisa 333.
        $this->assertSame([334, 334, 333], InstallmentSchedule::amounts(1001, $this->rows([33.33, 33.33, 33.34])));
        $this->assertSame([50, 50], InstallmentSchedule::amounts(100, $this->rows([50, 50])));
        $this->assertSame([], InstallmentSchedule::amounts(100, []));

        foreach ([1, 7, 99, 100, 12345, 577501, 99999999] as $total) {
            foreach ([[30, 70], [10, 20, 70], [33.33, 33.33, 33.34], [12.5, 12.5, 25, 25, 12.5, 12.5]] as $percents) {
                $amounts = InstallmentSchedule::amounts($total, $this->rows($percents));
                $this->assertSame($total, array_sum($amounts), json_encode([$total, $percents]));
                $this->assertGreaterThanOrEqual(0, min($amounts));
            }
        }
    }

    public function test_normalize_fills_keys_forces_first_row_days_and_treats_one_row_as_full_payment(): void
    {
        $rows = InstallmentSchedule::normalize([
            ['label' => ['id' => 'Uang muka 30%'], 'percent' => '30', 'trigger' => 'order', 'dueDays' => 9],
            ['key' => 'Balance-70', 'label' => ['id' => 'Pelunasan', 'en' => 'Balance'], 'percent' => 70.0, 'trigger' => 'shipped', 'dueDays' => 14],
        ]);

        $this->assertSame('uang_muka_30', $rows[0]['key']);
        $this->assertSame(['id' => 'Uang muka 30%', 'en' => 'Uang muka 30%'], $rows[0]['label']);
        $this->assertSame(30, $rows[0]['percent']);
        $this->assertSame(0, $rows[0]['dueDays']); // termin pertama memakai batas bayar order
        $this->assertSame('balance_70', $rows[1]['key']);
        $this->assertSame(14, $rows[1]['dueDays']);
        $this->assertSame([], InstallmentSchedule::violations($rows));

        $this->assertNull(InstallmentSchedule::normalize(null));
        $this->assertNull(InstallmentSchedule::normalize([]));
        $this->assertNull(InstallmentSchedule::normalize([['label' => ['id' => 'Lunas'], 'percent' => 100, 'trigger' => 'order']]));
    }

    public function test_violations_report_sum_first_trigger_duplicate_keys_and_row_limit(): void
    {
        $this->assertContains('percent_sum', InstallmentSchedule::violations($this->rows([30, 60])));
        $this->assertContains('percent_sum', InstallmentSchedule::violations($this->rows([33.33, 33.33, 33.33])));
        $this->assertContains('percent_range', InstallmentSchedule::violations($this->rows([0, 100])));

        $wrongFirst = $this->rows([30, 70]);
        $wrongFirst[0]['trigger'] = 'shipped';
        $this->assertContains('first_trigger', InstallmentSchedule::violations($wrongFirst));

        $duplicate = $this->rows([30, 70]);
        $duplicate[1]['key'] = $duplicate[0]['key'];
        $this->assertContains('duplicate_key', InstallmentSchedule::violations($duplicate));

        $this->assertContains('too_many', InstallmentSchedule::violations($this->rows([10, 10, 10, 10, 10, 10, 40])));
        $this->assertSame([], InstallmentSchedule::violations($this->rows([10, 10, 10, 10, 10, 50])));
        $this->assertSame([], InstallmentSchedule::violations(null));
    }
}
