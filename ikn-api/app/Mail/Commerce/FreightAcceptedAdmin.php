<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\User;

// Ke admin bermodul orders saat ongkir CIF disepakati (customer menerima penawaran, atau admin menerima balasan). Bahasa admin: id.
class FreightAcceptedAdmin extends OrderMailable
{
    public ?OrderFreightQuote $quote;

    public User $admin;

    public string $acceptedBy;

    public function __construct(Order $order, ?OrderFreightQuote $quote, User $admin, string $acceptedBy)
    {
        parent::__construct($order, 'id');
        $this->quote = $quote;
        $this->admin = $admin;
        $this->acceptedBy = $acceptedBy;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.freight.accepted_admin.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.freight-accepted-admin', $this->baseData(['admin' => $this->admin, 'quote' => $this->quote, 'acceptedBy' => $this->acceptedBy]));
    }
}
