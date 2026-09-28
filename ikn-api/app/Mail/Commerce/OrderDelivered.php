<?php

namespace App\Mail\Commerce;

// Ke customer saat order tercatat diterima.
class OrderDelivered extends OrderMailable
{
    public int $autoCompleteDays;

    public function __construct(\App\Models\Order $order, int $autoCompleteDays = 7)
    {
        parent::__construct($order);
        $this->autoCompleteDays = $autoCompleteDays;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.delivered.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-delivered', $this->baseData(['autoCompleteDays' => $this->autoCompleteDays]));
    }
}
