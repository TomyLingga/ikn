<?php

namespace App\Mail\Commerce;

// Ke customer saat order CIF dibuat (ASUMSI A-89): pesanan diterima, menunggu penawaran ongkir; total belum termasuk ongkir.
class FreightRequested extends OrderMailable
{
    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.freight.requested.subject', ['number' => $this->order->number]))
            ->view('mail.commerce.freight-requested', $this->baseData(['port' => $this->order->destinationPort()]));
    }
}
