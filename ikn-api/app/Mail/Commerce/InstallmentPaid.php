<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderInstallment;

// Ke customer saat pembayaran termin lanjutan diverifikasi (ASUMSI A-97); $fullyPaid = semua termin order sudah lunas.
class InstallmentPaid extends OrderMailable
{
    public OrderInstallment $installment;

    public bool $fullyPaid;

    public function __construct(Order $order, OrderInstallment $installment, bool $fullyPaid = false)
    {
        parent::__construct($order);
        $this->installment = $installment;
        $this->fullyPaid = $fullyPaid;
    }

    public function build(): self
    {
        $key = 'commerce.mail.installment.'.($this->fullyPaid ? 'fully_paid' : 'paid');
        $progress = $this->order->paymentProgress();
        $params = [
            'number' => $this->order->number,
            'label' => $this->installment->labelText($this->locale),
            'amount' => self::money($this->installment->amountInt(), $this->installment->currencyCode()),
            'outstanding' => self::money($progress['outstandingTotal'], $progress['currency']),
        ];

        return $this->subject($this->trans($key.'.subject', $params))
            ->view('mail.commerce.installment-paid', $this->baseData([
                'installment' => $this->installment,
                'subjectLine' => $this->trans($key.'.subject', $params),
                'intro' => $this->trans($key.'.intro', $params),
            ]));
    }
}
