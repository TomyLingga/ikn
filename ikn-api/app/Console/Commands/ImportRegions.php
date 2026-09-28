<?php

namespace App\Console\Commands;

use App\Models\Region;
use Illuminate\Console\Command;
use RuntimeException;

// Impor wilayah Kemendagri dari CSV (kolom code,name) ke tabel regions; idempoten (upsert per chunk).
// Level = jumlah segmen kode (1 provinsi ... 4 desa/kelurahan), parent_code = kode tanpa segmen terakhir.
class ImportRegions extends Command
{
    protected $signature = 'regions:import
        {--file= : Path CSV (.csv atau .csv.gz); default database/data/wilayah.csv.gz}
        {--chunk=2000 : Jumlah baris per upsert}';

    protected $description = 'Import Kemendagri region codes (code,name CSV) into the regions table (idempotent upsert)';

    public function handle(): int
    {
        $file = (string) ($this->option('file') ?: database_path('data/wilayah.csv.gz'));
        $chunkSize = max(1, (int) $this->option('chunk'));

        if (! is_file($file)) {
            $this->error("File not found: {$file}");

            return self::FAILURE;
        }

        $total = $this->countRows($file);
        $this->info("Importing regions from {$file} ({$total} rows)...");

        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $handle = $this->open($file);
        $header = fgetcsv($handle);
        $columns = $this->columnIndexes($header);

        $imported = 0;
        $skipped = 0;
        $chunk = [];

        while (($row = fgetcsv($handle)) !== false) {
            if ($row === [null] || $row === []) {
                continue; // baris kosong
            }

            $code = trim((string) ($row[$columns['code']] ?? ''));
            $name = trim((string) ($row[$columns['name']] ?? ''));
            $level = $code !== '' ? Region::levelForCode($code) : null;

            if ($level === null || $name === '') {
                $skipped++;
                $bar->advance();

                continue;
            }

            $chunk[] = [
                'code' => $code,
                'parent_code' => Region::parentCodeFor($code),
                'level' => $level,
                'name' => mb_substr($name, 0, 120),
            ];

            if (count($chunk) >= $chunkSize) {
                $imported += $this->flush($chunk);
                $bar->advance(count($chunk));
                $chunk = [];
            }
        }

        fclose($handle);

        if ($chunk !== []) {
            $imported += $this->flush($chunk);
            $bar->advance(count($chunk));
        }

        $bar->finish();
        $this->newLine();
        $this->info("Done: {$imported} rows upserted, {$skipped} skipped. Total regions: ".Region::count());

        return self::SUCCESS;
    }

    /** @param  array<int, array<string, string|null>>  $rows */
    private function flush(array $rows): int
    {
        // Baris duplikat dalam satu chunk membuat Postgres menolak ON CONFLICT; ambil yang terakhir.
        $unique = [];
        foreach ($rows as $row) {
            $unique[$row['code']] = $row;
        }

        Region::query()->upsert(array_values($unique), ['code'], ['parent_code', 'level', 'name']);

        return count($unique);
    }

    /** @return resource */
    private function open(string $file)
    {
        $path = str_ends_with(strtolower($file), '.gz') ? 'compress.zlib://'.$file : $file;
        $handle = @fopen($path, 'r');

        if ($handle === false) {
            throw new RuntimeException("Cannot open {$file}");
        }

        return $handle;
    }

    private function countRows(string $file): int
    {
        $handle = $this->open($file);
        $count = 0;

        while (fgets($handle) !== false) {
            $count++;
        }

        fclose($handle);

        return max(0, $count - 1); // tanpa header
    }

    /** @return array{code:int,name:int} */
    private function columnIndexes(?array $header): array
    {
        $header = array_map(fn ($h) => strtolower(trim((string) $h)), $header ?: []);
        $code = array_search('code', $header, true);
        $name = array_search('name', $header, true);

        if ($code === false || $name === false) {
            throw new RuntimeException('CSV header must contain "code" and "name" columns.');
        }

        return ['code' => $code, 'name' => $name];
    }
}
