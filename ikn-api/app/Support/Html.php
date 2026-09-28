<?php

namespace App\Support;

use HTMLPurifier;
use HTMLPurifier_Config;

// Sanitasi HTML dari editor admin (isi berita, section rich text). Whitelist ketat: elemen artikel
// biasa, gambar, tabel, dan iframe YouTube saja. Skrip, event handler, dan style bebas dibuang.
final class Html
{
    // style hanya boleh berisi text-align (lihat CSS.AllowedProperties).
    public const ALLOWED = 'p[style],br,h2[style],h3[style],h4[style],strong,b,em,i,u,s,a[href|title|target|rel],ul,ol,li,blockquote,'
        .'img[src|alt|title|width|height],figure,figcaption,hr,table,thead,tbody,tr,th[style],td[style],'
        .'iframe[src|width|height|allow|allowfullscreen|frameborder],div[data-youtube-video|style],span';

    private static ?HTMLPurifier $purifier = null;

    public static function clean(?string $html): string
    {
        $html = trim((string) $html);
        if ($html === '') {
            return '';
        }

        $clean = trim(self::purifier()->purify($html));

        // Editor kosong menghasilkan <p></p>; anggap kosong.
        return preg_match('/^(<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>)+$/', $clean) ? '' : $clean;
    }

    /** Teks polos untuk ringkasan / estimasi baca. */
    public static function text(?string $html): string
    {
        return trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags((string) $html), ENT_QUOTES | ENT_HTML5, 'UTF-8')) ?? '');
    }

    /** Estimasi menit baca (200 kata/menit, minimal 1). */
    public static function readingMinutes(?string $html): int
    {
        $words = str_word_count(self::text($html));

        return max(1, (int) ceil($words / 200));
    }

    private static function purifier(): HTMLPurifier
    {
        if (self::$purifier) {
            return self::$purifier;
        }

        $cachePath = storage_path('framework/cache/purifier');
        if (! is_dir($cachePath)) {
            @mkdir($cachePath, 0775, true);
        }

        $config = HTMLPurifier_Config::createDefault();
        $config->set('Core.Encoding', 'UTF-8');
        $config->set('HTML.Doctype', 'HTML 4.01 Transitional');
        $config->set('Cache.SerializerPath', is_writable($cachePath) ? $cachePath : null);
        $config->set('HTML.Allowed', self::ALLOWED);
        $config->set('HTML.SafeIframe', true);
        $config->set('URI.SafeIframeRegexp', '%^(https?:)?//(www\.youtube(?:-nocookie)?\.com/embed/|player\.vimeo\.com/video/)%');
        $config->set('HTML.TargetBlank', false);
        $config->set('Attr.AllowedFrameTargets', ['_blank']);
        $config->set('Attr.AllowedRel', ['noopener', 'noreferrer', 'nofollow']);
        $config->set('CSS.AllowedProperties', ['text-align']);
        // Elemen kosong (mis. iframe yang src-nya dibuang, <p></p> sisa editor) ikut dibersihkan.
        $config->set('AutoFormat.RemoveEmpty', true);
        $config->set('AutoFormat.RemoveEmpty.RemoveNbsp', true);
        $config->set('URI.AllowedSchemes', ['http' => true, 'https' => true, 'mailto' => true, 'tel' => true]);

        // Elemen HTML5 yang tidak dikenal HTML 4.01 didaftarkan manual (DefinitionID wajib untuk definisi kustom).
        $config->set('HTML.DefinitionID', 'ikn-article-html');
        $config->set('HTML.DefinitionRev', 1);
        $def = $config->maybeGetRawHTMLDefinition();
        if ($def) {
            $def->addElement('figure', 'Block', 'Optional: (figcaption, Flow) | (Flow, figcaption) | Flow', 'Common');
            $def->addElement('figcaption', 'Inline', 'Flow', 'Common');
            $def->addAttribute('div', 'data-youtube-video', 'Text');
            $def->addAttribute('iframe', 'allow', 'Text');
            $def->addAttribute('iframe', 'allowfullscreen', 'Bool');
        }

        return self::$purifier = new HTMLPurifier($config);
    }
}
