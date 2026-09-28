<?php

namespace App\Models;

// Log webhook gateway mentah; idempotensi provider+external_id+event (result duplicate = tanpa efek).
class PaymentWebhookLog extends Model
{
    public const RESULT_PROCESSED = 'processed';
    public const RESULT_DUPLICATE = 'duplicate';
    public const RESULT_IGNORED = 'ignored';
    public const RESULT_ERROR = 'error';
    public const RESULTS = [self::RESULT_PROCESSED, self::RESULT_DUPLICATE, self::RESULT_IGNORED, self::RESULT_ERROR];

    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['headers' => 'array', 'payload' => 'array', 'signature_valid' => 'boolean', 'created_at' => 'datetime'];

    public function payment()
    {
        return $this->belongsTo(Payment::class);
    }
}
