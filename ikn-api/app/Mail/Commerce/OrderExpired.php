<?php

namespace App\Mail\Commerce;

// Ke customer saat order kedaluwarsa (orders:expire).
class OrderExpired extends OrderMailable
{
    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.expired.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-expired', $this->baseData());
    }
}
