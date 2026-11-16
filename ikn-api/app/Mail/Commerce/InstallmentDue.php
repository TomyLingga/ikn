<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderInstallment;
use App\Models\Payment;

// Ke customer saat termin lanjutan ditagih (ASUMSI A-97): nominal termin, jatuh tempo, instruksi bayar, jadwal lengkap.
class InstallmentDue extends OrderMailable
{
    public OrderInstallment $installment;

    public ?Payment $payment;

    public function __construct(Order $order, OrderInstallment $installment, ?Payment $payment = null)
    {
        parent::__construct($order);
        $this->installment = $installment;
        $this->payment = $payment;
    }

    public function build(): self
    {
        return $this->subject($this->trans('commerce.mail.installment.'.$this->kind().'.subject', $this->params()))
            ->view('mail.commerce.installment-due', $this->baseData([
                'installment' => $this->installment,
                'payment' => $this->payment,
                'subjectLine' => $this->trans('commerce.mail.installment.'.$this->kind().'.subject', $this->params()),
                'intro' => $this->trans('commerce.mail.installment.'.$this->kind().'.intro', $this->params()),
            ]));
    }

    /** Kunci teks: due (tagihan baru), reminder, atau overdue. */
    protected function kind(): string
    {
        return 'due';
    }

    protected function params(): array
    {
        return [
            'number' => $this->order->number,
            'label' => $this->installment->labelText($this->locale),
            'amount' => self::money($this->installment->amountInt(), $this->installment->currencyCode()),
            'due' => self::dateTime($this->installment->due_at),
        ];
    }
}
