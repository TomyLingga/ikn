<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\User;

// Ke admin bermodul orders saat customer mengajukan harga balasan ongkir CIF (ASUMSI A-89). Bahasa admin: id.
class FreightCounteredAdmin extends OrderMailable
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
        $previous = OrderFreightQuote::where('order_id', $this->order->id)
            ->where('proposed_by', OrderFreightQuote::BY_ADMIN)
            ->where('round', '<', $this->quote->round)
            ->orderByDesc('round')->first();

        return $this->subject($this->trans('commerce.mail.freight.countered_admin.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.freight-countered-admin', $this->baseData(['admin' => $this->admin, 'quote' => $this->quote, 'previous' => $previous]));
    }
}
