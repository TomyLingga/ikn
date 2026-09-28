<?php

namespace App\Http\Controllers\Api\V1\PublicSite;

use App\Http\Controllers\Api\V1\ApiController;
use App\Http\Resources\DocLinkResource;
use App\Http\Resources\MenuResource;
use App\Models\DocLink;
use App\Models\Menu;
use App\Services\Cms\BlockAliases;
use App\Services\Cms\SectionRegistry;
use App\Services\Cms\SettingsService;
use Illuminate\Http\Request;

// Data lintas halaman (navbar, footer) dalam satu panggilan: GET /content/site.
class SiteController extends ApiController
{
    public function site(SettingsService $settings, SectionRegistry $registry)
    {
        $menus = [];
        foreach (Menu::LOCATIONS as $location) {
            $menu = Menu::where('location', $location)->first();
            $menus[$location] = $menu ? (new MenuResource($menu, true))->resolve() : ['location' => $location, 'items' => []];
        }

        $contact = BlockAliases::resolve('contact', true);

        return $this->data([
            'settings' => $settings->all(true),
            'menus' => $menus,
            'contact' => $contact ? $registry->hydrate($contact->type, $registry->normalize($contact->type, $contact->content ?? [])) : null,
            'docLinks' => DocLinkResource::collection($this->docLinkQuery()->get()),
        ]);
    }

    public function settings(SettingsService $settings)
    {
        return $this->data($settings->all(true));
    }

    public function menu(string $location)
    {
        $menu = Menu::where('location', $location)->firstOrFail();

        return $this->data(new MenuResource($menu, true));
    }

    public function docLinks(Request $request)
    {
        $links = $this->docLinkQuery()
            ->when($request->query('category'), fn ($q, $c) => $q->where('category', $c))
            ->get();

        return $this->data(DocLinkResource::collection($links));
    }

    private function docLinkQuery()
    {
        return DocLink::active()->with('media')->orderBy('category')->orderBy('sort_order')->orderBy('id');
    }
}
