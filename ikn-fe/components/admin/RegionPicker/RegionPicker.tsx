'use client';

import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { regionLevelLabels, type ZoneRegionRef } from '@/lib/admin';
import type { Region, RegionLevel } from '@/lib/types';
import Select from '@/components/Select';

// Cache nama wilayah lintas komponen (kode → nama). API tidak punya GET /regions/{code}, jadi nama
// diselesaikan lewat daftar anak induknya (GET /regions?parent=) atau daftar provinsi.
const nameCache = new Map<string, string>();
const listCache = new Map<string, Promise<Region[]>>();

function parentCodeOf(code: string): string | null {
  const parts = code.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : null;
}

function loadList(key: string, path: string): Promise<Region[]> {
  let pending = listCache.get(key);
  if (!pending) {
    pending = api<Region[]>(path).then((items) => {
      for (const item of items) nameCache.set(item.code, item.name);
      return items;
    });
    listCache.set(key, pending);
  }
  return pending;
}

export function loadProvinces(): Promise<Region[]> {
  return loadList('province', '/regions?level=province');
}

export function loadChildren(parent: string): Promise<Region[]> {
  return loadList(`parent:${parent}`, `/regions?parent=${encodeURIComponent(parent)}`);
}

/** Nama wilayah untuk daftar kode (dari cache, memuat yang belum ada). */
export function useRegionNames(refs: ZoneRegionRef[]): Record<string, string> {
  const [names, setNames] = useState<Record<string, string>>({});
  const codes = useMemo(() => refs.map((r) => r.code).join('|'), [refs]);

  useEffect(() => {
    let cancelled = false;
    const list = codes ? codes.split('|') : [];
    const missing = list.filter((code) => !nameCache.has(code));
    const loaders = [...new Set(missing.map((code) => parentCodeOf(code) ?? ''))].map((parent) => (parent ? loadChildren(parent) : loadProvinces()).catch(() => []));
    Promise.all(loaders).then(() => {
      if (cancelled) return;
      const out: Record<string, string> = {};
      for (const code of list) out[code] = nameCache.get(code) || code;
      setNames(out);
    });
    return () => {
      cancelled = true;
    };
  }, [codes]);

  return names;
}

interface RegionPickerProps {
  value: ZoneRegionRef[];
  onChange: (next: ZoneRegionRef[]) => void;
  error?: string;
}

