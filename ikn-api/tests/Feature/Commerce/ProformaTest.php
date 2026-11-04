<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderShipped;
use App\Mail\Commerce\ProformaUpdated;
use App\Models\Order;
use App\Models\OrderProforma;
use App\Models\Product;
use App\Models\UserNotification;
use App\Services\Commerce\CheckoutService;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Payment\PaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\MailManager;
use Illuminate\Support\Facades\Mail;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

/**
 * Dokumen ekspor (kontrak 11.11, ASUMSI A-88): proforma invoice per order dengan nomor tetap + revisi, bawaan revisi 1 dari
 * term/syarat bayar, notifikasi customer tiap simpan, 409 untuk order batal; shipped on board untuk order FOB/CIF
 * (nama kapal + B/L menggantikan kurir + resi) sementara order Franco tetap wajib kurir.
 */
class ProformaTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    private function exportOrder(): array
    {
        $this->setUpCommerce();
        $this->setUpExport();
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'code' => 'RSP-35', 'price' => 185000, 'price_usd' => '12.50', 'moq' => 25, 'unit' => 'kg'], 1000);
        $order = app(CheckoutService::class)->place($this->exporter, $this->exportCheckoutPayload($product, 100));

        return [$order, $product];
    }

    /** Mail::fake() mengganti binding 'mailer' dengan MailFake yang tidak bisa merender; pakai mailer asli hanya untuk render HTML. */
    private function renderMail(Mailable $mail): string
    {
        $this->app->instance('mailer', (new MailManager($this->app))->mailer());
        try {
            return $mail->render();
        } finally {
            $this->app->forgetInstance('mailer');
        }
    }

    public function test_admin_saves_proforma_with_defaults_then_revises_and_customer_sees_it(): void
    {
        Mail::fake();
        [$order] = $this->exportOrder();
        $admin = $this->adminWith(['orders'], ['name' => 'Admin Ekspor']);
        $url = '/api/v1/admin/orders/'.$order->number.'/proforma';
        $expectedTerms = $order->payment_term_snapshot['description']['en'] ?? $order->payment_term_snapshot['name']['en'];

        // Belum ada proforma: detail admin menandai order pelabuhan dan boleh membuat proforma.
        $this->actingAs($admin)->getJson('/api/v1/admin/orders/'.$order->number)->assertOk()
            ->assertJsonPath('data.proforma', null)->assertJsonPath('data.canEditProforma', true)->assertJsonPath('data.isPort', true)->assertJsonPath('data.shipmentDetails', null);

        // Validasi: panjang dan format tanggal.
        $this->actingAs($admin)->putJson($url, ['vesselName' => str_repeat('a', 121)])->assertStatus(422)->assertJsonValidationErrors(['vesselName']);
        $this->actingAs($admin)->putJson($url, ['etd' => 'bukan-tanggal'])->assertStatus(422)->assertJsonValidationErrors(['etd']);
        $this->assertSame(0, OrderProforma::count());

        // Simpan pertama = revisi 1 dengan bawaan pelabuhan muat (term FOB Belawan) dan syarat bayar dari snapshot order.
        $first = $this->actingAs($admin)->putJson($url, [
            'vesselName' => ' MV Test Vessel ', 'etd' => '2026-11-20', 'eta' => '2026-11-27', 'validUntil' => '2026-11-15', 'portOfLoading' => '',
        ])->assertOk();
        $first->assertJsonPath('data.proforma.number', 'PI/'.$order->number)
            ->assertJsonPath('data.proforma.label', 'PI/'.$order->number)
            ->assertJsonPath('data.proforma.revision', 1)
            ->assertJsonPath('data.proforma.vesselName', 'MV Test Vessel')
            ->assertJsonPath('data.proforma.voyage', null)
            ->assertJsonPath('data.proforma.etd', '2026-11-20')->assertJsonPath('data.proforma.eta', '2026-11-27')->assertJsonPath('data.proforma.validUntil', '2026-11-15')
            ->assertJsonPath('data.proforma.portOfLoading', 'Belawan')
            ->assertJsonPath('data.proforma.portOfDischarge', null)
            ->assertJsonPath('data.proforma.paymentTerms', $expectedTerms)
            ->assertJsonPath('data.proforma.updatedBy.name', 'Admin Ekspor')
            ->assertJsonPath('data.canEditProforma', true);
        $issuedAt = $first->json('data.proforma.issuedAt');
        $this->assertNotNull($issuedAt);
        $this->assertDatabaseHas('order_proformas', ['order_id' => $order->id, 'revision' => 1, 'vessel_name' => 'MV Test Vessel', 'port_of_loading' => 'Belawan', 'updated_by' => $admin->id]);
        $this->assertDatabaseHas('audit_logs', ['user_id' => $admin->id, 'subject_type' => 'Order', 'subject_id' => $order->id, 'action' => 'PUT api/v1/admin/orders/{order}/proforma']);
        Mail::assertQueued(ProformaUpdated::class, fn (ProformaUpdated $mail) => $mail->hasTo('buyer@rubbertrade.example') && $mail->proforma->revision === 1);
        $notification = UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.proforma_updated')->firstOrFail();
        $this->assertStringContainsString('PI/'.$order->number, $notification->body['en']);
        $this->assertSame('/dashboard/pesanan/'.$order->number, $notification->url);

        // Simpan kedua = revisi 2: nomor tetap, label bertanda revisi, issuedAt tidak berubah, field kosong tidak diisi bawaan lagi.
        $editor = $this->adminWith(['orders'], ['name' => 'Admin Dokumen']);
        $second = $this->actingAs($editor)->putJson($url, [
            'vesselName' => 'MV Second Vessel', 'voyage' => '0412N', 'portOfDischarge' => 'Port Klang', 'paymentTerms' => $expectedTerms, 'notes' => "Partial shipment not allowed.\nShipped in 25 kg bales.",
        ])->assertOk();
        $second->assertJsonPath('data.proforma.number', 'PI/'.$order->number)
            ->assertJsonPath('data.proforma.label', 'PI/'.$order->number.' Rev.2')
            ->assertJsonPath('data.proforma.revision', 2)
            ->assertJsonPath('data.proforma.vesselName', 'MV Second Vessel')->assertJsonPath('data.proforma.voyage', '0412N')
            ->assertJsonPath('data.proforma.portOfLoading', null)->assertJsonPath('data.proforma.portOfDischarge', 'Port Klang')
            ->assertJsonPath('data.proforma.etd', null)
            ->assertJsonPath('data.proforma.issuedAt', $issuedAt)
            ->assertJsonPath('data.proforma.updatedBy.id', $editor->id)->assertJsonPath('data.proforma.updatedBy.name', 'Admin Dokumen');
        $this->assertSame(1, OrderProforma::count());
        $this->assertSame(2, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.proforma_updated')->count());
        Mail::assertQueued(ProformaUpdated::class, fn (ProformaUpdated $mail) => $mail->proforma->revision === 2);

        // Email proforma: label revisi, kapal, pelabuhan bongkar, tautan pesanan (bahasa customer = en).
        $html = $this->renderMail(new ProformaUpdated($order->fresh(), OrderProforma::where('order_id', $order->id)->firstOrFail()));
        $this->assertStringContainsString('PI/'.$order->number.' Rev.2', $html);
        $this->assertStringContainsString('MV Second Vessel', $html);
        $this->assertStringContainsString('Port Klang', $html);
        $this->assertStringContainsString('/dashboard/pesanan/'.$order->number, $html);
        $this->assertStringContainsString('has been updated', $html);

        // Customer melihat proforma di detail pesanannya.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->getJson('/api/v1/customer/orders/'.$order->number)->assertOk()
            ->assertJsonPath('data.proforma.revision', 2)->assertJsonPath('data.proforma.label', 'PI/'.$order->number.' Rev.2')
            ->assertJsonPath('data.isPort', true)->assertJsonPath('data.canEditProforma', true)
            ->assertJsonPath('data.deliveryTerm.loadingPort', 'Belawan')->assertJsonPath('data.paymentTerm.code', 'tt_advance')
            ->assertJsonPath('data.payment.bankAccount.swiftCode', 'BMRIIDJA');

        // Tanpa modul orders atau sebagai customer: 403.
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminWith(['payments']))->putJson($url, ['vesselName' => 'X'])->assertStatus(403)->assertJsonPath('code', 'FORBIDDEN');
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->exporter)->putJson($url, ['vesselName' => 'X'])->assertStatus(403);
        $this->assertSame(2, OrderProforma::where('order_id', $order->id)->value('revision'));
    }

    public function test_proforma_is_rejected_on_cancelled_order(): void
    {
        Mail::fake();
        [$order] = $this->exportOrder();
        $admin = $this->adminWith(['orders']);
        app(OrderStateMachine::class)->transition($order, Order::STATUS_CANCELLED, $this->exporter, ['reason' => 'Changed supplier']);

        $this->actingAs($admin)->putJson('/api/v1/admin/orders/'.$order->number.'/proforma', ['vesselName' => 'MV Test Vessel'])
            ->assertStatus(409)->assertJsonPath('code', 'PROFORMA_NOT_ALLOWED')->assertJsonPath('meta.status', 'cancelled');
        $this->assertSame(0, OrderProforma::count());
        $this->actingAs($admin)->getJson('/api/v1/admin/orders/'.$order->number)->assertOk()->assertJsonPath('data.canEditProforma', false)->assertJsonPath('data.proforma', null);
        $this->assertSame(0, UserNotification::where('type', 'order.proforma_updated')->count());
    }

    public function test_port_order_ships_on_board_with_vessel_and_bl_while_door_order_still_needs_courier(): void
    {
        Mail::fake();
        [$order, $product] = $this->exportOrder();
        $admin = $this->adminWith(['orders']);
        $payments = app(PaymentService::class);
        $payments->accept($payments->uploadProof($order, $this->proofFile(), null, $this->exporter), $admin);
        app(OrderStateMachine::class)->transition($order, Order::STATUS_PROCESSING, $admin);
        $url = '/api/v1/admin/orders/'.$order->number.'/status';

        // Tanpa kapal/B/L → 422 (kurir + resi tidak membantu untuk order pelabuhan); tanggal B/L di masa depan ditolak.
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped'])->assertStatus(422)->assertJsonValidationErrors(['vesselName', 'blNumber']);
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped', 'courier' => 'Maersk', 'trackingNumber' => 'X'])->assertStatus(422)->assertJsonValidationErrors(['vesselName', 'blNumber']);
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped', 'vesselName' => 'MV Test Vessel'])->assertStatus(422)->assertJsonValidationErrors(['blNumber']);
        $this->actingAs($admin)->postJson($url, ['status' => 'shipped', 'vesselName' => 'MV Test Vessel', 'blNumber' => 'BL-TEST-001', 'blDate' => now()->addDay()->toDateString()])
            ->assertStatus(422)->assertJsonValidationErrors(['blDate']);
        $this->assertSame('processing', $order->fresh()->status);
        Mail::assertNotQueued(OrderShipped::class);

        $blDate = now()->subDay()->toDateString();
        $response = $this->actingAs($admin)->postJson($url, [
            'status' => 'shipped', 'vesselName' => 'MV Test Vessel', 'voyage' => '0412N', 'blNumber' => 'BL-TEST-001', 'blDate' => $blDate,
            'courier' => 'ignored', 'trackingNumber' => 'ignored',
        ])->assertOk();
        $response->assertJsonPath('data.status', 'shipped')
            ->assertJsonPath('data.isPort', true)
            ->assertJsonPath('data.courier', null)
            ->assertJsonPath('data.trackingNumber', 'BL-TEST-001')
            ->assertJsonPath('data.shipmentDetails.vessel', 'MV Test Vessel')
            ->assertJsonPath('data.shipmentDetails.voyage', '0412N')
            ->assertJsonPath('data.shipmentDetails.blNumber', 'BL-TEST-001')
            ->assertJsonPath('data.shipmentDetails.blDate', $blDate)
            ->assertJsonPath('data.canAddTracking', true);
        $this->assertStringStartsWith($blDate, $response->json('data.shippedAt'));
        $timeline = collect($response->json('data.timeline'))->firstWhere('status', 'shipped');
        $this->assertSame('Shipped on board MV Test Vessel, B/L BL-TEST-001.', $timeline['note']); // bahasa order = en
        $this->assertEquals(['vesselName' => 'MV Test Vessel', 'voyage' => '0412N', 'blNumber' => 'BL-TEST-001', 'blDate' => $blDate], $timeline['meta']);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'status' => 'shipped', 'courier' => null, 'tracking_number' => 'BL-TEST-001']);

        $notification = UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.shipped_on_board')->firstOrFail();
        $this->assertStringContainsString('MV Test Vessel', $notification->body['en']);
        $this->assertStringContainsString('BL-TEST-001', $notification->body['id']);
        $this->assertSame(0, UserNotification::where('user_id', $this->exporter->id)->where('type', 'order.shipped')->count());
        Mail::assertQueued(OrderShipped::class, fn (OrderShipped $mail) => $mail->hasTo('buyer@rubbertrade.example'));
        $html = $this->renderMail(new OrderShipped($order->fresh()));
        $this->assertStringContainsString('loaded on board', $html);
        $this->assertStringContainsString('MV Test Vessel', $html);
        $this->assertStringContainsString('0412N', $html);
        $this->assertStringContainsString('BL-TEST-001', $html);
        $this->assertStringNotContainsString('Courier', $html);

        // Daftar admin menampilkan nomor B/L di kolom resi yang sudah ada.
        $this->actingAs($admin)->getJson('/api/v1/admin/orders?status=shipped')->assertOk()->assertJsonPath('data.0.trackingNumber', 'BL-TEST-001')->assertJsonPath('data.0.courier', null);

        // Order Franco (darat): field kapal diabaikan, kurir + resi tetap wajib dan shipmentDetails tetap null.
        $door = $this->payOrder($this->placeOrder($product, 25), $admin); // MOQ produk 25
        app(OrderStateMachine::class)->transition($door, Order::STATUS_PROCESSING, $admin);
        $doorUrl = '/api/v1/admin/orders/'.$door->number.'/status';
        $this->actingAs($admin)->postJson($doorUrl, ['status' => 'shipped', 'vesselName' => 'MV Test Vessel', 'blNumber' => 'BL-1'])
            ->assertStatus(422)->assertJsonValidationErrors(['courier', 'trackingNumber']);
        $this->actingAs($admin)->postJson($doorUrl, ['status' => 'shipped', 'courier' => 'JNE', 'trackingNumber' => 'JNE001', 'vesselName' => 'MV Test Vessel', 'blNumber' => 'BL-1'])
            ->assertOk()->assertJsonPath('data.isPort', false)->assertJsonPath('data.courier', 'JNE')->assertJsonPath('data.trackingNumber', 'JNE001')->assertJsonPath('data.shipmentDetails', null);
        $doorTimeline = collect($this->actingAs($admin)->getJson('/api/v1/admin/orders/'.$door->number)->json('data.timeline'))->firstWhere('status', 'shipped');
        $this->assertEquals(['courier' => 'JNE', 'trackingNumber' => 'JNE001'], $doorTimeline['meta']);
        $this->assertSame(1, UserNotification::where('user_id', $this->buyer->id)->where('type', 'order.shipped')->count());
    }
}
