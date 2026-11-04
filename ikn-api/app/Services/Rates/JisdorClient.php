<?php

namespace App\Services\Rates;

use App\Exceptions\ApiException;
use Carbon\CarbonInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

// Web service kurs BI (ASMX, HTTP GET, XML DataSet .NET): getSubKursJisdor3?mts=USD&startDate&endDate.
// Server menutup koneksi tanpa User-Agent yang jelas dan menjawab 500 teks polos bila mts kosong (ASUMSI A-84).
class JisdorClient
{
    private const OPERATION = 'getSubKursJisdor3';

    /** @return array<int, array{date: string, rate: string}> hanya baris USD, date Y-m-d, rate decimal string */
    public function fetch(CarbonInterface $from, CarbonInterface $to): array
    {
        $url = rtrim((string) config('ikn.jisdor.base_url'), '/').'/'.self::OPERATION;
        $query = [
            'mts' => 'USD',
            'startDate' => $from->format('Y-m-d'),
            'endDate' => $to->format('Y-m-d'),
        ];

        try {
            $response = Http::withHeaders([
                'User-Agent' => (string) config('ikn.jisdor.user_agent'),
                'Accept' => 'text/xml',
            ])->timeout((int) config('ikn.jisdor.timeout', 15))->get($url, $query);
        } catch (ConnectionException $e) {
            throw $this->upstreamError();
        }

        if ($response->failed()) {
            throw $this->upstreamError();
        }

        return $this->parse($response->body());
    }

    /** @return array<int, array{date: string, rate: string}> */
    private function parse(string $body): array
    {
        if (trim($body) === '') {
            return [];
        }

        $previous = libxml_use_internal_errors(true);
        $xml = simplexml_load_string($body);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);

        // Root DataSet tanpa teks dievaluasi falsy oleh PHP; hanya `=== false` yang berarti XML rusak.
        if ($xml === false) {
            throw $this->upstreamError();
        }

        $rows = [];
        // Saat ini Table berada di namespace kosong (<NewDataSet xmlns="">); local-name() membuat parser tetap
        // bekerja bila BI memindahkan NewDataSet ke namespace DataSet.
        foreach ($xml->xpath("//*[local-name()='NewDataSet']/*[local-name()='Table']") ?: [] as $row) {
            if (trim((string) $row->mts_subkursasing) !== 'USD') {
                continue;
            }

            $date = substr(trim((string) $row->tgl_subkursasing), 0, 10);
            $rate = trim((string) $row->jual_subkursasing);

            if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || ! is_numeric($rate)) {
                continue;
            }

            $rows[] = ['date' => $date, 'rate' => $rate];
        }

        return $rows;
    }

    private function upstreamError(): ApiException
    {
        return new ApiException(502, 'UPSTREAM_ERROR', __('rates.upstream_error'));
    }
}
