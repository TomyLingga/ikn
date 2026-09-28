<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\Payment;

// Ke customer saat bukti bayar ditolak (order kembali pending_payment, batas waktu tidak berubah).
class PaymentRejected extends OrderMailable
{
    public Payment $payment;

    public string $reason;

    public function __construct(Order $order, Payment $payment, string $reason)
    {
        parent::__construct($order);
        $this->payment = $payment;
        $this->reason = $reason;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.payment_rejected.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.payment-rejected', $this->baseData(['payment' => $this->payment, 'reason' => $this->reason]));
    }
}
