<?php

namespace Tests\Feature\Commerce;

use App\Models\ExchangeRate;
use App\Services\Rates\JisdorClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Mockery;
use RuntimeException;
use Tests\TestCase;

// rates:fetch (ASUMSI A-84): upsert idempoten per tanggal, JISDOR menimpa manual, gagal upstream tidak melempar.
class RatesFetchCommandTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow(Carbon::parse('2026-11-04 10:30:00', 'Asia/Jakarta'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function fakeFixture(): void
    {
        Http::fake(['*' => Http::response(file_get_contents(base_path('tests/fixtures/jisdor_usd.xml')), 200, ['Content-Type' => 'text/xml; charset=utf-8'])]);
    }

    public function test_fetches_default_range_and_upserts_without_duplicates(): void
    {
        $this->fakeFixture();

        $this->artisan('rates:fetch')->expectsOutput('3 rate(s) upserted (2026-09-30..2026-11-04).')->assertExitCode(0);
        $this->artisan('rates:fetch')->assertExitCode(0);

        $this->assertSame(3, ExchangeRate::count());
        $this->assertDatabaseHas('exchange_rates', ['date' => '2026-10-30', 'currency' => 'USD', 'rate' => '18138.00', 'source' => 'jisdor']);
        $this->assertDatabaseHas('exchange_rates', ['date' => '2026-10-28', 'rate' => '18155.00']);
        $this->assertNotNull(ExchangeRate::where('date', '2026-10-30')->value('fetched_at'));
        $this->assertDatabaseMissing('exchange_rates', ['rate' => '11900.00']); // baris EUR dibuang

        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'mts=USD')
            && str_contains($request->url(), 'startDate=2026-09-30')
            && str_contains($request->url(), 'endDate=2026-11-04')
            && $request->hasHeader('User-Agent', config('ikn.jisdor.user_agent')));
    }

    public function test_options_and_dry_run(): void
    {
        $this->fakeFixture();

        $this->artisan('rates:fetch', ['--from' => '2026-10-26', '--to' => '2026-10-30', '--dry-run' => true])
            ->expectsOutput('3 rate(s) fetched (2026-10-26..2026-10-30), nothing written (dry run).')
            ->assertExitCode(0);

        $this->assertSame(0, ExchangeRate::count());
        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'startDate=2026-10-26') && str_contains($request->url(), 'endDate=2026-10-30'));
    }

    public function test_jisdor_overwrites_manual_row_for_same_date(): void
    {
        ExchangeRate::create(['date' => '2026-10-30', 'rate' => 18000, 'source' => ExchangeRate::SOURCE_MANUAL]);
        ExchangeRate::create(['date' => '2026-11-03', 'rate' => 18300, 'source' => ExchangeRate::SOURCE_MANUAL]);
        $this->fakeFixture();

        $this->artisan('rates:fetch')->assertExitCode(0);

        $row = ExchangeRate::where('date', '2026-10-30')->first();
        $this->assertSame('18138.00', $row->rate);
        $this->assertSame('jisdor', $row->source);
        $this->assertNotNull($row->fetched_at);
        // Tanggal yang tidak ada di jawaban BI tetap manual.
        $this->assertDatabaseHas('exchange_rates', ['date' => '2026-11-03', 'rate' => '18300.00', 'source' => 'manual']);
        $this->assertSame(4, ExchangeRate::count());
    }

    public function test_upstream_failure_logs_warning_returns_1_and_changes_nothing(): void
    {
        ExchangeRate::create(['date' => '2026-10-30', 'rate' => 18000, 'source' => ExchangeRate::SOURCE_MANUAL]);
        Http::fake(['*' => Http::response('Missing parameter: mts.', 500)]);
        Log::spy();

        $this->artisan('rates:fetch')->assertExitCode(1);

        Log::shouldHaveReceived('warning')->once()->with('rates:fetch failed', Mockery::on(fn ($ctx) => $ctx['code'] === 'UPSTREAM_ERROR' && $ctx['from'] === '2026-09-30' && $ctx['to'] === '2026-11-04'));
        $this->assertSame(1, ExchangeRate::count());
        $this->assertDatabaseHas('exchange_rates', ['date' => '2026-10-30', 'rate' => '18000.00', 'source' => 'manual']);
    }

    // Galat selain ApiException (parser, DB, bug) juga hanya dicatat: scheduler tidak boleh menerima exception.
    public function test_unexpected_exception_logs_warning_and_returns_1(): void
    {
        $this->mock(JisdorClient::class, fn ($mock) => $mock->shouldReceive('fetch')->once()->andThrow(new RuntimeException('boom')));
        Log::spy();

        $this->artisan('rates:fetch')->assertExitCode(1);

        Log::shouldHaveReceived('warning')->once()->with('rates:fetch failed', Mockery::on(fn ($ctx) => $ctx['code'] === RuntimeException::class && $ctx['message'] === 'boom' && $ctx['to'] === '2026-11-04'));
        $this->assertSame(0, ExchangeRate::count());
    }

    public function test_no_rows_for_a_range_with_working_days_logs_warning_but_weekend_range_does_not(): void
    {
        Http::fake(['*' => Http::response('<?xml version="1.0" encoding="utf-8"?><DataSet xmlns="http://tempuri.org/"><diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1" /></DataSet>', 200)]);
        Log::spy();

        // 2026-09-30..2026-11-04 memuat hari kerja: 0 baris = peringatan, tetap exit 0 dan tidak menulis.
        $this->artisan('rates:fetch')->expectsOutput('0 rate(s) upserted (2026-09-30..2026-11-04).')->assertExitCode(0);
        Log::shouldHaveReceived('warning')->once()->with('rates:fetch returned no rows', ['from' => '2026-09-30', 'to' => '2026-11-04']);

        // Sabtu-Minggu saja: BI memang kosong, tidak ada peringatan tambahan.
        $this->artisan('rates:fetch', ['--from' => '2026-10-31', '--to' => '2026-11-01'])->expectsOutput('0 rate(s) upserted (2026-10-31..2026-11-01).')->assertExitCode(0);
        Log::shouldHaveReceived('warning')->once();
        $this->assertSame(0, ExchangeRate::count());
    }
}
