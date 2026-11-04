<?php

namespace App\Mail\Commerce;

// Ke customer saat order dikirim (kurir + resi), Loco siap diambil (ASUMSI A-85), atau FOB/CIF dimuat ke kapal (ASUMSI A-88).
class OrderShipped extends OrderMailable
{
    public function build(): self
    {
        $onBoard = ! $this->order->isPickup() && $this->order->isPort();
        $key = $this->order->isPickup() ? 'commerce.mail.shipped.subject_pickup' : ($onBoard ? 'commerce.mail.shipped.subject_on_board' : 'commerce.mail.shipped.subject');

        return $this->subject($this->trans($key, ['number' => $this->order->number]))
            ->view('mail.commerce.order-shipped', $this->baseData([
                'pickup' => $this->order->pickupPoint(),
                // Satu baris per pabrik asal (ASUMSI A-90).
                'pickupPoints' => $this->order->pickupPoints(),
                'onBoard' => $onBoard,
                'shipment' => $this->order->shipmentDetails() ?? [],
            ]));
    }
}
