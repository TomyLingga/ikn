<?php

namespace App\Services\Payment;

use App\Exceptions\ApiException;
use App\Models\BankAccount;
use App\Models\Media;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\PaymentWebhookLog;
use App\Models\User;
use App\Services\Audit\AuditLogger;
use App\Services\Commerce\OrderStateMachine;
use App\Services\Commerce\UniqueCodeAllocator;
use App\Services\Media\MediaService;
use App\Services\Payment\Gateway\GatewayManager;
use App\Services\Payment\Gateway\WebhookResult;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Satu pintu siklus payment (state machine 7.2): buat percobaan bayar, bukti, accept/reject, ganti metode,
 * expiry, dan webhook gateway. Perubahan status order selalu lewat OrderStateMachine.
 */
class PaymentService
{
    public function __construct(
        private GatewayManager $gateways,
        private OrderStateMachine $stateMachine,
        private MediaService $media,
        private UniqueCodeAllocator $uniqueCodes,
        private AuditLogger $audit,
    ) {
    }

    /** Buat payment pending baru untuk order (instruksi/objek gateway lewat driver). Dipanggil di dalam transaksi. */
    public function create(Order $order, PaymentMethod $method, ?BankAccount $bank, ?User $by = null): Payment
    {
        $payment = new Payment();
        $payment->forceFill([
            'order_id' => $order->id,
            'payment_method_id' => $method->id,
            'method' => $method->code,
            'provider' => $method->driver,
            'amount' => $order->grandTotalInt(),
            'status' => Payment::STATUS_PENDING,
            'expires_at' => $order->payment_due_at,
            'bank_account_id' => $method->isManualTransfer() ? $bank?->id : null,
        ])->save();

        $payment->external_id = Payment::externalIdFor($order, $payment->id);
        $payment->setRelation('order', $order);
        $payment->setRelation('paymentMethod', $method);
        $payment->setRelation('bankAccount', $bank);
        $payment->payload = $this->gateways->for($method)->create($payment);
        $payment->save();

        $order->syncPaymentStatus();
        $order->save();

        return $payment;
    }

    /** Rekening tujuan transfer manual: yang dipilih (harus aktif) atau rekening aktif pertama. */
    public function resolveBankAccount(PaymentMethod $method, ?int $bankAccountId): ?BankAccount
    {
        if (! $method->isManualTransfer()) {
            return null;
        }
        if ($bankAccountId) {
            $bank = BankAccount::active()->find($bankAccountId);
            if (! $bank) {
                throw ValidationException::withMessages(['bankAccountId' => [__('commerce.bank_account_invalid')]]);
            }

            return $bank;
        }
        $bank = BankAccount::active()->orderBy('sort_order')->orderBy('id')->first();
        if (! $bank) {
            throw ValidationException::withMessages(['bankAccountId' => [__('commerce.bank_account_required')]]);
        }

        return $bank;
    }

    /** Metode bayar aktif berdasarkan kode (422 bila tidak ada). */
    public function resolveMethod(?string $code): PaymentMethod
    {
        $code = strtolower(trim((string) $code));
        if ($code === '') {
            throw ValidationException::withMessages(['paymentMethodCode' => [__('commerce.payment_method_required')]]);
        }
        $method = PaymentMethod::active()->where('code', $code)->first();
        if (! $method) {
            throw ValidationException::withMessages(['paymentMethodCode' => [__('commerce.payment_method_invalid')]]);
        }

        return $method;
    }

    // ---- Bukti bayar ----

    /**
     * Unggah bukti (disk private) lalu order pending_payment → payment_review.
     * Payment aktif harus pending (manual); bila yang aktif rejected/tidak ada → payment baru dengan metode & bank sama.
     *
     * @throws ApiException 409 ORDER_EXPIRED | 409 INVALID_TRANSITION
     */
    public function uploadProof(Order $order, UploadedFile $file, ?int $paymentId, User $user): Payment
    {
        $order->refresh();
        $this->assertProofAllowed($order);
        $payment = $this->resolveProofPayment($order, $paymentId, $user);

        $media = $this->media->upload(
            $file,
            'payment-proofs',
            Media::DISK_PRIVATE,
            $user,
            config('ikn.commerce.proof_mimes'),
            (int) config('ikn.commerce.proof_max_kb')
        );

        return $this->attachProof($order, $payment, $media, $user);
    }

