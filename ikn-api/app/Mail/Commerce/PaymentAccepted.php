<?php

namespace App\Mail\Commerce;

// Ke customer saat pembayaran diverifikasi (order → paid, invoice terbit).
class PaymentAccepted extends OrderMailable
{
    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.payment_accepted.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.payment-accepted', $this->baseData());
    }
}
