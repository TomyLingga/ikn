<?php

namespace App\Models;

/**
 * Data proforma invoice per order (ASUMSI A-88): dibuat aplikasi, diedit admin (kapal, voyage, ETD/ETA, pelabuhan,
 * syarat bayar, catatan, masa berlaku). Nomor tetap "PI/{nomor order}" dengan tanda revisi; setiap simpan menaikkan
 * revisi. Satu baris per order. Cetakan dirender FE dari OrderResource (proforma + data order).
 */
class OrderProforma extends Model
{
    protected $fillable = [
        'order_id', 'revision', 'vessel_name', 'voyage', 'etd', 'eta', 'port_of_loading', 'port_of_discharge',
        'payment_terms', 'notes', 'valid_until', 'issued_at', 'updated_by',
    ];

    protected $casts = [
        'revision' => 'integer',
        'etd' => 'date',
        'eta' => 'date',
        'valid_until' => 'date',
        'issued_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'updated_by')->withTrashed();
    }

    /** Nomor proforma: PI/{nomor order}; tetap sama di semua revisi. */
    public function number(): string
    {
        $order = $this->relationLoaded('order') ? $this->order : $this->order()->first();

        return 'PI/'.($order?->number ?? $this->order_id);
    }

    /** Nomor + tanda revisi ("PI/IKN-20261103-00001 Rev.2"); revisi 1 tanpa tanda. */
    public function label(): string
    {
        return $this->number().($this->revision > 1 ? ' Rev.'.$this->revision : '');
    }

    public function toSummary(): array
    {
        $editor = $this->relationLoaded('editor') ? $this->editor : null;

        return [
            'number' => $this->number(),
            'label' => $this->label(),
            'revision' => (int) $this->revision,
            'vesselName' => $this->vessel_name,
            'voyage' => $this->voyage,
            'etd' => optional($this->etd)->toDateString(),
            'eta' => optional($this->eta)->toDateString(),
            'portOfLoading' => $this->port_of_loading,
            'portOfDischarge' => $this->port_of_discharge,
            'paymentTerms' => $this->payment_terms,
            'notes' => $this->notes,
            'validUntil' => optional($this->valid_until)->toDateString(),
            'issuedAt' => optional($this->issued_at)->toApiString(),
            'updatedAt' => optional($this->updated_at)->toApiString(),
            'updatedBy' => $editor ? ['id' => $editor->id, 'name' => $editor->name] : null,
        ];
    }
}