// Pemilih cakupan wilayah zona ongkir: chip wilayah terpilih + pencarian nama (semua level) + dropdown provinsi/kabupaten.
export default function RegionPicker({ value, onChange, error }: RegionPickerProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const names = useRegionNames(value);

  const [mode, setMode] = useState<'search' | 'browse'>('browse');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Region[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [provinces, setProvinces] = useState<Region[]>([]);
  const [province, setProvince] = useState('');
  const [regencies, setRegencies] = useState<Region[]>([]);
  const [regency, setRegency] = useState('');
  const [districts, setDistricts] = useState<Region[]>([]);
  const [district, setDistrict] = useState('');

  useEffect(() => {
    loadProvinces()
      .then(setProvinces)
      .catch((err) => setSearchError(errorMessage(err)));
  }, []);

  useEffect(() => {
    setRegency('');
    setDistricts([]);
    setDistrict('');
    if (!province) {
      setRegencies([]);
      return;
    }
    let cancelled = false;
    loadChildren(province)
      .then((items) => {
        if (!cancelled) setRegencies(items);
      })
      .catch(() => setRegencies([]));
    return () => {
      cancelled = true;
    };
  }, [province]);

  useEffect(() => {
    setDistrict('');
    if (!regency) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    loadChildren(regency)
      .then((items) => {
        if (!cancelled) setDistricts(items);
      })
      .catch(() => setDistricts([]));
    return () => {
      cancelled = true;
    };
  }, [regency]);

  // Pencarian dengan debounce 350 ms.
  useEffect(() => {
    const term = query.trim();
    if (mode !== 'search' || term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setSearching(true);
      setSearchError('');
      api<Region[]>(`/regions/search?q=${encodeURIComponent(term)}`)
        .then((items) => {
          if (cancelled) return;
          for (const item of items) nameCache.set(item.code, item.name);
          setResults(items);
        })
        .catch((err) => {
          if (!cancelled) setSearchError(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode]);

  const selected = new Set(value.map((r) => r.code));

  function add(code: string, level: RegionLevel, name?: string) {
    if (!code || selected.has(code)) return;
    if (name) nameCache.set(code, name);
    onChange([...value, { code, level }]);
  }

  function remove(code: string) {
    onChange(value.filter((r) => r.code !== code));
  }

  const selectedProvince = provinces.find((p) => p.code === province);
  const selectedRegency = regencies.find((r) => r.code === regency);
  const selectedDistrict = districts.find((d) => d.code === district);

  return (
    <div className="cms-field">
      <span className="field-label">{t('Cakupan wilayah', 'Coverage regions')}</span>
      <small className="admin-field-hint">
        {t(
          'Alamat customer dicocokkan dari wilayah paling spesifik (desa → kecamatan → kabupaten → provinsi). Zona tanpa wilayah atau bertanda default menjadi zona cadangan.',
          'Customer addresses are matched from the most specific region (village → district → regency → province). A zone with no regions or marked default acts as the fallback.',
        )}
      </small>
      {error && <small className="cms-field-error">{error}</small>}

      <div className="admin-region-chips">
        {value.length === 0 && <span className="admin-field-hint">{t('Belum ada wilayah (zona cadangan / seluruh Indonesia).', 'No regions yet (fallback zone / all of Indonesia).')}</span>}
        {value.map((r) => (
          <span key={r.code} className="admin-chip">
            <span>
              {names[r.code] || r.code}
              <small>
                {' '}
                · {regionLevelLabels[r.level]?.[lang] || r.level} · {r.code}
              </small>
            </span>
            <button type="button" aria-label={t('Hapus', 'Remove')} onClick={() => remove(r.code)}>
              ✕
            </button>
          </span>
        ))}
      </div>

      <div className="admin-tabs admin-tabs-compact" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'browse'} className={`admin-tab ${mode === 'browse' ? 'is-active' : ''}`} onClick={() => setMode('browse')}>
          {t('Pilih provinsi / kabupaten', 'Pick province / regency')}
        </button>
        <button type="button" role="tab" aria-selected={mode === 'search'} className={`admin-tab ${mode === 'search' ? 'is-active' : ''}`} onClick={() => setMode('search')}>
          {t('Cari nama wilayah', 'Search region name')}
        </button>
      </div>

      {mode === 'browse' ? (
        <div className="admin-region-browse">
          <div className="admin-form-row admin-form-row-3">
            <label>
              <span className="field-label">{t('Provinsi', 'Province')}</span>
              <Select value={province} onChange={(e) => setProvince(e.target.value)}>
                <option value="">{t('— pilih —', '— select —')}</option>
                {provinces.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="field-label">{t('Kabupaten/Kota', 'Regency/City')}</span>
              <Select value={regency} onChange={(e) => setRegency(e.target.value)} disabled={!province}>
                <option value="">{province ? t('— semua / pilih —', '— all / select —') : '—'}</option>
                {regencies.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span className="field-label">{t('Kecamatan', 'District')}</span>
              <Select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!regency}>
                <option value="">{regency ? t('— semua / pilih —', '— all / select —') : '—'}</option>
                {districts.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
          <div className="row-actions">
            {selectedProvince && !regency && (
              <button type="button" className="row-act row-act-success" disabled={selected.has(selectedProvince.code)} onClick={() => add(selectedProvince.code, 'province', selectedProvince.name)}>
                <Icon name="plus" size={12} /> {t('Tambah provinsi', 'Add province')} {selectedProvince.name}
              </button>
            )}
            {selectedRegency && !district && (
              <button type="button" className="row-act row-act-success" disabled={selected.has(selectedRegency.code)} onClick={() => add(selectedRegency.code, 'regency', selectedRegency.name)}>
                <Icon name="plus" size={12} /> {t('Tambah', 'Add')} {selectedRegency.name}
              </button>
            )}
            {selectedDistrict && (
              <button type="button" className="row-act row-act-success" disabled={selected.has(selectedDistrict.code)} onClick={() => add(selectedDistrict.code, 'district', selectedDistrict.name)}>
                <Icon name="plus" size={12} /> {t('Tambah kecamatan', 'Add district')} {selectedDistrict.name}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="admin-region-search">
          <label className="admin-search">
            <span className="sr-only">{t('Cari wilayah', 'Search region')}</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Ketik nama provinsi/kabupaten/kecamatan/desa (min. 2 huruf)', 'Type a province/regency/district/village name (min. 2 letters)')} />
          </label>
          {searchError && <small className="cms-field-error">{searchError}</small>}
          {searching && <small className="admin-field-hint">{t('Mencari...', 'Searching...')}</small>}
          {!searching && query.trim().length >= 2 && results.length === 0 && <small className="admin-field-hint">{t('Tidak ada wilayah yang cocok.', 'No matching regions.')}</small>}
          {results.length > 0 && (
            <ul className="admin-region-results">
              {results.map((r) => (
                <li key={r.code}>
                  <button type="button" className="admin-region-result" disabled={selected.has(r.code)} onClick={() => add(r.code, r.level, r.name)}>
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.fullName && r.fullName !== r.name ? r.fullName : r.path?.join(', ')}</small>
                    </span>
                    <span className="cms-tag">{regionLevelLabels[r.level]?.[lang] || r.level}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
