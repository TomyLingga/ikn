<?php

namespace App\Mail\Commerce;

// Ke customer saat order dikirim (kurir + resi).
class OrderShipped extends OrderMailable
{
    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.shipped.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-shipped', $this->baseData());
    }
}
