<?php

namespace App\Mail\Commerce;

use App\Models\Order;
use App\Models\OrderInstallment;
use App\Models\Payment;

// Ke customer: pengingat termin yang sedang ditagih (ASUMSI A-97), sebelum jatuh tempo atau saat sudah terlambat.
// Dikirim orders:installment-remind dan tombol "Kirim pengingat" admin.
class InstallmentReminder extends InstallmentDue
{
    public bool $overdue;

    public function __construct(Order $order, OrderInstallment $installment, bool $overdue = false, ?Payment $payment = null)
    {
        parent::__construct($order, $installment, $payment);
        $this->overdue = $overdue;
    }

    protected function kind(): string
    {
        return $this->overdue ? 'overdue' : 'reminder';
    }
}
