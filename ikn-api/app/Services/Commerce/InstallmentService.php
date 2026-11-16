<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\BankAccount;
use App\Models\Order;
use App\Models\OrderInstallment;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Payment\PaymentService;
use App\Support\Money;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Satu pintu termin pembayaran order (ASUMSI A-97).
 *
 * - Jadwal dibekukan dari syarat pembayaran saat total order final (createForOrder: checkout atau penawaran ongkir CIF
 *   disepakati). Hanya order non-IDR (pasar ekspor); order rupiah tetap satu pembayaran penuh.
 * - Termin pertama mengikuti alur order yang sudah ada (pending_payment → payment_review → paid): statusnya disalin
 *   oleh onTransition() yang dipanggil OrderStateMachine di dalam transaksi transisi.
 * - Termin berikutnya ditagih saat order mencapai pemicunya (paid/shipped/delivered) atau lebih awal oleh admin
 *   (bill). Payment-nya dibuat lewat PaymentService::create; bukti dan verifikasinya tidak mengubah status order.
 * - Order tidak boleh completed selama masih ada termin belum lunas (assertSettled, 409 INSTALLMENTS_UNPAID).
 * - Setiap perubahan status termin mengunci baris order lalu baris termin (FOR UPDATE) agar dua permintaan bersamaan
 *   tidak menagih dua kali.
 *
 * PaymentService bergantung pada OrderStateMachine yang bergantung pada kelas ini, jadi PaymentService diambil dari
 * container saat dipakai (bukan lewat constructor) untuk menghindari ketergantungan melingkar.
 */
class InstallmentService
{
    public function __construct(
        private OrderNotifier $notifier,
        private CommerceSettings $settings,
        private AuditLogger $audit,
    ) {
    }

    // ---- Pembuatan jadwal ----

    /**
     * Buat baris termin dari snapshot syarat pembayaran order. Dipanggil di dalam transaksi pembuat order, setelah
     * grand_total dan payment_due_at final dan SEBELUM payment pertama dibuat. Idempoten: order yang sudah punya
     * termin, syarat tanpa jadwal, atau order rupiah → tidak membuat apa pun.
     *
     * @return Collection<int, OrderInstallment>
     */
    public function createForOrder(Order $order, ?Carbon $now = null): Collection
    {
        $rows = InstallmentSchedule::normalize($order->payment_term_snapshot['installments'] ?? null);
        if ($rows === null || InstallmentSchedule::violations($rows) !== [] || Money::isIdr($order->currencyCode())) {
            return collect();
        }
        if (OrderInstallment::where('order_id', $order->id)->exists()) {
            return collect();
        }

        $now = $now ?? now();
        $currency = $order->currencyCode();
        $amounts = InstallmentSchedule::amounts($order->grandTotalInt(), $rows);
        $created = collect();
        foreach ($rows as $i => $row) {
            $first = $i === 0;
            $created->push(OrderInstallment::create([
                'order_id' => $order->id,
                'seq' => $i + 1,
                'key' => $row['key'],
                'label' => $row['label'],
                'percent' => $row['percent'],
                'amount' => Money::fromMinor($amounts[$i], $currency),
                'currency' => $currency,
                'trigger' => $row['trigger'],
                'due_days' => $row['dueDays'],
                // Termin pertama langsung ditagih dan memakai batas bayar order (yang bisa membatalkan order).
                'status' => $first ? OrderInstallment::STATUS_DUE : OrderInstallment::STATUS_SCHEDULED,
                'due_at' => $first ? $order->payment_due_at : null,
                'billed_at' => $first ? $now : null,
            ]));
        }
        if ($order->relationLoaded('installments')) {
            $order->unsetRelation('installments');
        }

        return $created;
    }

    /** Termin yang dibayar payment baru bila pemanggil tidak menyebutnya: termin pertama yang belum lunas. */
    public function defaultFor(Order $order): ?OrderInstallment
    {
        return OrderInstallment::where('order_id', $order->id)->where('seq', 1)
            ->whereIn('status', [OrderInstallment::STATUS_DUE, OrderInstallment::STATUS_AWAITING_VERIFICATION])
            ->first();
    }

    // ---- Kait OrderStateMachine ----

