<?php

namespace App\Support;

/**
 * Penyaring kata kasar untuk teks dari customer (ulasan). Daftar kata di config/profanity.php.
 * Teks dan kata daftar dinormalkan dengan cara yang sama, lalu dicocokkan per kata utuh (batas huruf),
 * sehingga variasi "B4NGS4T", "anjiiing", "g0bl0k" tertangkap tetapi "anjungan" atau "as pompa" tidak.
 */
class Profanity
{
    private const SUBSTITUTIONS = ['4' => 'a', '@' => 'a', '1' => 'i', '!' => 'i', '0' => 'o', '3' => 'e', '$' => 's', '5' => 's', '7' => 't'];

    /** @var array<int, string>|null kata daftar yang sudah dinormalkan (cache per proses) */
    private static ?array $words = null;

    public static function contains(?string $text): bool
    {
        return self::matches($text) !== [];
    }

    /** Kata daftar (bentuk asli) yang ditemukan; kosong = bersih. */
    public static function matches(?string $text): array
    {
        $normalized = self::normalize((string) $text);
        if ($normalized === '') {
            return [];
        }

        $found = [];
        foreach (self::words() as $original => $word) {
            if (preg_match('/(?<![a-z])'.preg_quote($word, '/').'(?![a-z])/', $normalized)) {
                $found[] = $original;
            }
        }

        return $found;
    }

    /** Huruf kecil, angka/simbol pengganti huruf dikembalikan, non-huruf jadi spasi, huruf berulang dipadatkan. */
    public static function normalize(string $text): string
    {
        $text = mb_strtolower($text);
        $text = strtr($text, self::SUBSTITUTIONS);
        $text = preg_replace('/[^a-z]+/u', ' ', $text) ?? '';
        $text = preg_replace('/([a-z])\1+/', '$1', $text) ?? '';

        return trim($text);
    }

    /** @return array<string, string> kata asli => kata ternormalkan */
    private static function words(): array
    {
        if (self::$words === null) {
            self::$words = [];
            foreach ((array) config('profanity.words', []) as $word) {
                $normalized = self::normalize((string) $word);
                if ($normalized !== '') {
                    self::$words[(string) $word] = $normalized;
                }
            }
        }

        return self::$words;
    }
}
