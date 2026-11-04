<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderFreightQuote;
use App\Models\Payment;

// Ke customer saat ongkir CIF disepakati (ASUMSI A-89): ringkasan + rincian ongkir + instruksi bayar (payment aktif) + batas waktu.
class FreightAccepted extends OrderMailable
{
    public ?OrderFreightQuote $quote;

    public ?Payment $payment;

    public function __construct(Order $order, ?OrderFreightQuote $quote = null, ?Payment $payment = null)
    {
        parent::__construct($order);
        $this->quote = $quote;
        $this->payment = $payment ?? $order->activePayment();
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.freight.accepted.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.freight-accepted', $this->baseData(['quote' => $this->quote, 'payment' => $this->payment]));
    }
}
