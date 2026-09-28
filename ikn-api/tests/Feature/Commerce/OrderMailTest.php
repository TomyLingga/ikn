<?php

namespace Tests\Feature\Commerce;

use App\Mail\Commerce\OrderCancelled;
use App\Mail\Commerce\OrderCompleted;
use App\Mail\Commerce\OrderDelivered;
use App\Mail\Commerce\OrderExpired;
use App\Mail\Commerce\OrderMailable;
use App\Mail\Commerce\OrderPaymentReminder;
use App\Mail\Commerce\OrderPlaced;
use App\Mail\Commerce\OrderPlacedAdmin;
use App\Mail\Commerce\OrderShipped;
use App\Mail\Commerce\PaymentAccepted;
use App\Mail\Commerce\PaymentReceived;
use App\Mail\Commerce\PaymentRejected;
use App\Models\Order;
use App\Services\Commerce\OrderStateMachine;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\CommerceFixtures;
use Tests\TestCase;

// Render nyata semua email transaksional (dua bahasa): view Blade, layout BE-1, tautan FE, nominal, kurir/resi.
class OrderMailTest extends TestCase
{
    use RefreshDatabase, CommerceFixtures;

    public function test_all_order_mails_render_in_both_locales(): void
    {
        $this->setUpCommerce();
        $this->makeFee(5000);
        $product = $this->makeProduct(['slug' => 'resiprene-35', 'name' => ['id' => 'Resiprene 35', 'en' => 'Resiprene 35 EN'], 'price' => 185000, 'moq' => 25], 500);
        $admin = $this->adminWith(['orders', 'payments'], ['name' => 'Admin Penjualan']);
        $order = $this->placeOrder($product, 25);
        $payment = $order->activePayment();
        $number = $order->number;
        $total = OrderMailable::money($order->grandTotalInt());

        $mails = [
            [new OrderPlaced($order), [$number, $total, 'Transfer ke rekening di bawah.', '0123456789', '/dashboard/pesanan/'.$number, 'Kode unik']],
            [new OrderPlacedAdmin($order, $admin), [$number, 'Admin Penjualan', '/admin/orders/'.$number]],
            [new PaymentReceived($order, $payment, $admin), [$number, 'manual_transfer', '/admin/orders/'.$number]],
            [new PaymentAccepted($order), [$number, $total]],
            [new PaymentRejected($order, $payment, 'Nominal tidak sesuai'), [$number, 'Nominal tidak sesuai']],
            [new OrderExpired($order), [$number]],
            [new OrderPaymentReminder($order), [$number, $total, '0123456789']],
            [new OrderCancelled($order, 'Salah pesan', true), [$number, 'Salah pesan']],
        ];

        foreach ($mails as [$mail, $needles]) {
            $html = $mail->render();
            foreach ($needles as $needle) {
                $this->assertStringContainsString($needle, $html, get_class($mail).' must contain '.$needle);
            }
            $this->assertStringContainsString('PT Industri Karet Nusantara', $html);
            $this->assertStringContainsString('Resiprene 35', $html);
        }

        // Email setelah paid → shipped → delivered → completed (kurir + resi + invoice).
        $order = $this->payOrder($order, $admin);
        $sm = app(OrderStateMachine::class);
        $sm->transition($order, Order::STATUS_PROCESSING, $admin);
        $sm->transition($order, Order::STATUS_SHIPPED, $admin, ['courier' => 'JNE Trucking', 'trackingNumber' => 'JNT001']);
        $order->refresh();

        $accepted = (new PaymentAccepted($order))->render();
        $this->assertStringContainsString($order->invoice_number, $accepted);
        $shipped = (new OrderShipped($order))->render();
        $this->assertStringContainsString('JNE Trucking', $shipped);
        $this->assertStringContainsString('JNT001', $shipped);
        $this->assertStringContainsString('7 hari', (new OrderDelivered($order, 7))->render());
        $this->assertStringContainsString($order->number, (new OrderCompleted($order))->render());

        // Bahasa Inggris mengikuti snapshot orders.locale.
        $order->forceFill(['locale' => 'en'])->save();
        $order->refresh();
        $en = (new OrderShipped($order))->render();
        $this->assertStringContainsString('Your order has been shipped.', $en);
        $this->assertStringContainsString('Tracking number', $en);
        $this->assertStringContainsString('Resiprene 35 EN', $en);
        $this->assertSame('en', (new OrderPlaced($order))->locale);
        $this->assertSame('id', (new OrderPlacedAdmin($order, $admin))->locale); // admin selalu id
        $this->assertStringContainsString('Pesanan Anda telah dikirim.', (new OrderShipped($order->forceFill(['locale' => 'id']))) ->render());
    }
}
