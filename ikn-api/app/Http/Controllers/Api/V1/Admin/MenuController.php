<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Exceptions\ApiException;
use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Requests\Admin\UpdateMenuRequest;
use App\Http\Resources\MenuResource;
use App\Models\Menu;
use Illuminate\Support\Facades\DB;

// Menu navigasi (header/footer): PUT mengganti seluruh pohon (maks 2 tingkat).
class MenuController extends ApiController
{
    public function show(string $location)
    {
        return $this->data(new MenuResource($this->menu($location)));
    }

    public function update(UpdateMenuRequest $request, string $location)
    {
        $menu = $this->menu($location);
        $items = $request->validated()['items'];

        DB::transaction(function () use ($menu, $items) {
            $menu->items()->delete();
            $this->insert($menu, $items, null, 1);
            $menu->touch();
        });

        return $this->data(new MenuResource($menu->fresh()));
    }

    private function menu(string $location): Menu
    {
        if (! in_array($location, Menu::LOCATIONS, true)) {
            throw ApiException::notFound(__('api.menu_location_unknown'));
        }

        return Menu::firstOrCreate(['location' => $location]);
    }

    private function insert(Menu $menu, array $items, ?int $parentId, int $depth): void
    {
        foreach (array_values($items) as $position => $item) {
            $row = $menu->items()->create([
                'parent_id' => $parentId,
                'key' => $item['key'] ?? null,
                'label' => $item['label'],
                'description' => $item['description'] ?? null,
                'url' => $item['url'] ?? null,
                'sort_order' => $position,
                'is_active' => $item['isActive'] ?? true,
            ]);

            if ($depth < 2 && ! empty($item['children'])) {
                $this->insert($menu, $item['children'], $row->id, $depth + 1);
            }
        }
    }
}
