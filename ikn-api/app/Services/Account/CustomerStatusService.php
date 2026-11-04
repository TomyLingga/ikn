<?php

namespace App\Services\Account;

use App\Mail\Account\AccountApproved;
use App\Mail\Account\AccountRejected;
use App\Models\User;
use App\Services\Notification\InAppNotifier;
use Illuminate\Support\Facades\Mail;

// Transisi status customer oleh admin (kontrak 11.4). Semua transisi diizinkan kecuali kembali ke pending
// (dibatasi Form Request). Email hanya untuk approve (masuk active dari pending/rejected) dan reject.
// Saat menyetujui, admin boleh sekaligus mengunci pasar (ASUMSI A-86) lewat CustomerMarketService.
class CustomerStatusService
{
    public const TARGET_STATUSES = [User::STATUS_ACTIVE, User::STATUS_REJECTED, User::STATUS_INACTIVE];

    public function __construct(private InAppNotifier $inApp, private CustomerMarketService $markets)
    {
    }

    public function transition(User $customer, string $status, ?string $reason, User $admin, ?string $market = null): User
    {
        $from = $customer->status;

        switch ($status) {
            case User::STATUS_ACTIVE:
                $customer->rejection_reason = null;
                if ($from !== User::STATUS_ACTIVE) {
                    $customer->approved_at = now();
                    $customer->approved_by = $admin->id;
                }
                if ($market !== null) {
                    // 409 CUSTOMER_HAS_OPEN_ORDERS bila pasar berubah padahal masih ada order berjalan (sebelum status disimpan).
                    $this->markets->change($customer, $market);
                }
                break;
            case User::STATUS_REJECTED:
                $customer->rejection_reason = $reason;
                break;
            case User::STATUS_INACTIVE:
                // Nonaktif sementara: approved_at dipertahankan, tanpa email.
                break;
        }

        $customer->status = $status;
        $customer->save();

        if ($status === User::STATUS_ACTIVE && in_array($from, [User::STATUS_PENDING, User::STATUS_REJECTED], true)) {
            $customer->loadMissing('profile');
            Mail::to($customer)->send(new AccountApproved($customer));
            $this->inApp->notify($customer, 'account.approved', [], '/dashboard/katalog');
        }

        if ($status === User::STATUS_REJECTED && $from !== User::STATUS_REJECTED) {
            Mail::to($customer)->send(new AccountRejected($customer, $reason));
            $this->inApp->notify($customer, 'account.rejected', ['reason' => $reason ?: '-'], '/dashboard/perusahaan');
        }

        return $customer;
    }
}