    /**
     * Order tidak boleh selesai selama ada termin belum lunas. Dipanggil di dalam transaksi transisi (order terkunci).
     *
     * @throws ApiException 409 INSTALLMENTS_UNPAID
     */
    public function assertSettled(Order $order): void
    {
        $open = OrderInstallment::where('order_id', $order->id)->whereIn('status', OrderInstallment::OPEN_STATUSES)->orderBy('seq')->get();
        if ($open->isEmpty()) {
            return;
        }

        throw ApiException::conflict('INSTALLMENTS_UNPAID', __('commerce.installments.unpaid'), [
            'currency' => $order->currencyCode(),
            'outstandingTotal' => (int) $open->sum(fn (OrderInstallment $row) => $row->amountInt()),
            'installmentIds' => $open->pluck('id')->all(),
        ]);
    }

    /**
     * Efek transisi order pada termin, di dalam transaksi transisi setelah status order disimpan:
     * payment_review/pending_payment/paid menyalin status termin pertama; paid/shipped/delivered menagih termin yang
     * pemicunya tercapai; expired/cancelled membatalkan (void) termin yang belum lunas.
     *
     * @return OrderInstallment[] termin yang baru ditagih (pemanggil mengirim notifikasi setelah transaksi selesai)
     */
    public function onTransition(Order $order, ?string $from, string $to, ?User $actor, ?Carbon $now = null): array
    {
        $rows = OrderInstallment::where('order_id', $order->id)->orderBy('seq')->lockForUpdate()->get();
        if ($rows->isEmpty()) {
            return [];
        }
        $now = $now ?? now();
        /** @var OrderInstallment|null $first */
        $first = $rows->firstWhere('seq', 1);
        $billed = [];

        switch ($to) {
            case Order::STATUS_PAYMENT_REVIEW:
                if ($first && $first->status === OrderInstallment::STATUS_DUE) {
                    $first->forceFill(['status' => OrderInstallment::STATUS_AWAITING_VERIFICATION])->save();
                }
                break;

            case Order::STATUS_PENDING_PAYMENT:
                // Bukti termin pertama ditolak: kembali menunggu pembayaran.
                if ($from === Order::STATUS_PAYMENT_REVIEW && $first && $first->status === OrderInstallment::STATUS_AWAITING_VERIFICATION) {
                    $first->forceFill(['status' => OrderInstallment::STATUS_DUE])->save();
                }
                break;

            case Order::STATUS_PAID:
                if ($first && $first->isOpen()) {
                    $first->forceFill(['status' => OrderInstallment::STATUS_PAID, 'paid_at' => $order->paid_at ?? $now])->save();
                }
                $billed = $this->billTriggered($order, $rows, [InstallmentSchedule::TRIGGER_ORDER], $actor, $now);
                break;

            case Order::STATUS_SHIPPED:
                $billed = $this->billTriggered($order, $rows, [InstallmentSchedule::TRIGGER_ORDER, InstallmentSchedule::TRIGGER_SHIPPED], $actor, $now);
                break;

            case Order::STATUS_DELIVERED:
                $billed = $this->billTriggered($order, $rows, InstallmentSchedule::TRIGGERS, $actor, $now);
                break;

            case Order::STATUS_EXPIRED:
            case Order::STATUS_CANCELLED:
                foreach ($rows as $row) {
                    if ($row->isOpen()) {
                        $row->forceFill(['status' => OrderInstallment::STATUS_VOID])->save();
                    }
                }
                break;
        }
        if ($order->relationLoaded('installments')) {
            $order->unsetRelation('installments');
        }

        return $billed;
    }

    /**
     * @param  Collection<int, OrderInstallment>  $rows  baris termin order (sudah dikunci)
     * @param  string[]  $triggers
     * @return OrderInstallment[]
     */
    private function billTriggered(Order $order, Collection $rows, array $triggers, ?User $actor, Carbon $now): array
    {
        $billed = [];
        foreach ($rows as $row) {
            if ($row->isFirst() || $row->status !== OrderInstallment::STATUS_SCHEDULED || ! in_array($row->trigger, $triggers, true)) {
                continue;
            }
            $this->billRow($order, $row, $now->copy()->addDays((int) $row->due_days), $actor, $now);
            $billed[] = $row;
        }

        return $billed;
    }

    /** scheduled → due + payment pending baru untuk termin itu. Pemanggil sudah mengunci order dan baris termin. */
    private function billRow(Order $order, OrderInstallment $row, Carbon $dueAt, ?User $actor, Carbon $now): Payment
    {
        $row->forceFill([
            'status' => OrderInstallment::STATUS_DUE,
            'due_at' => $dueAt,
            'billed_at' => $now,
            'reminded_at' => null,
        ])->save();
        [$method, $bank] = $this->paymentChannel($order);

        return app(PaymentService::class)->create($order, $method, $bank, $actor, $row);
    }

