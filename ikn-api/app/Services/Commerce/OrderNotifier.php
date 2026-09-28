<?php

namespace App\Services\Commerce;

use App\Mail\Commerce\OrderCancelled;
use App\Mail\Commerce\OrderCompleted;
use App\Mail\Commerce\OrderDelivered;
use App\Mail\Commerce\OrderExpired;
use App\Mail\Commerce\OrderPaymentReminder;
use App\Mail\Commerce\OrderPlaced;
use App\Mail\Commerce\OrderPlacedAdmin;
use App\Mail\Commerce\OrderShipped;
use App\Mail\Commerce\PaymentAccepted;
use App\Mail\Commerce\PaymentReceived;
use App\Mail\Commerce\PaymentRejected;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Satu titik semua notifikasi order (email; kanal lain ditambahkan di sini, ASUMSI A-26).
 * Semua Mailable ShouldQueue: dengan QUEUE_CONNECTION=database baris job ikut transaksi pemanggil;
 * dengan sync (dev/test) email dirender langsung. Kegagalan kirim tidak menggagalkan transisi order.
 */
class OrderNotifier
{
    public function __construct(private ModuleAccess $access, private CommerceSettings $settings)
    {
    }

    public function orderPlaced(Order $order): void
    {
        $this->toCustomer($order, new OrderPlaced($order));
        foreach ($this->admins('orders') as $admin) {
            $this->toUser($admin, new OrderPlacedAdmin($order, $admin));
        }
    }

    public function paymentReceived(Order $order, Payment $payment): void
    {
        foreach ($this->admins('payments') as $admin) {
            $this->toUser($admin, new PaymentReceived($order, $payment, $admin));
        }
    }

    public function paymentAccepted(Order $order): void
    {
        $this->toCustomer($order, new PaymentAccepted($order));
    }

    public function paymentRejected(Order $order, Payment $payment, string $reason): void
    {
        $this->toCustomer($order, new PaymentRejected($order, $payment, $reason));
    }

    public function orderExpired(Order $order): void
    {
        $this->toCustomer($order, new OrderExpired($order));
    }

    public function orderShipped(Order $order): void
    {
        $this->toCustomer($order, new OrderShipped($order));
    }

    public function orderDelivered(Order $order): void
    {
        $this->toCustomer($order, new OrderDelivered($order, (int) $this->settings->get('auto_complete_days')));
    }

    public function orderCompleted(Order $order): void
    {
        $this->toCustomer($order, new OrderCompleted($order));
    }

    public function paymentReminder(Order $order): void
    {
        $this->toCustomer($order, new OrderPaymentReminder($order));
    }

    public function orderCancelled(Order $order, ?string $reason, bool $wasPaid): void
    {
        $this->toCustomer($order, new OrderCancelled($order, $reason, $wasPaid));
    }

    /** Admin aktif yang punya modul tertentu (super_admin selalu termasuk). */
    public function admins(string $module): Collection
    {
        return User::admins()->where('status', User::STATUS_ACTIVE)->orderBy('id')->get()
            ->filter(fn (User $user) => $this->access->allows($user, $module))
            ->values();
    }

    private function toCustomer(Order $order, Mailable $mail): void
    {
        $email = $order->customerEmail();
        if ($email === '') {
            return;
        }

        $this->send([['email' => $email, 'name' => $order->customerName()]], $mail);
    }

    private function toUser(User $user, Mailable $mail): void
    {
        $this->send($user, $mail);
    }

    /** @param  mixed  $recipients */
    private function send($recipients, Mailable $mail): void
    {
        try {
            Mail::to($recipients)->send($mail);
        } catch (Throwable $e) {
            Log::warning('order notification failed: '.$e->getMessage(), ['mail' => get_class($mail)]);
        }
    }
}
