<?php

namespace App\Services\Cms;

use App\Models\Page;
use App\Models\PageSection;

// Alias kompatibilitas /blocks/{key} → section tertentu (kontrak 7 dan 11.6).
final class BlockAliases
{
    public const MAP = [
        'history' => ['page' => 'tentang', 'key' => 'history'],
        'vision-mission' => ['page' => 'tentang', 'key' => 'vision-mission'],
        'contact' => ['page' => 'kontak', 'key' => 'contact-info'],
    ];

    public static function resolve(string $key, bool $publicOnly = false): ?PageSection
    {
        $alias = self::MAP[$key] ?? null;
        if (! $alias) {
            return null;
        }

        $page = Page::where('slug', $alias['page'])->when($publicOnly, fn ($q) => $q->published())->first();
        if (! $page) {
            return null;
        }

        return $page->sections()->where('key', $alias['key'])->when($publicOnly, fn ($q) => $q->visible())->first();
    }
}
