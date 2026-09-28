<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\Payment;
use App\Models\User;

// Ke admin bermodul payments saat customer mengunggah bukti bayar (order → payment_review).
class PaymentReceived extends OrderMailable
{
    public Payment $payment;

    public User $admin;

    public function __construct(Order $order, Payment $payment, User $admin)
    {
        parent::__construct($order, 'id');
        $this->payment = $payment;
        $this->admin = $admin;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.payment_received.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.payment-received', $this->baseData(['payment' => $this->payment, 'admin' => $this->admin]));
    }
}
