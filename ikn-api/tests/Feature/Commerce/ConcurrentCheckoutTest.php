<?php

namespace Tests\Feature\Commerce;

use App\Exceptions\ApiException;
use App\Models\Order;
use App\Models\StockMovement;
use App\Services\Commerce\CheckoutService;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

/**
 * Checkout bersamaan (KEPUTUSAN stok & reservasi): dua proses (pcntl_fork) memesan stok 1 → tepat satu berhasil.
 * Butuh ext-pcntl (Linux/macOS/container); di Windows dilewati dan varian deterministik ada di CheckoutTest.
 * Memakai DatabaseMigrations (bukan transaksi) agar data terlihat oleh koneksi proses anak.
 */
class ConcurrentCheckoutTest extends TestCase
{
    use DatabaseMigrations, CommerceFixtures;

    protected function setUp(): void
    {
        if (! function_exists('pcntl_fork')) {
            $this->markTestSkipped('pcntl_fork is not available (Windows); see CheckoutTest for the sequential variant.');
        }
        parent::setUp();
    }

    public function test_two_forked_checkouts_on_single_stock_yield_exactly_one_order(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct(['slug' => 'packing-pintu-rebusan'], 1);
        $payload = $this->checkoutPayload($product, 1);
        $userId = $this->buyer->id;
        $resultDir = sys_get_temp_dir().'/ikn-concurrent-'.uniqid();
        mkdir($resultDir);

        // Koneksi induk ditutup agar tiap anak membuka koneksi Postgres sendiri.
        DB::disconnect();

        $pids = [];
        for ($i = 0; $i < 2; $i++) {
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('fork failed');
            }
            if ($pid === 0) {
                DB::reconnect();
                $status = 'error';
                try {
                    app(CheckoutService::class)->place(\App\Models\User::find($userId), $payload);
                    $status = '201';
                } catch (ApiException $e) {
                    $status = $e->errorCode === 'INSUFFICIENT_STOCK' ? '409' : 'error:'.$e->errorCode;
                } catch (\Throwable $e) {
                    $status = 'error:'.$e->getMessage();
                }
                file_put_contents($resultDir.'/'.$i, $status);
                DB::disconnect();
                posix_kill(getmypid(), SIGKILL); // keluar tanpa menjalankan destructor/teardown PHPUnit induk
            }
            $pids[] = $pid;
        }

        foreach ($pids as $pid) {
            pcntl_waitpid($pid, $status);
        }
        DB::reconnect();

        $results = [file_get_contents($resultDir.'/0'), file_get_contents($resultDir.'/1')];
        sort($results);
        array_map('unlink', glob($resultDir.'/*'));
        rmdir($resultDir);

        $this->assertSame(['201', '409'], $results);
        $this->assertSame(1, Order::count());
        $product->refresh();
        $this->assertSame([1, 1, 0], [$product->stock_qty, $product->reserved_qty, $product->available]);
        $this->assertSame(1, StockMovement::where('type', StockMovement::TYPE_RESERVE)->count());
    }
}
