<?php

namespace App\Mail\Commerce;

// Ke customer saat order tercatat diterima, atau untuk Loco saat barang sudah diambil (ASUMSI A-85).
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
        $key = $this->order->isPickup() ? 'commerce.mail.delivered.subject_pickup' : 'commerce.mail.delivered.subject';

        return $this->subject($this->trans($key, ['number' => $this->order->number]))
            ->view('mail.commerce.order-delivered', $this->baseData(['autoCompleteDays' => $this->autoCompleteDays, 'pickup' => $this->order->isPickup()]));
    }
}
