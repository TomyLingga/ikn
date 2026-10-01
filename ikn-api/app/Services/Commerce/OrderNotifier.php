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
use App\Models\OrderAttachment;
use App\Models\OrderTrackingUpdate;
use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use App\Services\Notification\InAppNotifier;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Satu titik semua notifikasi order: email + notifikasi dalam aplikasi untuk customer (ASUMSI A-26, A-71).
 * Semua Mailable ShouldQueue: dengan QUEUE_CONNECTION=database baris job ikut transaksi pemanggil;
 * dengan sync (dev/test) email dirender langsung. Kegagalan kirim tidak menggagalkan transisi order.
 */
class OrderNotifier
{
    public function __construct(private ModuleAccess $access, private CommerceSettings $settings, private InAppNotifier $inApp)
    {
    }

    public function orderPlaced(Order $order): void
    {
        $this->toCustomer($order, new OrderPlaced($order));
        $this->inApp->order($order, 'order.placed');
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
        $this->inApp->order($order, 'order.payment_accepted');
    }

    public function paymentRejected(Order $order, Payment $payment, string $reason): void
    {
        $this->toCustomer($order, new PaymentRejected($order, $payment, $reason));
        $this->inApp->order($order, 'order.payment_rejected', ['reason' => $reason !== '' ? $reason : '-']);
    }

    public function orderExpired(Order $order): void
    {
        $this->toCustomer($order, new OrderExpired($order));
        $this->inApp->order($order, 'order.expired');
    }

    public function orderShipped(Order $order): void
    {
        $this->toCustomer($order, new OrderShipped($order));
        $this->inApp->order($order, 'order.shipped', ['courier' => (string) $order->courier, 'tracking' => (string) $order->tracking_number]);
    }

    /** Lampiran baru dari admin (faktur pajak dsb.): notifikasi dalam aplikasi dengan tautan ke detail pesanan. */
    public function attachmentAdded(Order $order, OrderAttachment $attachment): void
    {
        $this->inApp->order($order, 'order.attachment', ['label' => (string) ($attachment->label ?: ($attachment->media->original_name ?? 'dokumen'))]);
    }

    /** Catatan perjalanan kiriman dari admin: hanya notifikasi dalam aplikasi (tanpa email agar tidak membanjiri kotak masuk). */
    public function trackingUpdated(Order $order, OrderTrackingUpdate $update): void
    {
        $this->inApp->order($order, 'order.tracking', ['note' => $update->note]);
    }

    public function orderDelivered(Order $order): void
    {
        $this->toCustomer($order, new OrderDelivered($order, (int) $this->settings->get('auto_complete_days')));
        $this->inApp->order($order, 'order.delivered');
    }

    public function orderCompleted(Order $order): void
    {
        $this->toCustomer($order, new OrderCompleted($order));
        $this->inApp->order($order, 'order.completed');
    }

    public function paymentReminder(Order $order): void
    {
        $this->toCustomer($order, new OrderPaymentReminder($order));
        $this->inApp->order($order, 'order.payment_reminder');
    }

    public function orderCancelled(Order $order, ?string $reason, bool $wasPaid): void
    {
        $this->toCustomer($order, new OrderCancelled($order, $reason, $wasPaid));
        $this->inApp->order($order, 'order.cancelled');
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
