<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\User;

// Ke admin bermodul orders saat order baru dibuat (ASUMSI A-26). Bahasa admin: id.
class OrderPlacedAdmin extends OrderMailable
{
    public User $admin;

    public function __construct(Order $order, User $admin)
    {
        parent::__construct($order, 'id');
        $this->admin = $admin;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.placed_admin.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.order-placed-admin', $this->baseData(['admin' => $this->admin]));
    }
}
