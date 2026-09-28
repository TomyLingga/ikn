<?php

namespace App\Mail\Commerce;

// Ke customer N jam sebelum batas waktu pembayaran (orders:remind, sekali per order).
class OrderPaymentReminder extends OrderMailable
{
    public function build(): self
    {
        $due = self::dateTime($this->order->payment_due_at);

        return $this->subject($this->trans('commerce.mail.reminder.subject', ['number' => $this->order->number, 'due' => $due]))
            ->view('mail.commerce.order-payment-reminder', $this->baseData(['payment' => $this->order->activePayment()]));
    }
}
