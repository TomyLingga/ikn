<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderFreightQuote;

// Ke customer saat admin mengirim penawaran ongkir CIF, atau memperpanjang masa berlakunya ($extended) (ASUMSI A-89).
class FreightQuoted extends OrderMailable
{
    public OrderFreightQuote $quote;

    public bool $extended;

    public function __construct(Order $order, OrderFreightQuote $quote, bool $extended = false)
    {
        parent::__construct($order);
        $this->quote = $quote;
        $this->extended = $extended;
    }

    public function build(): self
    {
        $key = $this->extended ? 'subject_extended' : 'subject';

        return $this->subject($this->trans('commerce.mail.freight.quoted.'.$key, ['number' => $this->order->number]))
            ->view('mail.commerce.freight-quoted', $this->baseData([
                'quote' => $this->quote,
                'extended' => $this->extended,
                'port' => $this->order->destinationPort(),
            ]));
    }
}
