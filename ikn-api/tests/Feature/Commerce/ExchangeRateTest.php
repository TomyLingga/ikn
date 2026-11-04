<?php

namespace Tests\Feature\Commerce;

use App\Models\ExchangeRate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

// GET/POST /admin/exchange-rates (kontrak 11.7, ASUMSI A-84): ringkasan 30 hari, kurs manual, modul reports.
class ExchangeRateTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Rabu 4 November 2026 WIB: tiga hari kerja setelah kurs terakhir (Jumat 30 Oktober).
        Carbon::setTestNow(Carbon::parse('2026-11-04 12:00:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function seedRates(): void
    {
        $fetched = Carbon::parse('2026-10-30 10:05:00', 'Asia/Jakarta');
        foreach ([['2026-10-28', 18155], ['2026-10-29', 18120], ['2026-10-30', 18138]] as [$date, $rate]) {
            ExchangeRate::create(['date' => $date, 'rate' => $rate, 'source' => ExchangeRate::SOURCE_JISDOR, 'fetched_at' => $fetched]);
        }
        // Di luar rentang 30 hari (tidak masuk rata-rata) dan tanggal setelah "hari ini" (bukan latest).
        ExchangeRate::create(['date' => '2026-09-01', 'rate' => 17000, 'source' => ExchangeRate::SOURCE_JISDOR, 'fetched_at' => $fetched]);
        ExchangeRate::create(['date' => '2026-11-10', 'rate' => 19000, 'source' => ExchangeRate::SOURCE_MANUAL]);
    }

    public function test_summary_aggregates_last_30_days_and_orders_series_ascending(): void
    {
        $this->seedRates();
        $admin = $this->adminWith(['reports']);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/exchange-rates')->assertOk();

        // 54413 / 3 = 18137,67 → 18138.
        $response->assertJsonPath('data.latest.date', '2026-10-30')
            ->assertJsonPath('data.latest.rate', 18138)
            ->assertJsonPath('data.latest.source', 'jisdor')
            ->assertJsonPath('data.latest.fetchedAt', '2026-10-30T10:05:00+07:00')
            ->assertJsonPath('data.average', 18138)
            ->assertJsonPath('data.max', 18155)
            ->assertJsonPath('data.min', 18120)
            ->assertJsonPath('data.fetchedAt', '2026-10-30T10:05:00+07:00')
            ->assertJsonPath('data.staleDays', 3)
            ->assertJsonPath('data.stale', false)
            ->assertJsonCount(3, 'data.series')
            ->assertJsonPath('data.series.0', ['date' => '2026-10-28', 'rate' => 18155, 'source' => 'jisdor'])
            ->assertJsonPath('data.series.2.date', '2026-10-30');

        $this->assertIsInt($response->json('data.latest.rate'));

        // Rentang eksplisit satu hari.
        $this->actingAs($admin)->getJson('/api/v1/admin/exchange-rates?from=2026-10-29&to=2026-10-29')
            ->assertOk()
            ->assertJsonCount(1, 'data.series')
            ->assertJsonPath('data.average', 18120)
            ->assertJsonPath('data.max', 18120)
            ->assertJsonPath('data.min', 18120)
            ->assertJsonPath('data.latest.date', '2026-10-30');

        // Senin berikutnya: 4 hari kerja tanpa kurs baru → basi.
        Carbon::setTestNow(Carbon::parse('2026-11-05 09:00:00', 'Asia/Jakarta'));
        $this->actingAs($admin)->getJson('/api/v1/admin/exchange-rates')
            ->assertOk()
            ->assertJsonPath('data.staleDays', 4)
            ->assertJsonPath('data.stale', true);

        $this->actingAs($admin)->getJson('/api/v1/admin/exchange-rates?from=2026-10-30&to=2026-10-01')
            ->assertStatus(422)->assertJsonValidationErrors(['to']);
    }

    public function test_empty_table_gives_nulls_and_not_stale(): void
    {
        $this->actingAs($this->superAdmin())->getJson('/api/v1/admin/exchange-rates')
            ->assertOk()
            ->assertJsonPath('data.latest', null)
            ->assertJsonPath('data.average', null)
            ->assertJsonPath('data.max', null)
            ->assertJsonPath('data.min', null)
            ->assertJsonPath('data.series', [])
            ->assertJsonPath('data.fetchedAt', null)
            ->assertJsonPath('data.staleDays', 0)
            ->assertJsonPath('data.stale', false);
    }

    public function test_requires_reports_module(): void
    {
        // Sebelum actingAs (sesi menempel pada instance test ini).
        $this->getJson('/api/v1/admin/exchange-rates')->assertStatus(401);

        $this->actingAs($this->adminWith(['orders']))->getJson('/api/v1/admin/exchange-rates')->assertStatus(403);
        $this->actingAs($this->adminWith(['orders']))->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-03', 'rate' => 18200])->assertStatus(403);
        $this->actingAs($this->customer())->getJson('/api/v1/admin/exchange-rates')->assertStatus(403);
    }

    public function test_manual_rate_is_created_overwritten_and_audited(): void
    {
        $admin = $this->adminWith(['reports']);

        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-03', 'rate' => 18200])
            ->assertCreated()
            ->assertJsonPath('data.date', '2026-11-03')
            ->assertJsonPath('data.rate', 18200)
            ->assertJsonPath('data.source', 'manual')
            ->assertJsonPath('data.fetchedAt', null);

        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-03', 'rate' => 18250])
            ->assertCreated()
            ->assertJsonPath('data.rate', 18250)
            ->assertJsonPath('data.source', 'manual');

        $this->assertSame(1, ExchangeRate::count());
        $this->assertDatabaseHas('exchange_rates', ['date' => '2026-11-03', 'currency' => 'USD', 'rate' => '18250.00', 'source' => 'manual', 'fetched_at' => null]);
        $this->assertSame(2, \App\Models\AuditLog::where('user_id', $admin->id)->where('action', 'POST api/v1/admin/exchange-rates')->count());

        // Kurs manual langsung menjadi latest.
        $this->actingAs($admin)->getJson('/api/v1/admin/exchange-rates')
            ->assertOk()
            ->assertJsonPath('data.latest.date', '2026-11-03')
            ->assertJsonPath('data.latest.source', 'manual')
            ->assertJsonPath('data.staleDays', 1);
    }

    public function test_manual_rate_validation(): void
    {
        $admin = $this->adminWith(['reports']);

        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-05', 'rate' => 18200])
            ->assertStatus(422)->assertJsonValidationErrors(['date']);
        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-04', 'rate' => 500])
            ->assertStatus(422)->assertJsonValidationErrors(['rate']);
        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-04', 'rate' => 18138.5])
            ->assertStatus(422)->assertJsonValidationErrors(['rate']);
        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', [])
            ->assertStatus(422)->assertJsonValidationErrors(['date', 'rate']);

        // Hari ini sendiri boleh.
        $this->actingAs($admin)->postJson('/api/v1/admin/exchange-rates', ['date' => '2026-11-04', 'rate' => 18200])->assertCreated();
    }
}