    /**
     * Metode + rekening untuk payment termin lanjutan: sama dengan payment terakhir order bila masih aktif; bila sudah
     * dinonaktifkan admin, metode transfer manual aktif pertama dan rekening aktif pertama se-mata-uang; bila itu pun
     * tidak ada, tetap memakai metode/rekening payment terakhir agar transisi order (dikirim/diterima) tidak tertahan.
     *
     * @return array{0: PaymentMethod, 1: BankAccount|null}
     */
    private function paymentChannel(Order $order): array
    {
        $currency = $order->currencyCode();
        $last = Payment::with(['paymentMethod', 'bankAccount'])->where('order_id', $order->id)
            ->orderByRaw("CASE status WHEN 'paid' THEN 0 ELSE 1 END")->orderByDesc('id')->first();
        $payments = app(PaymentService::class);

        $method = null;
        try {
            $method = $payments->resolveMethod($last?->method, $currency);
        } catch (ValidationException $e) {
            $method = PaymentMethod::active()->where('type', PaymentMethod::TYPE_MANUAL_TRANSFER)->orderBy('sort_order')->orderBy('id')->first();
        }
        $method = $method ?? $last?->paymentMethod;
        if (! $method) {
            throw ApiException::conflict('INSTALLMENT_NOT_BILLABLE', __('commerce.installments.payment_unavailable'), ['missing' => 'paymentMethod']);
        }

        $bank = null;
        try {
            $bank = $payments->resolveBankAccount($method, $last?->bank_account_id, $currency);
        } catch (ValidationException $e) {
            try {
                $bank = $payments->resolveBankAccount($method, null, $currency);
            } catch (ValidationException $e) {
                $bank = $method->isManualTransfer() ? $last?->bankAccount : null;
            }
        }

        return [$method, $bank];
    }

    // ---- Aksi admin ----

    /**
     * Tagih termin lebih awal (scheduled → due, payment dibuat, customer diberi tahu) atau ubah tanggal jatuh tempo
     * termin yang sudah ditagih. Termin pertama tidak lewat sini: batas bayarnya = batas bayar order (PUT .../due).
     *
     * @throws ApiException 404 termin bukan milik order | 409 INSTALLMENT_NOT_BILLABLE | 409 INSTALLMENT_ALREADY_BILLED
     * @throws ValidationException 422 dueAt di masa lalu
     */
    public function bill(Order $order, OrderInstallment $installment, ?Carbon $dueAt, User $admin): OrderInstallment
    {
        $result = DB::transaction(function () use ($order, $installment, $dueAt, $admin) {
            $locked = $this->lockOrder($order);
            $row = $this->lockRow($locked, $installment);
            $now = now();
            if ($dueAt !== null && $dueAt->lte($now)) {
                throw ValidationException::withMessages(['dueAt' => [__('commerce.installments.due_in_past')]]);
            }
            if ($row->isFirst() || ! in_array($locked->status, [Order::STATUS_PAID, Order::STATUS_PROCESSING, Order::STATUS_SHIPPED, Order::STATUS_DELIVERED], true)) {
                throw $this->notBillable($locked, $row);
            }

            if ($row->status === OrderInstallment::STATUS_SCHEDULED) {
                $this->billRow($locked, $row, $dueAt ?? $now->copy()->addDays((int) $row->due_days), $admin, $now);
                $this->audit->log($admin, 'installment.billed', $row, ['status' => OrderInstallment::STATUS_SCHEDULED], [
                    'status' => OrderInstallment::STATUS_DUE, 'dueAt' => optional($row->due_at)->toApiString(), 'orderId' => $locked->id,
                ]);

                return ['row' => $row, 'billed' => true];
            }
            if ($row->status === OrderInstallment::STATUS_DUE) {
                if ($dueAt === null) {
                    throw ApiException::conflict('INSTALLMENT_ALREADY_BILLED', __('commerce.installments.already_billed'), [
                        'installmentId' => $row->id, 'status' => $row->status, 'dueAt' => optional($row->due_at)->toApiString(),
                    ]);
                }
                $before = optional($row->due_at)->toApiString();
                // Tanggal baru: pengingat otomatis dihitung ulang terhadap jatuh tempo yang baru.
                $row->forceFill(['due_at' => $dueAt, 'reminded_at' => null])->save();
                Payment::where('installment_id', $row->id)->whereIn('status', Payment::ACTIVE_STATUSES)->update([
                    'expires_at' => $this->dbTime($dueAt),
                    'updated_at' => $this->dbTime($now),
                ]);
                $this->audit->log($admin, 'installment.due_changed', $row, ['dueAt' => $before], ['dueAt' => $dueAt->toApiString(), 'orderId' => $locked->id]);

                return ['row' => $row, 'billed' => false];
            }

            throw $this->notBillable($locked, $row);
        });

        /** @var OrderInstallment $row */
        $row = $result['row'];
        $order->refresh();
        if ($result['billed']) {
            $this->notifier->installmentDue($order, $row);
        } else {
            $this->notifier->installmentDueChanged($order, $row);
        }

        return $row;
    }