    /** Tautkan media bukti (sudah tersimpan) ke payment dan pindahkan order ke payment_review. Dipakai uploadProof dan seeder. */
    public function attachProof(Order $order, Payment $payment, Media $media, User $user): Payment
    {
        return DB::transaction(function () use ($order, $payment, $media, $user) {
            $payment->forceFill([
                'proof_media_id' => $media->id,
                'proof_uploaded_at' => now(),
                'status' => Payment::STATUS_AWAITING_VERIFICATION,
                'reject_reason' => null,
            ])->save();

            $this->stateMachine->transition($order, Order::STATUS_PAYMENT_REVIEW, $user, ['paymentId' => $payment->id]);

            return $payment->fresh();
        });
    }

    /** Payment yang akan menerima bukti (pending manual), atau payment baru bila yang lama rejected/tidak ada. */
    public function resolveProofPayment(Order $order, ?int $paymentId, User $user): Payment
    {
        $payment = null;
        if ($paymentId !== null) {
            $payment = $order->payments()->find($paymentId);
            if (! $payment) {
                throw ValidationException::withMessages(['paymentId' => [__('commerce.payment_not_found')]]);
            }
        } else {
            $payment = $order->activePayment();
        }

        if ($payment && $payment->status === Payment::STATUS_AWAITING_VERIFICATION) {
            throw ApiException::conflict('PAYMENT_ALREADY_ACTIVE', __('commerce.payment_already_active'), ['paymentId' => $payment->id]);
        }

        if (! $payment || $payment->status !== Payment::STATUS_PENDING) {
            $base = $payment ?? $order->latestPayment();
            $method = $base?->paymentMethod;
            if (! $method) {
                throw ValidationException::withMessages(['paymentId' => [__('commerce.payment_method_required')]]);
            }
            if (! $method->isManual()) {
                throw ValidationException::withMessages(['paymentId' => [__('commerce.proof_not_allowed')]]);
            }

            return DB::transaction(fn () => $this->create($order, $method, $base->bankAccount, $user));
        }

        if (! $payment->isManual()) {
            throw ValidationException::withMessages(['paymentId' => [__('commerce.proof_not_allowed')]]);
        }

        return $payment;
    }

