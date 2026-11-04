<?php

namespace App\Services\Commerce;

use App\Exceptions\ApiException;
use App\Models\DeliveryTerm;
use App\Models\Order;
use App\Models\OrderProforma;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Satu pintu data proforma invoice (ASUMSI A-88). Simpan pertama = revisi 1 dengan issued_at sekarang dan nilai bawaan
 * dari order (pelabuhan muat dari term, pelabuhan bongkar dari pelabuhan tujuan bila ada, syarat bayar dari snapshot);
 * simpan berikutnya menaikkan revisi. Nomor "PI/{order}" tidak berubah. Customer diberi tahu setiap kali disimpan.
 */
class ProformaService
{
    public function __construct(private OrderNotifier $notifier)
    {
    }

    /**
     * @param  array  $data  vesselName, voyage, etd, eta, portOfLoading, portOfDischarge, paymentTerms, notes, validUntil (semua nullable)
     *
     * @throws ApiException 409 PROFORMA_NOT_ALLOWED bila order dibatalkan/kedaluwarsa
     */
    public function save(Order $order, array $data, User $actor): OrderProforma
    {
        if (! $order->canEditProforma()) {
            throw ApiException::conflict('PROFORMA_NOT_ALLOWED', __('commerce.proforma_not_allowed'), ['status' => $order->status]);
        }

        $proforma = DB::transaction(function () use ($order, $data, $actor) {
            $existing = OrderProforma::where('order_id', $order->id)->lockForUpdate()->first();
            $attributes = [
                'vessel_name' => $data['vesselName'] ?? null,
                'voyage' => $data['voyage'] ?? null,
                'etd' => $this->date($data['etd'] ?? null),
                'eta' => $this->date($data['eta'] ?? null),
                'port_of_loading' => $data['portOfLoading'] ?? null,
                'port_of_discharge' => $data['portOfDischarge'] ?? null,
                'payment_terms' => $data['paymentTerms'] ?? null,
                'notes' => $data['notes'] ?? null,
                'valid_until' => $this->date($data['validUntil'] ?? null),
                'updated_by' => $actor->id,
            ];

            if ($existing) {
                $existing->fill($attributes + ['revision' => $existing->revision + 1])->save();

                return $existing;
            }

            return OrderProforma::create(array_merge($attributes, $this->defaults($order, $attributes), [
                'order_id' => $order->id,
                'revision' => 1,
                'issued_at' => now(),
            ]));
        });

        $proforma->setRelation('order', $order);
        $this->notifier->proformaUpdated($order, $proforma);
        $order->unsetRelation('proforma');

        return $proforma;
    }

    /** Nilai bawaan revisi 1 hanya untuk field yang dikosongkan admin. */
    private function defaults(Order $order, array $attributes): array
    {
        $defaults = [];
        if (($attributes['port_of_loading'] ?? null) === null) {
            $defaults['port_of_loading'] = $this->loadingPort($order);
        }
        if (($attributes['port_of_discharge'] ?? null) === null) {
            $defaults['port_of_discharge'] = $this->destinationPort($order);
        }
        if (($attributes['payment_terms'] ?? null) === null) {
            $defaults['payment_terms'] = $this->paymentTermsText($order);
        }

        return array_filter($defaults, fn ($v) => $v !== null && $v !== '');
    }

    /** Pelabuhan muat dari snapshot alamat (dibekukan saat checkout) atau baris term bila snapshot lama. */
    private function loadingPort(Order $order): ?string
    {
        $fromSnapshot = $order->shipping_address_snapshot['loadingPort'] ?? null;
        if (is_string($fromSnapshot) && trim($fromSnapshot) !== '') {
            return trim($fromSnapshot);
        }
        $code = $order->delivery_term ?: ($order->shipping_snapshot['term'] ?? null);

        return $code ? DeliveryTerm::where('code', $code)->value('loading_port') : null;
    }

    /** Pelabuhan tujuan (orders.destination_port, Phase E5); kolom boleh belum ada, maka null. */
    private function destinationPort(Order $order): ?string
    {
        $raw = $order->getAttributes()['destination_port'] ?? null;
        if ($raw === null) {
            return null;
        }
        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : ['name' => $raw];
        }
        $name = is_array($raw) ? ($raw['name'] ?? null) : null;

        return is_string($name) && trim($name) !== '' ? trim($name) : null;
    }

    /** Syarat bayar untuk dokumen berbahasa Inggris: keterangan EN, lalu nama EN, lalu versi ID. */
    private function paymentTermsText(Order $order): ?string
    {
        $term = $order->paymentTerm();
        if (! $term) {
            return null;
        }
        foreach ([$term['description'], $term['name']] as $value) {
            foreach (['en', 'id'] as $locale) {
                $text = is_array($value) ? ($value[$locale] ?? null) : $value;
                if (is_string($text) && trim($text) !== '') {
                    return trim($text);
                }
            }
        }

        return null;
    }

    private function date(?string $value): ?Carbon
    {
        return $value ? Carbon::parse($value, config('app.timezone'))->startOfDay() : null;
    }
}
