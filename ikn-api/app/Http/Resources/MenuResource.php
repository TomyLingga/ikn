<?php

namespace App\Http\Resources;

use App\Models\Menu;
use App\Models\MenuItem;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

// Pohon menu { location, items: [ { ..., children: [] } ] }.
class MenuResource extends JsonResource
{
    private bool $activeOnly;

    public function __construct(Menu $menu, bool $activeOnly = false)
    {
        parent::__construct($menu);
        $this->activeOnly = $activeOnly;
    }

    public function toArray($request): array
    {
        $items = $this->resource->items()->get();
        if ($this->activeOnly) {
            $items = $items->where('is_active', true);
        }

        return [
            'location' => $this->location,
            'items' => $this->tree($items, null),
            'updatedAt' => optional($this->updated_at)->toApiString(),
        ];
    }

    private function tree(Collection $items, ?int $parentId): array
    {
        return $items
            ->filter(fn (MenuItem $i) => $i->parent_id === $parentId)
            ->sortBy([['sort_order', 'asc'], ['id', 'asc']])
            ->values()
            ->map(fn (MenuItem $i) => [
                'id' => $i->id,
                'key' => $i->key,
                'label' => $i->label,
                'description' => $i->description,
                'url' => $i->url,
                'isActive' => $i->is_active,
                'sortOrder' => $i->sort_order,
                'children' => $this->tree($items, $i->id),
            ])
            ->all();
    }
}