    /**
     * Kirim pengingat pembayaran termin yang sedang ditagih. Dibatasi sekali per `installment_reminder_cooldown_hours`
     * (bawaan 12 jam, dihitung dari pengingat terakhir, manual maupun otomatis).
     *
     * @throws ApiException 404 | 409 INSTALLMENT_NOT_DUE | 409 INSTALLMENT_REMINDER_TOO_SOON meta { retryAt }
     */
    public function remind(Order $order, OrderInstallment $installment, User $admin): OrderInstallment
    {
        $row = DB::transaction(function () use ($order, $installment, $admin) {
            $locked = $this->lockOrder($order);
            $row = $this->lockRow($locked, $installment);
            $now = now();
            if ($row->status !== OrderInstallment::STATUS_DUE) {
                throw $this->notDue($row);
            }
            $cooldown = max(0, (int) config('ikn.commerce.installment_reminder_cooldown_hours', 12));
            if ($cooldown > 0 && $row->reminded_at !== null && $row->reminded_at->gt($now->copy()->subHours($cooldown))) {
                throw ApiException::conflict('INSTALLMENT_REMINDER_TOO_SOON', __('commerce.installments.reminder_too_soon', ['hours' => $cooldown]), [
                    'installmentId' => $row->id,
                    'remindedAt' => $row->reminded_at->toApiString(),
                    'retryAt' => $row->reminded_at->copy()->addHours($cooldown)->toApiString(),
                ]);
            }
            $row->forceFill(['reminded_at' => $now, 'reminder_count' => (int) $row->reminder_count + 1])->save();
            $this->audit->log($admin, 'installment.reminded', $row, null, ['reminderCount' => (int) $row->reminder_count, 'orderId' => $locked->id]);

            return $row;
        });

        $order->refresh();
        $this->notifier->installmentReminder($order, $row, $row->isOverdue());

        return $row;
    }

    // ---- Scheduler (orders:installment-remind) ----

    /**
     * Pengingat otomatis termin lanjutan yang sedang ditagih (termin pertama diurus orders:remind):
     * - sekali saat jatuh tempo tinggal `installment_remind_before_days` hari atau kurang;
     * - selama terlambat, tiap `installment_remind_overdue_days` hari sejak pengingat terakhir.
     * Idempoten: baris ditandai dengan UPDATE bersyarat sebelum notifikasi dikirim, jadi menjalankan ulang (atau dua
     * proses sekaligus) tidak mengirim dua kali. Setting 0 mematikan jenis pengingatnya.
     *
     * @return array{before:int, overdue:int}
     */
    public function sendDueReminders(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $beforeDays = (int) $this->settings->get('installment_remind_before_days');
        $overdueDays = (int) $this->settings->get('installment_remind_overdue_days');
        $sent = ['before' => 0, 'overdue' => 0];

        $query = OrderInstallment::where('status', OrderInstallment::STATUS_DUE)->where('seq', '>', 1)->whereNotNull('due_at')->orderBy('id');
        foreach ($query->cursor() as $row) {
            $kind = $this->reminderKind($row, $now, $beforeDays, $overdueDays);
            if ($kind === null) {
                continue;
            }
            $order = Order::find($row->order_id);
            if (! $order || ! in_array($order->status, Order::PAID_STATUSES, true)) {
                continue;
            }
            // Tandai dulu secara atomik: hanya proses yang melihat reminded_at yang sama boleh mengirim.
            $marked = DB::table('order_installments')->where('id', $row->id)->where('status', OrderInstallment::STATUS_DUE)
                ->when($row->reminded_at === null, fn ($q) => $q->whereNull('reminded_at'), fn ($q) => $q->where('reminded_at', $this->dbTime($row->reminded_at)))
                ->update(['reminded_at' => $this->dbTime($now), 'reminder_count' => DB::raw('reminder_count + 1'), 'updated_at' => $this->dbTime($now)]);
            if ($marked === 0) {
                continue;
            }
            try {
                $this->notifier->installmentReminder($order, $row->fresh(), $kind === 'overdue');
            } catch (Throwable $e) {
                continue;
            }
            $sent[$kind]++;
        }

        return $sent;
    }

