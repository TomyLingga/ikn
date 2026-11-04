<?php

namespace Tests\Feature\Cms;

use App\Models\Page;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerMapMigrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_comma_separated_customers_become_a_list_and_back(): void
    {
        $page = Page::create(['slug' => 'kemitraan', 'title' => ['id' => 'Kemitraan'], 'status' => Page::STATUS_PUBLISHED]);
        $section = $page->sections()->create(['key' => 'peta', 'type' => 'customer_map', 'content' => [
            'items' => [['region' => 'europe', 'country' => ['id' => 'Italia'], 'customers' => 'Fenzi, Resine Italiane, ']],
        ]]);
        $migration = new \ConvertCustomerMapCustomersToList(); // kelas sudah dimuat saat RefreshDatabase menjalankan migrasi

        $migration->up();
        $customers = $section->fresh()->content['items'][0]['customers'];
        $this->assertSame(['Fenzi', 'Resine Italiane'], array_column($customers, 'name'));
        $this->assertSame(['lat' => null, 'lng' => null], $customers[0]['geo']);

        $migration->up(); // idempoten: daftar tidak diubah lagi
        $this->assertCount(2, $section->fresh()->content['items'][0]['customers']);

        $migration->down();
        $this->assertSame('Fenzi, Resine Italiane', $section->fresh()->content['items'][0]['customers']);
    }
}
