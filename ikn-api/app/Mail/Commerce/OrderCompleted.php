<?php

namespace App\Mail\Commerce;

// Ke customer saat order selesai (konfirmasi customer atau orders:auto-complete).
class OrderCompleted extends OrderMailable
{
    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.completed.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-completed', $this->baseData());
    }
}