    private function assertProofAllowed(Order $order): void
    {
        if ($order->status === Order::STATUS_EXPIRED
            || ($order->status === Order::STATUS_PENDING_PAYMENT && $order->isPaymentDuePassed())) {
            throw ApiException::conflict('ORDER_EXPIRED', __('commerce.order_expired'), ['paymentDueAt' => optional($order->payment_due_at)->toApiString()]);
        }
        if ($order->status === Order::STATUS_PAYMENT_REVIEW) {
            // Bukti sebelumnya masih menunggu verifikasi admin.
            throw ApiException::conflict('PAYMENT_ALREADY_ACTIVE', __('commerce.payment_already_active'), ['paymentId' => $order->activePayment()?->id]);
        }
        if ($order->status !== Order::STATUS_PENDING_PAYMENT) {
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.invalid_transition', ['from' => $order->status, 'to' => Order::STATUS_PAYMENT_REVIEW]), [
                'from' => $order->status,
                'to' => Order::STATUS_PAYMENT_REVIEW,
            ]);
        }
    }

    // ---- Verifikasi admin ----

    /** awaiting_verification → paid; order payment_review → paid (commit stok, invoice, email). */
    public function accept(Payment $payment, User $admin): Payment
    {
        return DB::transaction(function () use ($payment, $admin) {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->first();
            $this->assertPaymentStatus($payment, Payment::STATUS_AWAITING_VERIFICATION, Payment::STATUS_PAID);

            $payment->forceFill([
                'status' => Payment::STATUS_PAID,
                'paid_at' => now(),
                'verified_by' => $admin->id,
                'verified_at' => now(),
            ])->save();

            $this->stateMachine->transition($payment->order, Order::STATUS_PAID, $admin, ['paymentId' => $payment->id]);

            return $payment->fresh();
        });
    }

    /** awaiting_verification → rejected (+alasan); order payment_review → pending_payment, batas waktu tetap. */
    public function reject(Payment $payment, User $admin, string $reason): Payment
    {
        return DB::transaction(function () use ($payment, $admin, $reason) {
            $payment = Payment::whereKey($payment->id)->lockForUpdate()->first();
            $this->assertPaymentStatus($payment, Payment::STATUS_AWAITING_VERIFICATION, Payment::STATUS_REJECTED);

            $payment->forceFill([
                'status' => Payment::STATUS_REJECTED,
                'reject_reason' => $reason,
                'verified_by' => $admin->id,
                'verified_at' => now(),
            ])->save();

            $this->stateMachine->transition($payment->order, Order::STATUS_PENDING_PAYMENT, $admin, [
                'paymentId' => $payment->id,
                'reason' => $reason,
            ]);

            return $payment->fresh();
        });
    }

    // ---- Ganti metode ----

    /**
     * Buat payment baru dengan metode lain. Payment manual `pending` (belum ada bukti) dibatalkan dan diganti;
     * `awaiting_verification` atau payment gateway yang masih pending → 409 PAYMENT_ALREADY_ACTIVE.
     * Kode unik dihitung ulang bila pindah ke/dari manual_transfer; grand_total order diperbarui.
     */
    public function switchMethod(Order $order, string $code, ?int $bankAccountId, User $user): Payment
    {
        $order->refresh();
        if ($order->status !== Order::STATUS_PENDING_PAYMENT) {
            if ($order->status === Order::STATUS_PAYMENT_REVIEW) {
                throw ApiException::conflict('PAYMENT_ALREADY_ACTIVE', __('commerce.payment_already_active'));
            }
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.invalid_transition', ['from' => $order->status, 'to' => Order::STATUS_PENDING_PAYMENT]), [
                'from' => $order->status,
                'to' => Order::STATUS_PENDING_PAYMENT,
            ]);
        }
        if ($order->isPaymentDuePassed()) {
            throw ApiException::conflict('ORDER_EXPIRED', __('commerce.order_expired'));
        }

        $method = $this->resolveMethod($code);
        $bank = $this->resolveBankAccount($method, $bankAccountId);

        return DB::transaction(function () use ($order, $method, $bank, $user) {
            $order = Order::whereKey($order->id)->lockForUpdate()->first();

            foreach ($order->payments()->whereIn('status', Payment::ACTIVE_STATUSES)->get() as $active) {
                if ($active->status !== Payment::STATUS_PENDING || ! $active->isManual()) {
                    throw ApiException::conflict('PAYMENT_ALREADY_ACTIVE', __('commerce.payment_already_active'), ['paymentId' => $active->id]);
                }
                $active->forceFill(['status' => Payment::STATUS_CANCELLED, 'reject_reason' => __('commerce.note.payment_superseded', [], $order->preferredLocale())])->save();
            }

            $base = $order->grandTotalBeforeUniqueCode();
            $uniqueCode = $this->uniqueCodes->requiredFor($method)
                ? $this->uniqueCodes->allocate($order->user_id.'|'.$order->number.'|'.$method->code, $order->id)
                : 0;
            $order->unique_code = $uniqueCode;
            $order->grand_total = $base + $uniqueCode;
            $order->save();

            return $this->create($order, $method, $bank, $user);
        });
    }

    // ---- Batas waktu & expiry ----

    /** Ubah batas waktu (hanya pending_payment/payment_review); expires_at payment aktif ikut. */
    public function updateDue(Order $order, Carbon $dueAt, User $admin): Order
    {
        if (! $order->isAwaitingPayment()) {
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.due_invalid_status'), ['from' => $order->status, 'to' => $order->status]);
        }
        if ($dueAt->lte(now())) {
            throw ValidationException::withMessages(['paymentDueAt' => [__('commerce.due_in_past')]]);
        }

        return DB::transaction(function () use ($order, $dueAt) {
            $order->payment_due_at = $dueAt;
            $order->reminder_sent_at = null; // pengingat dikirim ulang untuk batas waktu baru
            $order->save();
            Payment::where('order_id', $order->id)->whereIn('status', Payment::ACTIVE_STATUSES)->update([
                'expires_at' => $dueAt->copy()->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
            ]);

            return $order;
        });
    }

    /** pending_payment lewat batas waktu → expired (idempoten; dipanggil orders:expire). */
    public function expire(Order $order): Order
    {
        return $this->stateMachine->transition($order, Order::STATUS_EXPIRED, null, ['actorType' => OrderStatusHistory::ACTOR_SYSTEM]);
    }

    // ---- Webhook ----

    /**
     * Proses webhook provider: verifikasi (401), log mentah, idempoten by provider+external_id+event,
     * cocokkan payments.external_id, terapkan efek lewat OrderStateMachine (actor webhook).
     *
     * @param  array<string, string>  $headers  nama header lowercase → nilai
     */
    public function handleWebhook(string $provider, array $headers, array $payload): WebhookResult
    {
        $driver = $this->gateways->driver($provider);
        $provider = $driver->provider();
        $safeHeaders = $this->sanitizeHeaders($headers);

        try {
            $result = $driver->handleWebhook($headers, $payload);
        } catch (ApiException $e) {
            $this->log($provider, null, null, false, $safeHeaders, $payload, PaymentWebhookLog::RESULT_IGNORED, $e->errorCode, null);
            throw $e;
        }

        if ($result->externalId === null || $result->externalId === '') {
            $result->result = PaymentWebhookLog::RESULT_IGNORED;
            $result->note = 'missing external_id';
            $this->log($provider, $result->externalId, $result->event, true, $safeHeaders, $payload, $result->result, $result->note, null);

            return $result;
        }

        return DB::transaction(function () use ($provider, $result, $safeHeaders, $payload) {
            $already = PaymentWebhookLog::where('provider', $provider)
                ->where('external_id', $result->externalId)
                ->where('event', $result->event)
                ->where('result', PaymentWebhookLog::RESULT_PROCESSED)
                ->lockForUpdate()
                ->first();
            if ($already) {
                $result->result = PaymentWebhookLog::RESULT_DUPLICATE;
                $result->paymentId = $already->payment_id;
                $this->log($provider, $result->externalId, $result->event, true, $safeHeaders, $payload, $result->result, null, $already->payment_id);

                return $result;
            }

            $payment = Payment::where('provider', $provider)->where('external_id', $result->externalId)->lockForUpdate()->first();
            if (! $payment) {
                $result->result = PaymentWebhookLog::RESULT_IGNORED;
                $result->note = 'payment not found';
            } elseif ($result->status === null) {
                $result->result = PaymentWebhookLog::RESULT_IGNORED;
                $result->note = 'status not actionable';
                $result->paymentId = $payment->id;
            } else {
                $result->paymentId = $payment->id;
                try {
                    $this->applyWebhook($payment, $result);
                } catch (Throwable $e) {
                    Log::warning('webhook apply failed: '.$e->getMessage(), ['provider' => $provider, 'externalId' => $result->externalId]);
                    $result->result = PaymentWebhookLog::RESULT_ERROR;
                    $result->note = mb_substr($e->getMessage(), 0, 250);
                }
            }

            $this->log($provider, $result->externalId, $result->event, true, $safeHeaders, $payload, $result->result, $result->note, $result->paymentId);

            return $result;
        });
    }

    private function applyWebhook(Payment $payment, WebhookResult $result): void
    {
        $order = Order::whereKey($payment->order_id)->lockForUpdate()->first();
        $meta = ['actorType' => OrderStatusHistory::ACTOR_WEBHOOK, 'paymentId' => $payment->id, 'source' => 'gateway'];

        switch ($result->status) {
            case Payment::STATUS_PAID:
                // Jangan percaya nominal dari webhook tanpa mencocokkan payments.amount (arsitektur bagian 12).
                if ($result->amount !== null && $result->amount !== $payment->amountInt()) {
                    $result->result = PaymentWebhookLog::RESULT_IGNORED;
                    $result->note = sprintf('amount mismatch: %d vs %d', $result->amount, $payment->amountInt());

                    return;
                }
                if (! $payment->isActive()) {
                    $result->result = PaymentWebhookLog::RESULT_IGNORED;
                    $result->note = 'payment already '.$payment->status;

                    return;
                }
                $paidAt = $result->paidAt ? Carbon::parse($result->paidAt) : now();
                $payment->forceFill([
                    'status' => Payment::STATUS_PAID,
                    'paid_at' => $paidAt,
                    'verified_at' => now(),
                    'payload' => array_merge($payment->payload ?? [], ['webhook' => $result->raw]),
                ])->save();

                if ($order->status === Order::STATUS_PENDING_PAYMENT) {
                    $this->stateMachine->transition($order, Order::STATUS_PAYMENT_REVIEW, null, $meta);
                }
                if ($order->status === Order::STATUS_PAYMENT_REVIEW) {
                    $this->stateMachine->transition($order, Order::STATUS_PAID, null, $meta + ['paidAt' => $paidAt]);
                }
                $result->result = PaymentWebhookLog::RESULT_PROCESSED;
                break;

            case Payment::STATUS_EXPIRED:
            case Payment::STATUS_FAILED:
                if (! $payment->isActive()) {
                    $result->result = PaymentWebhookLog::RESULT_IGNORED;
                    $result->note = 'payment already '.$payment->status;

                    return;
                }
                $payment->forceFill([
                    'status' => $result->status,
                    'payload' => array_merge($payment->payload ?? [], ['webhook' => $result->raw]),
                ])->save();
                $order->syncPaymentStatus();
                $order->save();
                $this->audit->log(null, 'payment.'.$result->status.' [webhook]', $payment, null, ['externalId' => $result->externalId]);
                $result->result = PaymentWebhookLog::RESULT_PROCESSED;
                break;

            default:
                $result->result = PaymentWebhookLog::RESULT_IGNORED;
        }
    }

    private function log(string $provider, ?string $externalId, ?string $event, bool $valid, array $headers, array $payload, string $result, ?string $note, ?int $paymentId): PaymentWebhookLog
    {
        return PaymentWebhookLog::create([
            'provider' => $provider,
            'external_id' => $externalId !== null ? mb_substr($externalId, 0, 120) : null,
            'event' => $event !== null ? mb_substr($event, 0, 64) : null,
            'signature_valid' => $valid,
            'headers' => $headers,
            'payload' => $payload,
            'result' => $result,
            'note' => $note !== null ? mb_substr($note, 0, 255) : null,
            'payment_id' => $paymentId,
            'created_at' => now(),
        ]);
    }

    /** Header yang disimpan: tanpa cookie/authorization; token callback disamarkan. */
    private function sanitizeHeaders(array $headers): array
    {
        $out = [];
        foreach ($headers as $name => $value) {
            $name = strtolower((string) $name);
            if (in_array($name, ['cookie', 'authorization', 'x-xsrf-token'], true)) {
                continue;
            }
            $value = is_array($value) ? implode(', ', $value) : (string) $value;
            $out[$name] = $name === 'x-callback-token' ? '***' : mb_substr($value, 0, 512);
        }

        return $out;
    }

    private function assertPaymentStatus(Payment $payment, string $expected, string $to): void
    {
        if ($payment->status !== $expected) {
            throw ApiException::conflict('INVALID_TRANSITION', __('commerce.payment_invalid_status', ['status' => $payment->status]), [
                'from' => $payment->status,
                'to' => $to,
                'paymentId' => $payment->id,
            ]);
        }
    }
}
