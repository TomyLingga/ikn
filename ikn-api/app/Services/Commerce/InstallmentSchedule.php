<?php

namespace App\Services\Commerce;

use App\Support\I18n;
use Illuminate\Support\Str;

/**
 * Jadwal termin (ASUMSI A-97): bentuk baris, normalisasi, pemeriksaan, dan pembagian nominal. Murni (tanpa DB) agar
 * dipakai sama oleh syarat pembayaran (PaymentTerm), quote, dan InstallmentService.
 *
 * Baris: { key, label {id,en}, percent (2 desimal), trigger order|shipped|delivered, dueDays }.
 * Aturan: maksimal 6 baris, persen > 0 dan jumlahnya tepat 100, baris pertama ber-trigger `order`, key unik.
 * Baris pertama selalu mengikuti batas bayar order (dueDays = 0). Satu baris 100% sama dengan bayar penuh = tanpa jadwal.
 */
final class InstallmentSchedule
{
    public const TRIGGER_ORDER = 'order';
    public const TRIGGER_SHIPPED = 'shipped';
    public const TRIGGER_DELIVERED = 'delivered';
    public const TRIGGERS = [self::TRIGGER_ORDER, self::TRIGGER_SHIPPED, self::TRIGGER_DELIVERED];

    public const MAX_ROWS = 6;
    public const MAX_DUE_DAYS = 365;

    /**
     * Bentuk tersimpan dari input (form admin, seeder, snapshot). Baris yang bukan array dilewati; key kosong dibuat
     * dari label ("uang-muka-30") atau "termin-N". Hasil kosong atau satu baris = null (bayar penuh).
     *
     * @param  mixed  $rows
     * @return array<int, array{key:string, label:array{id:string,en:string}, percent:int|float, trigger:string, dueDays:int}>|null
     */
    public static function normalize($rows): ?array
    {
        if (! is_array($rows)) {
            return null;
        }
        $out = [];
        // Key yang diisi pemanggil dipakai apa adanya (kembar = galat); key otomatis dibuat unik dengan akhiran nomor.
        $given = [];
        foreach ($rows as $row) {
            if (is_array($row) && ($slug = Str::slug(trim((string) ($row['key'] ?? '')), '_')) !== '') {
                $given[] = mb_substr($slug, 0, 40);
            }
        }
        foreach (array_values($rows) as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            $label = I18n::normalize($row['label'] ?? null);
            $key = Str::slug(trim((string) ($row['key'] ?? '')), '_');
            if ($key === '') {
                $base = mb_substr(Str::slug($label['id'], '_') ?: 'termin_'.($i + 1), 0, 36);
                $key = $base;
                for ($n = 2; in_array($key, $given, true) || in_array($key, array_column($out, 'key'), true); $n++) {
                    $key = $base.'_'.$n;
                }
            }
            $trigger = in_array($row['trigger'] ?? null, self::TRIGGERS, true) ? $row['trigger'] : self::TRIGGER_ORDER;
            $out[] = [
                'key' => mb_substr($key, 0, 40),
                'label' => $label,
                'percent' => self::percentNumber(self::hundredths($row['percent'] ?? 0)),
                'trigger' => $trigger,
                // Baris pertama memakai batas bayar order (payment_due_at), bukan hari sendiri.
                'dueDays' => $out === [] ? 0 : max(0, min(self::MAX_DUE_DAYS, (int) ($row['dueDays'] ?? $row['due_days'] ?? 0))),
            ];
        }

        return count($out) > 1 ? $out : null;
    }

    /**
     * Galat aturan jadwal untuk baris yang sudah dinormalkan: kunci pesan di resources/lang commerce.installments.*.
     *
     * @return string[] kunci pesan (kosong = sah)
     */
    public static function violations(?array $rows): array
    {
        if ($rows === null || $rows === []) {
            return [];
        }
        $errors = [];
        if (count($rows) > self::MAX_ROWS) {
            $errors[] = 'too_many';
        }
        if (($rows[0]['trigger'] ?? null) !== self::TRIGGER_ORDER) {
            $errors[] = 'first_trigger';
        }
        $sum = 0;
        $keys = [];
        foreach ($rows as $row) {
            $hundredths = self::hundredths($row['percent'] ?? 0);
            if ($hundredths <= 0 || $hundredths > 10000) {
                $errors[] = 'percent_range';
            }
            $sum += $hundredths;
            $keys[] = (string) ($row['key'] ?? '');
        }
        if ($sum !== 10000) {
            $errors[] = 'percent_sum';
        }
        if (count(array_unique($keys)) !== count($keys)) {
            $errors[] = 'duplicate_key';
        }

        return array_values(array_unique($errors));
    }

    /**
     * Nominal tiap termin dalam satuan terkecil mata uang: persen × total dibulatkan half-up; baris terakhir mengambil
     * sisanya sehingga jumlah selalu = $total.
     *
     * @param  array<int, array{percent:int|float|string}>  $rows
     * @return int[]
     */
    public static function amounts(int $total, array $rows): array
    {
        $rows = array_values($rows);
        $count = count($rows);
        if ($count === 0) {
            return [];
        }
        $out = [];
        $allocated = 0;
        foreach ($rows as $i => $row) {
            if ($i === $count - 1) {
                $out[] = $total - $allocated;
                break;
            }
            // Bilangan bulat saja (ratusan persen): total × persen / 100, pembulatan half-up.
            $amount = intdiv($total * self::hundredths($row['percent'] ?? 0) + 5000, 10000);
            $amount = max(0, min($amount, $total - $allocated));
            $out[] = $amount;
            $allocated += $amount;
        }

        return $out;
    }

    /** Persen sebagai bilangan bulat ratusan: 30 → 3000, "33.33" → 3333. */
    public static function hundredths($percent): int
    {
        return is_numeric($percent) ? (int) round(((float) $percent) * 100) : 0;
    }

    /** @return int|float 3000 → 30, 3333 → 33.33 */
    public static function percentNumber(int $hundredths)
    {
        return $hundredths % 100 === 0 ? intdiv($hundredths, 100) : round($hundredths / 100, 2);
    }
}
