<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\User;

// Ke admin bermodul orders saat penawaran ongkir CIF lewat masa berlaku (orders:freight-expire, ASUMSI A-89). Bahasa admin: id.
class FreightQuoteExpiredAdmin extends OrderMailable
{
    public OrderFreightQuote $quote;

    public User $admin;

    public function __construct(Order $order, OrderFreightQuote $quote, User $admin)
    {
        parent::__construct($order, 'id');
        $this->quote = $quote;
        $this->admin = $admin;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.freight.expired_admin.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.freight-quote-expired-admin', $this->baseData(['admin' => $this->admin, 'quote' => $this->quote]));
    }
}
