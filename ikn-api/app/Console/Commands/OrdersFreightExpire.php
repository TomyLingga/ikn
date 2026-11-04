<?php

namespace App\Console\Commands;

use App\Services\Commerce\FreightQuoteService;
use Illuminate\Console\Command;

// Tiap 15 menit (ASUMSI A-89): penawaran ongkir CIF proposed yang lewat valid_until → expired (customer in-app, email admin),
// lalu order awaiting_freight lebih lama dari setting freight_quote_max_days tanpa penawaran yang masih berlaku → cancelled
// (actor system, stok dilepas, penawaran terbuka ditolak). Keduanya idempoten.
class OrdersFreightExpire extends Command
{
    protected $signature = 'orders:freight-expire';

    protected $description = 'Expire CIF freight quotes past their validity and cancel awaiting_freight orders past the maximum waiting period';

    public function handle(FreightQuoteService $quotes): int
    {
        $now = now();
        $expired = $quotes->expireQuotes($now);
        $cancelled = $quotes->cancelStale($now);

        $this->info(sprintf('%d quote(s) expired, %d order(s) cancelled.', $expired, $cancelled));

        return self::SUCCESS;
    }
}
