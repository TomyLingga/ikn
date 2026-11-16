<?php

namespace App\Services\Commerce;

use App\Mail\Commerce\FreightAccepted;
use App\Mail\Commerce\FreightAcceptedAdmin;
use App\Mail\Commerce\FreightCounteredAdmin;
use App\Mail\Commerce\FreightQuoted;
use App\Mail\Commerce\FreightQuoteExpiredAdmin;
use App\Mail\Commerce\FreightRequested;
use App\Mail\Commerce\FreightRequestedAdmin;
use App\Mail\Commerce\InstallmentDue;
use App\Mail\Commerce\InstallmentPaid;
use App\Mail\Commerce\InstallmentReminder;
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
use App\Mail\Commerce\ProformaUpdated;
use App\Models\Order;
use App\Models\OrderAttachment;
use App\Models\OrderFreightQuote;
use App\Models\OrderInstallment;
use App\Models\OrderProforma;
use App\Models\OrderTrackingUpdate;
use App\Models\Payment;
use App\Models\User;
use App\Services\Auth\ModuleAccess;
use App\Services\Notification\InAppNotifier;
use App\Support\Money;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Satu titik semua notifikasi order: email + notifikasi dalam aplikasi untuk customer (ASUMSI A-26, A-71).
 * Kejadian yang perlu ditindak atau diketahui admin juga masuk lonceng panel admin (toAdmins, kunci "admin.*").
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
        $this->toAdmins($order, 'order_placed', ['total' => Money::format($order->grandTotalInt(), $order->currencyCode())]);
    }

    public function paymentReceived(Order $order, Payment $payment): void
    {
        foreach ($this->admins('payments') as $admin) {
            $this->toUser($admin, new PaymentReceived($order, $payment, $admin));
        }
        // Lonceng admin hanya untuk bukti transfer yang harus diverifikasi; pembayaran gateway lunas tanpa tindakan admin.
        if ($payment->isManual()) {
            // Order bertermin (ASUMSI A-97): sebut termin mana yang dibayar.
            $installment = $payment->installment;
            $installment
                ? $this->toAdmins($order, 'payment_proof_installment', ['label' => $installment->label], 'payments', '/admin/payments')
                : $this->toAdmins($order, 'payment_proof', [], 'payments', '/admin/payments');
        }
    }

    /** Admin mulai menyiapkan pesanan (paid → processing): hanya notifikasi dalam aplikasi. */
    public function orderProcessing(Order $order): void
    {
        $this->inApp->order($order, 'order.processing');
    }

    /** Order → paid. Order bertermin (ASUMSI A-97): yang lunas baru termin pertama, notifikasi menyebut sisa tagihan. */
    public function paymentAccepted(Order $order): void
    {
        $this->toCustomer($order, new PaymentAccepted($order));
        $first = $order->firstInstallment();
        if ($first && $order->hasUnpaidInstallments()) {
            $this->inApp->order($order, 'order.installment_paid', $this->installmentParams($order, $first));

            return;
        }
        $this->inApp->order($order, 'order.payment_accepted');
    }

    public function paymentRejected(Order $order, Payment $payment, string $reason): void
    {
        $this->toCustomer($order, new PaymentRejected($order, $payment, $reason));
        $reason = $reason !== '' ? $reason : '-';
        if ($payment->installment) {
            $this->inApp->order($order, 'order.installment_rejected', ['reason' => $reason, 'label' => $payment->installment->label]);

            return;
        }
        $this->inApp->order($order, 'order.payment_rejected', ['reason' => $reason]);
    }

    // ---- Termin pembayaran (ASUMSI A-97) ----

    /** Termin lanjutan ditagih (pemicu tercapai atau ditagih admin): email dengan instruksi bayar + notifikasi dalam aplikasi. */
    public function installmentDue(Order $order, OrderInstallment $installment): void
    {
        $this->toCustomer($order, new InstallmentDue($order, $installment, $this->installmentPayment($installment)));
        $this->inApp->order($order, 'order.installment_due', $this->installmentParams($order, $installment));
    }

    /** Admin mengubah tanggal jatuh tempo termin yang sudah ditagih: hanya notifikasi dalam aplikasi. */
    public function installmentDueChanged(Order $order, OrderInstallment $installment): void
    {
        $this->inApp->order($order, 'order.installment_due_changed', $this->installmentParams($order, $installment));
    }

    /** Pengingat termin (scheduler atau tombol admin); $overdue = sudah melewati jatuh tempo. */
    public function installmentReminder(Order $order, OrderInstallment $installment, bool $overdue = false): void
    {
        $this->toCustomer($order, new InstallmentReminder($order, $installment, $overdue, $this->installmentPayment($installment)));
        $this->inApp->order($order, $overdue ? 'order.installment_overdue' : 'order.installment_reminder', $this->installmentParams($order, $installment));
    }

    /** Pembayaran termin lanjutan diverifikasi; $fullyPaid = semua termin order lunas. */
    public function installmentPaid(Order $order, OrderInstallment $installment, bool $fullyPaid = false): void
    {
        $this->toCustomer($order, new InstallmentPaid($order, $installment, $fullyPaid));
        $this->inApp->order($order, $fullyPaid ? 'order.fully_paid' : 'order.installment_paid', $this->installmentParams($order, $installment));
    }

    /** Parameter teks notifikasi termin; label {id,en} dirender per bahasa oleh InAppNotifier. */
    private function installmentParams(Order $order, OrderInstallment $installment): array
    {
        $progress = $order->paymentProgress();

        return [
            'label' => $installment->label,
            'amount' => Money::format($installment->amountInt(), $installment->currencyCode()),
            'due' => OrderMailable::dateTime($installment->due_at),
            'outstanding' => Money::format($progress['outstandingTotal'], $progress['currency']),
        ];
    }

    /** Payment yang sedang menunggu pembayaran untuk termin ini (instruksi bayar di email). */
    private function installmentPayment(OrderInstallment $installment): ?Payment
    {
        return Payment::with(['paymentMethod', 'bankAccount'])->where('installment_id', $installment->id)
            ->whereIn('status', Payment::ACTIVE_STATUSES)->orderByDesc('id')->first();
    }

    public function orderExpired(Order $order): void
    {
        $this->toCustomer($order, new OrderExpired($order));
        $this->inApp->order($order, 'order.expired');
    }

    /** Dikirim; Loco = "siap diambil" di titik ambil (ASUMSI A-85); FOB/CIF = "dimuat ke kapal" dengan nama kapal + B/L (ASUMSI A-88). */
    public function orderShipped(Order $order): void
    {
        $this->toCustomer($order, new OrderShipped($order));
        if ($order->isPickup()) {
            $this->inApp->order($order, 'order.ready_for_pickup', ['label' => $order->pickupLabel()]);

            return;
        }
        if ($order->isPort()) {
            $details = $order->shipmentDetails() ?? [];
            $this->inApp->order($order, 'order.shipped_on_board', [
                'vessel' => (string) ($details['vessel'] ?? '-'),
                'bl' => (string) ($details['blNumber'] ?? $order->tracking_number ?? '-'),
            ]);

            return;
        }
        $this->inApp->order($order, 'order.shipped', ['courier' => (string) $order->courier, 'tracking' => (string) $order->tracking_number]);
    }

    /** Lampiran baru dari admin (faktur pajak dsb.): notifikasi dalam aplikasi dengan tautan ke detail pesanan. */
    public function attachmentAdded(Order $order, OrderAttachment $attachment): void
    {
        $this->inApp->order($order, 'order.attachment', ['label' => (string) ($attachment->label ?: ($attachment->media->original_name ?? 'dokumen'))]);
    }

    /** Proforma invoice diterbitkan atau direvisi admin (ASUMSI A-88): email ringan + notifikasi dalam aplikasi dengan label revisi. */
    public function proformaUpdated(Order $order, OrderProforma $proforma): void
    {
        $this->toCustomer($order, new ProformaUpdated($order, $proforma));
        $this->inApp->order($order, 'order.proforma_updated', ['label' => $proforma->label()]);
    }

    /** Catatan perjalanan kiriman dari admin: hanya notifikasi dalam aplikasi (tanpa email agar tidak membanjiri kotak masuk). */
    public function trackingUpdated(Order $order, OrderTrackingUpdate $update): void
    {
        $this->inApp->order($order, 'order.tracking', ['note' => $update->note]);
    }

    /** @param  bool  $byCustomer  customer sendiri yang mengonfirmasi barang diterima (admin diberi tahu) */
    public function orderDelivered(Order $order, bool $byCustomer = false): void
    {
        $this->toCustomer($order, new OrderDelivered($order, (int) $this->settings->get('auto_complete_days')));
        // Order bertermin (ASUMSI A-97): selama ada termin belum lunas, jangan ajak customer menyelesaikan pesanan.
        if ($order->hasUnpaidInstallments()) {
            $progress = $order->paymentProgress();
            $this->inApp->order($order, $order->isPickup() ? 'order.picked_up_balance_due' : 'order.delivered_balance_due', [
                'outstanding' => Money::format($progress['outstandingTotal'], $progress['currency']),
            ]);
        } else {
            $this->inApp->order($order, $order->isPickup() ? 'order.picked_up' : 'order.delivered');
        }
        if ($byCustomer) {
            $this->toAdmins($order, 'order_received');
        }
    }

    /** @param  bool  $byCustomer  diselesaikan customer, bukan selesai otomatis oleh scheduler (admin diberi tahu) */
    public function orderCompleted(Order $order, bool $byCustomer = false): void
    {
        $this->toCustomer($order, new OrderCompleted($order));
        $this->inApp->order($order, 'order.completed');
        if ($byCustomer) {
            $this->toAdmins($order, 'order_completed');
        }
    }

    public function paymentReminder(Order $order): void
    {
        $this->toCustomer($order, new OrderPaymentReminder($order));
        $this->inApp->order($order, 'order.payment_reminder');
    }

    /**
     * @param  bool  $freightTimeout  batal otomatis karena batas tunggu penawaran ongkir CIF terlewati (ASUMSI A-89)
     * @param  bool  $byCustomer  dibatalkan customer sendiri (admin diberi tahu)
     */
    public function orderCancelled(Order $order, ?string $reason, bool $wasPaid, bool $freightTimeout = false, bool $byCustomer = false): void
    {
        $this->toCustomer($order, new OrderCancelled($order, $reason, $wasPaid));
        $this->inApp->order($order, $freightTimeout ? 'order.freight_cancelled' : 'order.cancelled');
        if ($byCustomer) {
            $this->toAdmins($order, 'order_cancelled');
        }
    }

    // ---- Penawaran ongkir CIF (ASUMSI A-89) ----

    /** Order CIF dibuat: customer diberi tahu pesanan diterima dan menunggu penawaran; admin modul orders diminta menawar. */
    public function freightRequested(Order $order): void
    {
        $this->toCustomer($order, new FreightRequested($order));
        $this->inApp->order($order, 'order.freight_requested', ['port' => $this->portName($order)]);
        foreach ($this->admins('orders') as $admin) {
            $this->toUser($admin, new FreightRequestedAdmin($order, $admin));
        }
        $this->toAdmins($order, 'freight_requested', ['port' => $this->portName($order)]);
    }

    /** Admin mengirim penawaran baru, atau memperpanjang masa berlakunya ($extended). */
    public function freightQuoted(Order $order, OrderFreightQuote $quote, bool $extended = false): void
    {
        $this->toCustomer($order, new FreightQuoted($order, $quote, $extended));
        $this->inApp->order($order, $extended ? 'order.freight_quote_extended' : 'order.freight_quoted', [
            'total' => Money::format($quote->totalMinor(), $order->currencyCode()),
            'until' => $quote->valid_until ? OrderMailable::dateTime($quote->valid_until) : '-',
        ]);
    }

    /** Customer mengajukan harga balasan: hanya admin yang perlu tahu (email + lonceng admin). */
    public function freightCountered(Order $order, OrderFreightQuote $quote): void
    {
        foreach ($this->admins('orders') as $admin) {
            $this->toUser($admin, new FreightCounteredAdmin($order, $quote, $admin));
        }
        $this->toAdmins($order, 'freight_countered', ['total' => Money::format($quote->totalMinor(), $order->currencyCode())]);
    }

    /** Ongkir disepakati (customer menerima penawaran, atau admin menerima balasan): instruksi bayar ke customer + kabar ke admin. */
    public function freightAccepted(Order $order, ?OrderFreightQuote $quote, string $acceptedBy): void
    {
        $this->toCustomer($order, new FreightAccepted($order, $quote));
        $this->inApp->order($order, 'order.freight_accepted', ['total' => Money::format($order->shippingTotalInt(), $order->currencyCode())]);
        foreach ($this->admins('orders') as $admin) {
            $this->toUser($admin, new FreightAcceptedAdmin($order, $quote, $admin, $acceptedBy));
        }
        // Lonceng admin hanya bila customer yang menyetujui; admin yang menerima harga balasan sudah tahu.
        if ($acceptedBy === OrderFreightQuote::BY_CUSTOMER) {
            $this->toAdmins($order, 'freight_accepted', ['total' => Money::format($order->shippingTotalInt(), $order->currencyCode())]);
        }
    }

    /** Penawaran admin lewat masa berlaku (scheduler): customer in-app, admin email agar memperpanjang/menawar ulang. */
    public function freightQuoteExpired(Order $order, OrderFreightQuote $quote): void
    {
        $this->inApp->order($order, 'order.freight_expired', ['round' => (int) $quote->round]);
        foreach ($this->admins('orders') as $admin) {
            $this->toUser($admin, new FreightQuoteExpiredAdmin($order, $quote, $admin));
        }
        $this->toAdmins($order, 'freight_expired', ['round' => (int) $quote->round]);
    }

    private function portName(Order $order): string
    {
        return (string) ($order->destinationPort()['name'] ?? '-');
    }

    /** Admin aktif yang punya modul tertentu (super_admin selalu termasuk). */
    public function admins(string $module): Collection
    {
        return $this->access->adminsWith($module);
    }

    /**
     * Notifikasi lonceng admin bermodul $module tentang order ini (kunci "admin.$type"); tautan bawaan = detail order.
     * Customer disebut dengan nama perusahaannya bila ada.
     */
    private function toAdmins(Order $order, string $type, array $params = [], string $module = 'orders', ?string $url = null): void
    {
        $this->inApp->admins(
            $module,
            'admin.'.$type,
            ['number' => $order->number, 'customer' => $order->customerCompany() ?: $order->customerName()] + $params,
            $url ?? '/admin/orders/'.$order->number,
            ['orderNumber' => $order->number]
        );
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