    /** @return 'before'|'overdue'|null */
    private function reminderKind(OrderInstallment $row, Carbon $now, int $beforeDays, int $overdueDays): ?string
    {
        $due = $row->due_at;
        $last = $row->reminded_at;
        if ($due->lte($now)) {
            if ($overdueDays <= 0) {
                return null;
            }

            return $last === null || $last->lte($now->copy()->subDays($overdueDays)) ? 'overdue' : null;
        }
        if ($beforeDays <= 0) {
            return null;
        }
        $windowStart = $due->copy()->subDays($beforeDays);

        // Sekali per jendela: pengingat yang dikirim sebelum jendela dibuka (mis. manual oleh admin) tidak dihitung.
        return $now->gte($windowStart) && ($last === null || $last->lt($windowStart)) ? 'before' : null;
    }

    // ---- Bukti dan verifikasi termin lanjutan (dipanggil PaymentService) ----

    /**
     * Termin lanjutan yang dituju unggahan bukti, atau null bila unggahan mengikuti alur order (order tanpa termin atau
     * termin pertama). Urutan: installmentId → termin milik paymentId → termin lanjutan pertama yang sedang ditagih.
     *
     * @throws ValidationException 422 installmentId bukan milik order
     */
    public function proofTarget(Order $order, ?int $paymentId, ?int $installmentId): ?OrderInstallment
    {
        $rows = OrderInstallment::where('order_id', $order->id)->orderBy('seq')->get();
        if ($rows->isEmpty()) {
            if ($installmentId !== null) {
                throw ValidationException::withMessages(['installmentId' => [__('commerce.installments.not_found')]]);
            }

            return null;
        }
        if ($installmentId !== null) {
            $row = $rows->firstWhere('id', $installmentId);
            if (! $row) {
                throw ValidationException::withMessages(['installmentId' => [__('commerce.installments.not_found')]]);
            }

            return $row->isFirst() ? null : $row;
        }
        if ($paymentId !== null) {
            $payment = Payment::where('order_id', $order->id)->find($paymentId);
            $row = $payment && $payment->installment_id ? $rows->firstWhere('id', $payment->installment_id) : null;

            return $row && ! $row->isFirst() ? $row : null;
        }
        if (! in_array($order->status, Order::PAID_STATUSES, true)) {
            return null;
        }

        return $rows->first(fn (OrderInstallment $row) => ! $row->isFirst() && $row->status === OrderInstallment::STATUS_DUE)
            ?? $rows->first(fn (OrderInstallment $row) => ! $row->isFirst() && $row->status === OrderInstallment::STATUS_AWAITING_VERIFICATION);
    }

    /**
     * Kunci order + termin dan pastikan termin lanjutan boleh menerima bukti: order sudah dibayar (termin pertama
     * lunas) dan termin sedang ditagih. Termin terlambat tetap boleh dibayar.
     *
     * @throws ApiException 409 PAYMENT_ALREADY_ACTIVE | 409 INSTALLMENT_NOT_DUE
     */
    public function lockForProof(Order $order, OrderInstallment $installment): OrderInstallment
    {
        $locked = $this->lockOrder($order);
        $row = $this->lockRow($locked, $installment);
        if ($row->status === OrderInstallment::STATUS_AWAITING_VERIFICATION) {
            throw ApiException::conflict('PAYMENT_ALREADY_ACTIVE', __('commerce.payment_already_active'), ['installmentId' => $row->id]);
        }
        if ($row->status !== OrderInstallment::STATUS_DUE || ! in_array($locked->status, Order::PAID_STATUSES, true)) {
            throw $this->notDue($row);
        }

        return $row;
    }

    /** Bukti termin lanjutan diunggah: due → awaiting_verification (di dalam transaksi PaymentService). */
    public function markAwaitingVerification(OrderInstallment $row): void
    {
        $row->forceFill(['status' => OrderInstallment::STATUS_AWAITING_VERIFICATION])->save();
    }

