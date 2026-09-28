<?php

namespace App\Mail\Commerce;

use App\Models\Order;

// Ke customer saat order dibatalkan (oleh customer sendiri atau admin, dengan alasan).
class OrderCancelled extends OrderMailable
{
    public ?string $reason;

    public bool $wasPaid;

    public function __construct(Order $order, ?string $reason = null, bool $wasPaid = false)
    {
        parent::__construct($order);
        $this->reason = $reason;
        $this->wasPaid = $wasPaid;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.cancelled.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-cancelled', $this->baseData(['reason' => $this->reason, 'wasPaid' => $this->wasPaid]));
    }
}
