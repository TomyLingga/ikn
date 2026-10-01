<?php

namespace Tests\Feature\Commerce;

use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// GET /admin/dashboard, /admin/reports/sales (+CSV), /admin/audit-logs (kontrak 11.1, ASUMSI A-24).
class AdminDashboardReportTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** @return array{paid: Order, completed: Order, expired: Order, cancelled: Order, pending: Order} */
    private function seedScenario(): array
    {
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'price' => 100000], 1000);
        $sm = app(OrderStateMachine::class);
        $admin = $this->superAdmin();
        // "Hari ini" dibekukan di pertengahan bulan berjalan agar skenario tidak bergantung pada tanggal
        // menjalankan test (tanggal 1-2 membuat order "bulan ini" jatuh di masa depan).
        $real = now()->startOfMonth()->addDays(14)->setTime(12, 0);

        // Bulan lalu: order completed (paid_at bulan lalu).
        Carbon::setTestNow($real->copy()->startOfMonth()->subDays(10)->setTime(10, 0));
        $completed = $this->payOrder($this->placeOrder($product, 10), $admin);
        $sm->transition($completed, Order::STATUS_PROCESSING, $admin);
        $sm->transition($completed, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE', 'trackingNumber' => 'A']);
        $sm->transition($completed, Order::STATUS_DELIVERED, $admin);
        $sm->transition($completed, Order::STATUS_COMPLETED, $admin);

        // Bulan ini: paid, expired, cancelled (paid lalu batal), pending.
        Carbon::setTestNow($real->copy()->startOfMonth()->addDays(2)->setTime(9, 0));
        $paid = $this->payOrder($this->placeOrder($product, 5), $admin);
        $expired = $this->placeOrder($product, 1);
        $sm->transition($expired, Order::STATUS_EXPIRED, null);
        $cancelled = $this->payOrder($this->placeOrder($product, 2), $admin);
        $sm->transition($cancelled, Order::STATUS_CANCELLED, $admin, ['reason' => 'refund']);
        Carbon::setTestNow($real);
        $pending = $this->placeOrder($product, 1);
        $this->uploadProof($pending);

        return compact('paid', 'completed', 'expired', 'cancelled', 'pending');
    }

    public function test_dashboard_stats_recent_orders_and_sales_chart(): void
    {
        $this->setUpCommerce();
        $this->customer(['status' => User::STATUS_PENDING, 'email' => 'pending@x.id']);
        $orders = $this->seedScenario();
        $admin = $this->adminWith(['dashboard']);
        $year = (int) now()->year;

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard?year='.$year)->assertOk();
        $response->assertJsonPath('data.stats.ordersToday', 1)
            ->assertJsonPath('data.stats.awaitingVerification', 1)
            ->assertJsonPath('data.stats.pendingVerification', 1)
            ->assertJsonPath('data.stats.revenueThisMonth', $orders['paid']->grandTotalInt()) // cancelled/expired tidak dihitung
            ->assertJsonPath('data.stats.pendingCustomers', 1)
            ->assertJsonPath('data.stats.activeCustomers', 1)
            ->assertJsonPath('data.stats.ordersThisMonth', 4)
            ->assertJsonCount(5, 'data.recentOrders')
            ->assertJsonPath('data.recentOrders.0.number', $orders['pending']->number)
            ->assertJsonPath('data.needsAction.0.number', $orders['pending']->number)
            ->assertJsonPath('data.needsAction.1.number', $orders['paid']->number)
            ->assertJsonCount(12, 'data.salesChart')
            ->assertJsonPath('data.salesChart.0.monthIndex', 1)
            ->assertJsonPath('data.salesChart.0.month', 'Jan')
            ->assertJsonPath('data.year', $year);

        $thisMonth = (int) now()->month;
        $chart = collect($response->json('data.salesChart'));
        $this->assertSame($orders['paid']->grandTotalInt(), $chart->firstWhere('monthIndex', $thisMonth)['total']);
        $this->assertSame(1, $chart->firstWhere('monthIndex', $thisMonth)['orders']);
        $lastMonth = now()->startOfMonth()->subDays(10);
        if ((int) $lastMonth->year === $year) {
            $this->assertSame($orders['completed']->grandTotalInt(), $chart->firstWhere('monthIndex', (int) $lastMonth->month)['total']);
        }

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['orders']))->getJson('/api/v1/admin/dashboard')->assertStatus(403);
    }

    public function test_dashboard_kpis_work_queue_top_products_low_stock_and_payment_due(): void
    {
        $this->setUpCommerce();
        $orders = $this->seedScenario(); // "now" frozen at the 15th 12:00 of the current month
        $now = now();
        $product = Product::where('slug', 'resiprene-35')->firstOrFail();
        $admin = $this->superAdmin();

        // Previous period (same elapsed span last month): one paid order on day 4.
        Carbon::setTestNow($now->copy()->startOfMonth()->subMonthNoOverflow()->addDays(3)->setTime(10, 0));
        $previous = $this->payOrder($this->placeOrder($product, 3), $admin);

        // Unpaid orders: one past its due time (expiry job not run yet), one due within 24 hours.
        Carbon::setTestNow($now->copy()->subDays(2));
        $overdue = $this->placeOrder($product, 1);
        Carbon::setTestNow($now->copy()->subHours(1));
        $dueSoon = $this->placeOrder($product, 1);
        Carbon::setTestNow($now);

        // Customers: buyer registered last month, two registered this month.
        $this->buyer->forceFill(['created_at' => $now->copy()->startOfMonth()->subMonthNoOverflow()->addDay()])->save();
        $this->customer(['email' => 'new1@x.id', 'created_at' => $now->copy()->subDays(3)]);
        $this->customer(['email' => 'new2@x.id', 'created_at' => $now->copy()->subDays(1)]);

        // Low stock: below max(moq x 10, 50); made-to-order and quote products never count.
        $low = $this->makeProduct(['slug' => 'low-moq', 'moq' => 10], 40);
        $this->makeProduct(['slug' => 'low-min'], 20);
        $this->makeProduct(['slug' => 'made-to-order', 'stock_status' => Product::STOCK_MADE_TO_ORDER]);
        $this->makeProduct(['slug' => 'quote-only', 'price_mode' => Product::PRICE_MODE_QUOTE, 'price' => null]);

        $response = $this->actingAs($admin)->getJson('/api/v1/admin/dashboard')->assertOk();
        $paid = $orders['paid']->grandTotalInt();
        $prev = $previous->grandTotalInt();

        $response->assertJsonPath('data.kpis.revenue.current', $paid)
            ->assertJsonPath('data.kpis.revenue.previous', $prev)
            ->assertJsonPath('data.kpis.revenue.changePct', round(($paid - $prev) / $prev * 100, 1))
            ->assertJsonPath('data.kpis.paidOrders.current', 1)
            ->assertJsonPath('data.kpis.paidOrders.previous', 1)
            ->assertJsonPath('data.kpis.avgOrderValue.current', $paid)
            ->assertJsonPath('data.kpis.newCustomers.current', 2)
            ->assertJsonPath('data.kpis.newCustomers.previous', 1)
            ->assertJsonPath('data.period.from', $now->copy()->startOfMonth()->toApiString())
            ->assertJsonPath('data.workQueue.paymentsToVerify', 1)
            ->assertJsonPath('data.workQueue.ordersToProcess', 2) // this month's paid + last month's paid
            ->assertJsonPath('data.workQueue.ordersToShip', 0)
            ->assertJsonPath('data.workQueue.ordersInTransit', 0)
            ->assertJsonPath('data.workQueue.paymentsOverdue', 1)
            ->assertJsonPath('data.workQueue.customersToApprove', 0)
            ->assertJsonPath('data.workQueue.unreadChats', 0)
            ->assertJsonCount(1, 'data.topProducts')
            ->assertJsonPath('data.topProducts.0.productSlug', 'resiprene-35')
            ->assertJsonPath('data.topProducts.0.qty', 5)
            ->assertJsonPath('data.topProducts.0.orders', 1)
            ->assertJsonPath('data.topProducts.0.revenue', 500000)
            ->assertJsonPath('data.lowStock.total', 2)
            ->assertJsonPath('data.lowStock.items.0.slug', 'low-min')
            ->assertJsonPath('data.lowStock.items.0.available', 20)
            ->assertJsonPath('data.lowStock.items.0.threshold', 50)
            ->assertJsonPath('data.lowStock.items.1.id', $low->id)
            ->assertJsonPath('data.lowStock.items.1.threshold', 100)
            ->assertJsonPath('data.paymentDue.overdue', 1)
            ->assertJsonPath('data.paymentDue.dueSoon', 1)
            ->assertJsonPath('data.paymentDue.items.0.number', $overdue->number)
            ->assertJsonPath('data.paymentDue.items.1.number', $dueSoon->number);

        // Stock is never written by the dashboard.
        $this->assertSame(40, $low->fresh()->stock_qty);

        // Work queue respects module access (null = module not granted), like /admin/badges.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['dashboard', 'payments']))->getJson('/api/v1/admin/dashboard')->assertOk()
            ->assertJsonPath('data.workQueue.paymentsToVerify', 1)
            ->assertJsonPath('data.workQueue.ordersToProcess', null)
            ->assertJsonPath('data.workQueue.paymentsOverdue', null)
            ->assertJsonPath('data.workQueue.customersToApprove', null)
            ->assertJsonPath('data.workQueue.unreadChats', null);
    }

    public function test_sales_report_json_and_csv_exclude_cancelled_and_expired(): void
    {
        $this->setUpCommerce();
        $orders = $this->seedScenario();
        $admin = $this->adminWith(['reports']);
        $year = (int) now()->year;
        $month = (int) now()->month;

        $response = $this->actingAs($admin)->getJson("/api/v1/admin/reports/sales?year={$year}&month={$month}")->assertOk();
        $response->assertJsonPath('data.summary.orders', 1)
            ->assertJsonPath('data.summary.revenue', $orders['paid']->grandTotalInt())
            ->assertJsonPath('data.summary.avgOrder', $orders['paid']->grandTotalInt())
            ->assertJsonPath('data.summary.items', 5)
            ->assertJsonPath('data.summary.paidCount', 1)
            ->assertJsonPath('data.period.year', $year)
            ->assertJsonPath('data.period.month', $month)
            ->assertJsonCount(1, 'data.byMonth')
            ->assertJsonPath('data.byMonth.0.monthIndex', $month)
            ->assertJsonPath('data.byMonth.0.orders', 1)
            ->assertJsonCount(1, 'data.byProduct')
            ->assertJsonPath('data.byProduct.0.productSlug', 'resiprene-35')
            ->assertJsonPath('data.byProduct.0.qty', 5)
            ->assertJsonPath('data.byProduct.0.revenue', 500000)
            ->assertJsonCount(1, 'data.orders')
            ->assertJsonPath('data.orders.0.number', $orders['paid']->number);

        // Rentang from/to mencakup bulan lalu → 2 order paid (completed + paid).
        $from = now()->startOfMonth()->subDays(15)->toDateString();
        $to = now()->toDateString();
        $this->actingAs($admin)->getJson("/api/v1/admin/reports/sales?from={$from}&to={$to}")->assertOk()
            ->assertJsonPath('data.summary.orders', 2)
            ->assertJsonPath('data.summary.items', 15)
            ->assertJsonPath('data.summary.revenue', $orders['paid']->grandTotalInt() + $orders['completed']->grandTotalInt())
            ->assertJsonPath('data.byProduct.0.qty', 15);

        $this->actingAs($admin)->getJson('/api/v1/admin/reports/sales?month=13')->assertStatus(422);

        $csv = $this->actingAs($admin)->get("/api/v1/admin/reports/sales?from={$from}&to={$to}&format=csv");
        $csv->assertOk();
        $this->assertStringStartsWith('text/csv', $csv->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename="sales-report-', $csv->headers->get('Content-Disposition'));
        $lines = array_values(array_filter(explode("\n", trim(str_replace("\xEF\xBB\xBF", '', $csv->getContent())))));
        $this->assertCount(3, $lines); // header + 2 order
        $this->assertStringStartsWith('number,invoiceNumber,paidAt,status,customer', $lines[0]);
        $this->assertStringContainsString($orders['completed']->number, $lines[1]);
        $this->assertStringContainsString($orders['paid']->number, $lines[2]);
        $this->assertStringNotContainsString($orders['expired']->number, $csv->getContent());
        $this->assertStringNotContainsString($orders['cancelled']->number, $csv->getContent());

        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['orders']))->getJson('/api/v1/admin/reports/sales')->assertStatus(403);
    }

    public function test_audit_logs_are_listed_for_super_admin_with_filters(): void
    {
        $this->setUpCommerce();
        $product = $this->makeProduct([], 10);
        $order = $this->placeOrder($product, 1);
        $admin = $this->adminWith(['orders'], ['name' => 'Admin Penjualan', 'email' => 'sales@ptikn.com']);
        $this->actingAs($admin)->putJson('/api/v1/admin/orders/'.$order->number.'/due', ['extendHours' => 1])->assertOk();
        $this->actingAs($admin)->postJson('/api/v1/admin/orders/'.$order->number.'/cancel', ['reason' => 'x'])->assertOk();

        $this->actingAs($admin)->getJson('/api/v1/admin/audit-logs')->assertStatus(403);

        $this->app['auth']->forgetGuards();
        $super = $this->superAdmin();
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('data.0.action', 'POST api/v1/admin/orders/{order}/cancel')
            ->assertJsonPath('data.0.user.name', 'Admin Penjualan')
            ->assertJsonPath('data.0.subjectType', 'Order')
            ->assertJsonPath('data.0.subjectId', $order->id)
            ->assertJsonPath('data.0.after.reason', 'x')
            ->assertJsonStructure(['data' => [['id', 'action', 'user', 'before', 'after', 'ip', 'createdAt']]]);
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs?action=due')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs?user='.$admin->id)->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs?user=penjualan')->assertOk()->assertJsonCount(2, 'data');
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs?user=nobody')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs?from='.now()->addDay()->toDateString())->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($super)->getJson('/api/v1/admin/audit-logs?to='.now()->toDateString().'&perPage=1')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.lastPage', 2);
    }
}
