// Daftar negara ISO 3166-1 alpha-2 dari GET /countries (Indonesia di urutan pertama), dimuat sekali per sesi
// browser dan dipakai form daftar, profil perusahaan, dan panel admin (ASUMSI A-86).
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Country, Lang } from '@/lib/types';

export const DEFAULT_COUNTRY = 'ID';

let pending: Promise<Country[]> | null = null;
let loaded: Country[] = [];

/** Ambil daftar negara (dicache di memori; gagal = dicoba lagi pada panggilan berikutnya). */
export function fetchCountries(): Promise<Country[]> {
  if (loaded.length > 0) return Promise.resolve(loaded);
  if (!pending) {
    pending = api<Country[]>('/countries')
      .then((rows) => {
        loaded = Array.isArray(rows) ? rows : [];
        return loaded;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}

/** Nama negara menurut bahasa dari daftar yang sudah dimuat; kode dikembalikan apa adanya bila belum ada. */
export function countryName(code: string | null | undefined, lang: Lang = 'id', countries: Country[] = loaded): string {
  if (!code) return '';
  const upper = code.toUpperCase();
  const found = countries.find((c) => c.code === upper);
  if (!found) return upper;
  return found.name[lang] || found.name.id || upper;
}

/** Hook: daftar negara + status muat (kosong sampai GET /countries selesai). */
export function useCountries(): { countries: Country[]; loading: boolean; error: boolean } {
  const [countries, setCountries] = useState<Country[]>(loaded);
  const [loading, setLoading] = useState(loaded.length === 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCountries()
      .then((rows) => {
        if (active) setCountries(rows);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { countries, loading, error };
}
