<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderProforma;

// Ke customer setiap proforma invoice diterbitkan atau direvisi admin (ASUMSI A-88); detail dilihat di halaman pesanan.
class ProformaUpdated extends OrderMailable
{
    public OrderProforma $proforma;

    public function __construct(Order $order, OrderProforma $proforma)
    {
        parent::__construct($order);
        $this->proforma = $proforma;
    }

    public function build(): self
    {
        $label = $this->proforma->label();

        return $this->subject($this->trans('commerce.mail.proforma.subject', ['label' => $label, 'number' => $this->order->number]))
            ->view('mail.commerce.proforma-updated', $this->baseData(['proforma' => $this->proforma, 'label' => $label]));
    }
}
