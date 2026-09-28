<?php

namespace App\Console\Commands;

use App\Services\Stock\StockLedger;
use Illuminate\Console\Command;

// Hitung ulang cache products.stock_qty/reserved_qty dari ledger stock_movements (arsitektur bagian 8).
class StockRebuild extends Command
{
    protected $signature = 'stock:rebuild {--product= : Hanya produk dengan id ini}';

    protected $description = 'Rebuild products.stock_qty/reserved_qty/stock_status cache from the stock_movements ledger';

    public function handle(StockLedger $ledger): int
    {
        $productId = $this->option('product') ? (int) $this->option('product') : null;
        $count = $ledger->rebuild($productId);

        $this->info("Rebuilt stock cache for {$count} product(s).");

        return self::SUCCESS;
    }
}
