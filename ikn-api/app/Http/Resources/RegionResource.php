<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

// { code, parentCode, level, name } (+ path[] dan fullName pada hasil pencarian).
class RegionResource extends JsonResource
{
    /** @var array<int, string>|null Nama leluhur dari provinsi ke bawah; hanya pada /regions/search. */
    public ?array $path = null;

    public function withPath(array $names): self
    {
        $this->path = array_values($names);

        return $this;
    }

    public function toArray($request): array
    {
        $data = [
            'code' => $this->code,
            'parentCode' => $this->parent_code,
            'level' => $this->level,
            'name' => $this->name,
        ];

        if ($this->path !== null) {
            $data['path'] = $this->path;
            $data['fullName'] = implode(', ', array_merge([$this->name], array_reverse($this->path)));
        }

        return $data;
    }
}
