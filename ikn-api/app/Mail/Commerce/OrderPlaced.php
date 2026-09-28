<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\Payment;

// Ke customer saat checkout: ringkasan order + instruksi bayar (payment aktif) + batas waktu.
class OrderPlaced extends OrderMailable
{
    public ?Payment $payment;

    public function __construct(Order $order, ?Payment $payment = null)
    {
        parent::__construct($order);
        $this->payment = $payment ?? $order->activePayment();
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.placed.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-placed', $this->baseData(['payment' => $this->payment]));
    }
}
