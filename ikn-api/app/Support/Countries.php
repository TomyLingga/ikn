<?php

namespace App\Support;

// Daftar negara dari config/countries.php (ISO 3166-1 alpha-2, Indonesia pertama) untuk validasi dan GET /countries.
final class Countries
{
    /** @return array<string, array{id:string,en:string}> */
    public static function all(): array
    {
        return (array) config('countries', []);
    }

    /** @return string[] kode uppercase */
    public static function codes(): array
    {
        return array_keys(self::all());
    }

    public static function has(?string $code): bool
    {
        return $code !== null && array_key_exists(self::normalize($code), self::all());
    }

    public static function normalize(?string $code): string
    {
        return strtoupper(trim((string) $code));
    }

    /** @return array{id:string,en:string}|null */
    public static function name(?string $code): ?array
    {
        return self::all()[self::normalize($code)] ?? null;
    }

    /** Bentuk API: [{ code, name{id,en} }] urut config (Indonesia pertama). */
    public static function toApi(): array
    {
        $out = [];
        foreach (self::all() as $code => $name) {
            $out[] = ['code' => $code, 'name' => $name];
        }

        return $out;
    }
}
