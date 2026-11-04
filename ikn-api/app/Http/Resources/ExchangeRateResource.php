<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ExchangeRateResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'date' => $this->date->format('Y-m-d'),
            'rate' => $this->rateInt(),
            'source' => $this->source,
            'fetchedAt' => optional($this->fetched_at)->toApiString(),
        ];
    }
}
