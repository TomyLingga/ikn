<?php

namespace Tests\Unit;

use App\Exceptions\ApiException;
use App\Services\Rates\JisdorClient;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Psr7\Request as GuzzleRequest;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

// Parser XML DataSet web service BI getSubKursJisdor3 (ASUMSI A-84). Fixture: tests/fixtures/jisdor_usd.xml.
class JisdorClientTest extends TestCase
{
    private function fixture(): string
    {
        return file_get_contents(base_path('tests/fixtures/jisdor_usd.xml'));
    }

    private function fetch(): array
    {
        return app(JisdorClient::class)->fetch(Carbon::parse('2026-10-26'), Carbon::parse('2026-10-30'));
    }

    public function test_parses_dataset_rows_trims_currency_and_skips_non_usd(): void
    {
        Http::fake(['*' => Http::response($this->fixture(), 200, ['Content-Type' => 'text/xml; charset=utf-8'])]);

        $rows = $this->fetch();

        // Fixture: 3 baris USD (mts "USD  " dengan spasi) + 1 baris EUR yang harus dibuang; rate = jual_subkursasing.
        $this->assertSame([
            ['date' => '2026-10-30', 'rate' => '18138.00'],
            ['date' => '2026-10-29', 'rate' => '18120.00'],
            ['date' => '2026-10-28', 'rate' => '18155.00'],
        ], $rows);

        Http::assertSent(function (Request $request) {
            return $request->hasHeader('User-Agent', config('ikn.jisdor.user_agent'))
                && $request->hasHeader('Accept', 'text/xml')
                && str_starts_with($request->url(), config('ikn.jisdor.base_url').'/getSubKursJisdor3?')
                && str_contains($request->url(), 'mts=USD')
                && str_contains($request->url(), 'startDate=2026-10-26')
                && str_contains($request->url(), 'endDate=2026-10-30');
        });
    }

    // xpath memakai local-name(): bila BI memindahkan NewDataSet/Table ke namespace DataSet, baris tetap terbaca.
    public function test_parses_rows_when_dataset_elements_carry_a_namespace(): void
    {
        $namespaced = str_replace('<NewDataSet xmlns="">', '<NewDataSet xmlns="http://tempuri.org/">', $this->fixture());
        $this->assertStringContainsString('<NewDataSet xmlns="http://tempuri.org/">', $namespaced);
        Http::fake(['*' => Http::response($namespaced, 200, ['Content-Type' => 'text/xml; charset=utf-8'])]);

        $this->assertSame([
            ['date' => '2026-10-30', 'rate' => '18138.00'],
            ['date' => '2026-10-29', 'rate' => '18120.00'],
            ['date' => '2026-10-28', 'rate' => '18155.00'],
        ], $this->fetch());
    }

    public function test_empty_body_or_empty_diffgram_gives_no_rows(): void
    {
        Http::fake(['*' => Http::response('', 200)]);
        $this->assertSame([], $this->fetch());

        // Akhir pekan: BI menjawab 200 dengan diffgram kosong.
        Http::fake(['*' => Http::response('<?xml version="1.0" encoding="utf-8"?><DataSet xmlns="http://tempuri.org/"><diffgr:diffgram xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1" /></DataSet>', 200)]);
        $this->assertSame([], $this->fetch());
    }

    public function test_http_500_plain_text_is_an_upstream_error(): void
    {
        Http::fake(['*' => Http::response('Missing parameter: mts.', 500)]);

        try {
            $this->fetch();
            $this->fail('ApiException expected');
        } catch (ApiException $e) {
            $this->assertSame(502, $e->status);
            $this->assertSame('UPSTREAM_ERROR', $e->errorCode);
        }
    }

    public function test_connection_failure_is_an_upstream_error(): void
    {
        Http::fake(fn () => throw new ConnectException('Connection reset by peer', new GuzzleRequest('GET', 'https://www.bi.go.id')));

        try {
            $this->fetch();
            $this->fail('ApiException expected');
        } catch (ApiException $e) {
            $this->assertSame(502, $e->status);
            $this->assertSame('UPSTREAM_ERROR', $e->errorCode);
        }
    }

    public function test_malformed_xml_is_an_upstream_error(): void
    {
        Http::fake(['*' => Http::response('<html><body>Maintenance</body>', 200)]);

        $this->expectException(ApiException::class);
        $this->fetch();
    }
}