    /** Bukti termin lanjutan ditolak: kembali due, tanggal jatuh tempo tidak berubah. */
    public function markRejected(OrderInstallment $row): void
    {
        if ($row->status === OrderInstallment::STATUS_AWAITING_VERIFICATION) {
            $row->forceFill(['status' => OrderInstallment::STATUS_DUE])->save();
        }
    }

    /** Termin lanjutan lunas. @return bool true bila setelah ini semua termin order lunas */
    public function markPaid(OrderInstallment $row, ?Carbon $paidAt = null): bool
    {
        $row->forceFill(['status' => OrderInstallment::STATUS_PAID, 'paid_at' => $paidAt ?? now()])->save();

        return ! OrderInstallment::where('order_id', $row->order_id)->whereIn('status', OrderInstallment::OPEN_STATUSES)->exists();
    }

    /** Batas bayar order berubah (admin memperpanjang, atau masa tenggang setelah bukti ditolak): termin pertama ikut. */
    public function syncFirstDue(Order $order): void
    {
        OrderInstallment::where('order_id', $order->id)->where('seq', 1)
            ->whereIn('status', [OrderInstallment::STATUS_DUE, OrderInstallment::STATUS_AWAITING_VERIFICATION])
            ->update([
                'due_at' => $order->payment_due_at ? $this->dbTime($order->payment_due_at) : null,
                'updated_at' => $this->dbTime(now()),
            ]);
        if ($order->relationLoaded('installments')) {
            $order->unsetRelation('installments');
        }
    }

    // ---- Ringkasan dashboard ----

    /**
     * Sisa tagihan termin per mata uang dari order yang sudah dibayar sebagian dan masih berjalan.
     *
     * @return array<int, array{currency:string, total:int, count:int, overdue:int}>
     */
    public function outstandingByCurrency(?Carbon $now = null): array
    {
        $now = $now ?? now();
        $rows = OrderInstallment::query()
            ->join('orders', 'orders.id', '=', 'order_installments.order_id')
            ->whereIn('order_installments.status', OrderInstallment::OPEN_STATUSES)
            ->whereIn('orders.status', Order::PAID_STATUSES)
            ->get(['order_installments.id', 'order_installments.amount', 'order_installments.currency', 'order_installments.status', 'order_installments.due_at']);

        $out = [];
        foreach ($rows->groupBy(fn (OrderInstallment $row) => $row->currencyCode()) as $currency => $group) {
            $out[] = [
                'currency' => $currency,
                'total' => (int) $group->sum(fn (OrderInstallment $row) => $row->amountInt()),
                'count' => $group->count(),
                'overdue' => $group->filter(fn (OrderInstallment $row) => $row->isOverdue($now))->count(),
            ];
        }
        usort($out, fn ($a, $b) => strcmp($a['currency'], $b['currency']));

        return $out;
    }

    /** Termin lanjutan yang sedang ditagih (termasuk terlambat) pada order yang masih berjalan: antrean kerja admin. */
    public function dueCount(): int
    {
        return OrderInstallment::query()
            ->join('orders', 'orders.id', '=', 'order_installments.order_id')
            ->where('order_installments.status', OrderInstallment::STATUS_DUE)
            ->where('order_installments.seq', '>', 1)
            ->whereIn('orders.status', Order::PAID_STATUSES)
            ->count();
    }

    // ---- helper ----

    private function lockOrder(Order $order): Order
    {
        $locked = Order::whereKey($order->id)->lockForUpdate()->first();
        if (! $locked) {
            throw ApiException::notFound();
        }

        return $locked;
    }

    private function lockRow(Order $order, OrderInstallment $installment): OrderInstallment
    {
        $row = OrderInstallment::whereKey($installment->id)->lockForUpdate()->first();
        if (! $row || (int) $row->order_id !== (int) $order->id) {
            throw ApiException::notFound();
        }

        return $row;
    }

    private function notBillable(Order $order, OrderInstallment $row): ApiException
    {
        return ApiException::conflict('INSTALLMENT_NOT_BILLABLE', __('commerce.installments.not_billable'), [
            'installmentId' => $row->id, 'status' => $row->status, 'orderStatus' => $order->status,
        ]);
    }

    private function notDue(OrderInstallment $row): ApiException
    {
        return ApiException::conflict('INSTALLMENT_NOT_DUE', __('commerce.installments.not_due'), ['installmentId' => $row->id, 'status' => $row->status]);
    }

    private function dbTime(Carbon $time): string
    {
        return $time->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s');
    }
}
