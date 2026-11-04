<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\User;

// Ke admin bermodul orders saat order CIF dibuat (ASUMSI A-89): permintaan penawaran ongkir ke pelabuhan tujuan. Bahasa admin: id.
class FreightRequestedAdmin extends OrderMailable
{
    public User $admin;

    public function __construct(Order $order, User $admin)
    {
        parent::__construct($order, 'id');
        $this->admin = $admin;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.freight.requested_admin.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.freight-requested-admin', $this->baseData(['admin' => $this->admin, 'port' => $this->order->destinationPort()]));
    }
}
