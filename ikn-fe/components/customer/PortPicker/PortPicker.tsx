'use client';

// Pemilih pelabuhan tujuan untuk checkout term CIF (ASUMSI A-89): nama pelabuhan bebas, negara (daftar GET /countries),
// pencarian dunia lewat proxy Nominatim (GET /geo/search?scope=world, hanya saat tombol Cari/Enter, bukan tiap ketikan),
// dan pin Leaflet/OSM yang bisa digeser. Server mewajibkan lat/lng, jadi `completeDestinationPort()` baru mengembalikan
// payload bila nama, negara, dan pin semuanya ada; sebelum itu langkah checkout tidak bisa dilanjutkan.
import { useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';
import { api, errorMessage } from '@/lib/api';
import { countryName, useCountries } from '@/lib/countries';
import type { DestinationPortInput, GeoResult, Lang } from '@/lib/types';

const AddressMap = dynamic(() => import('@/components/customer/AddressMap'), {
  ssr: false,
  loading: () => (
    <div className="addr-map addr-map-loading">
      <Spinner label="Memuat peta / Loading map…" />
    </div>
  ),
});

/** Isian sementara: lat/lng boleh kosong sampai pengunjung menempatkan pin. */
export interface DestinationPortDraft {
  name: string;
  country: string;
  countryCode: string;
  lat: number | null;
  lng: number | null;
}

export const EMPTY_PORT: DestinationPortDraft = { name: '', country: '', countryCode: '', lat: null, lng: null };

/** Tampilan dunia saat belum ada pin (pelabuhan tujuan bisa di benua mana pun). */
const WORLD_CENTER: [number, number] = [15, 60];
const WORLD_ZOOM = 2;
const PORT_ZOOM = 11;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Lintang dibatasi -90..90, bujur dibungkus ke -180..180 (klik di salinan peta dunia bisa memberi 200 atau -400). */
export function normalizeLatLng(lat: number, lng: number): { lat: number; lng: number } {
  const clampedLat = Math.min(90, Math.max(-90, lat));
  const wrappedLng = ((((lng + 180) % 360) + 360) % 360) - 180;
  return { lat: round6(clampedLat), lng: round6(wrappedLng === -180 && lng > 0 ? 180 : wrappedLng) };
}

/** Payload `destinationPort` untuk POST /customer/orders, atau null bila nama/negara/pin belum lengkap. */
export function completeDestinationPort(draft: DestinationPortDraft): DestinationPortInput | null {
  const name = draft.name.trim();
  if (!name || !draft.country.trim() || draft.lat == null || draft.lng == null) return null;
  if (!Number.isFinite(draft.lat) || !Number.isFinite(draft.lng)) return null;
  const { lat, lng } = normalizeLatLng(draft.lat, draft.lng);
  return { name, country: draft.country.trim(), countryCode: draft.countryCode || null, lat, lng };
}

/** Pesan validasi per bagian yang masih kosong (dipakai inline setelah pengunjung mencoba lanjut). */
export function destinationPortErrors(draft: DestinationPortDraft, lang: Lang): Partial<Record<'name' | 'country' | 'pin', string>> {
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const out: Partial<Record<'name' | 'country' | 'pin', string>> = {};
  if (!draft.name.trim()) out.name = t('Nama pelabuhan wajib diisi.', 'Port name is required.');
  if (!draft.country.trim()) out.country = t('Pilih negara pelabuhan tujuan.', 'Choose the destination country.');
  if (draft.lat == null || draft.lng == null) out.pin = t('Tandai lokasi pelabuhan di peta (cari lalu pilih hasil, atau klik peta).', 'Place the port pin on the map (search and pick a result, or click the map).');
  return out;
}

interface PortPickerProps {
  value: DestinationPortDraft;
  onChange: (next: DestinationPortDraft) => void;
  lang: Lang;
  /** Tampilkan pesan bagian yang kosong (setelah tombol lanjut ditekan). */
  showErrors?: boolean;
  /** Pesan 422 server per field (`destinationPort.name`, `destinationPort.lat`, ...), ditampilkan di bawah isian terkait. */
  serverErrors?: Record<string, string>;
}

export default function PortPicker({ value, onChange, lang, showErrors = false, serverErrors = {} }: PortPickerProps) {
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const { countries } = useCountries();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [focusKey, setFocusKey] = useState(0);

  const errors = showErrors ? destinationPortErrors(value, lang) : {};
  const serverError = (key: string) => serverErrors[`destinationPort.${key}`] || '';
  const pinError = errors.pin || serverError('lat') || serverError('lng');

  const setPin = (lat: number, lng: number) => onChange({ ...value, ...normalizeLatLng(lat, lng) });

  /** Nama negara EN dari daftar GET /countries; '' bila daftar belum dimuat atau kode tidak dikenal (countryName mengembalikan kodenya). */
  const knownCountryName = (code: string) => {
    const name = countryName(code, 'en', countries);
    return name && name !== code.toUpperCase() ? name : '';
  };

  function pickCountry(code: string) {
    // Nama negara disimpan dalam bahasa Inggris karena dicetak di proforma/commercial invoice.
    onChange({ ...value, countryCode: code, country: code ? knownCountryName(code) || code : '' });
  }

  async function search() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setSearchError('');
    try {
      const found = await api<GeoResult[]>(`/geo/search?q=${encodeURIComponent(q)}&scope=world`);
      setResults(found);
      if (found.length === 0) setSearchError(t('Lokasi tidak ditemukan. Coba nama pelabuhan atau kota lain, atau klik langsung di peta.', 'No match found. Try another port or city name, or click the map directly.'));
    } catch (err) {
      setSearchError(errorMessage(err, t('Layanan peta tidak tersedia.', 'Map service is unavailable.')));
    } finally {
      setBusy(false);
    }
  }

  function pickResult(result: GeoResult) {
    const code = (result.countryCode || '').toUpperCase();
    // Nama pelabuhan hanya diisi bila masih kosong (pengunjung mungkin sudah mengetik nama resminya).
    const name = value.name.trim() || (result.displayName.split(',')[0] || result.displayName).trim();
    onChange({
      ...value,
      name,
      countryCode: code || value.countryCode,
      country: code ? knownCountryName(code) || result.country || code : value.country || result.country || '',
      ...normalizeLatLng(result.lat, result.lng),
    });
    setResults([]);
    setFocusKey((k) => k + 1);
  }

  const hasPin = value.lat != null && value.lng != null;

  return (
    <div className="co-fields port-picker">
      <label>
        <span className="label">{t('Nama pelabuhan', 'Port name')} *</span>
        <input
          value={value.name}
          maxLength={120}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={t('Contoh: Port Klang', 'e.g. Port Klang')}
          aria-invalid={errors.name || serverError('name') ? true : undefined}
        />
        {(errors.name || serverError('name')) && <p className="form-error" role="alert">{errors.name || serverError('name')}</p>}
      </label>
      <label>
        <span className="label">{t('Negara', 'Country')} *</span>
        <Select value={value.countryCode} onChange={(e) => pickCountry(e.target.value)} className="addr-select" searchPlaceholder={t('Cari negara', 'Search country')} aria-invalid={errors.country || serverError('country') ? true : undefined}>
          <option value="">{t('Pilih negara…', 'Select country…')}</option>
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name[lang] || c.name.id}
            </option>
          ))}
        </Select>
        {(errors.country || serverError('country') || serverError('countryCode')) && (
          <p className="form-error" role="alert">{errors.country || serverError('country') || serverError('countryCode')}</p>
        )}
      </label>

      <div className="co-full addr-map-block">
        <span className="label">{t('Cari pelabuhan', 'Search port')}</span>
        <small className="addr-map-why">
          {t('Ongkos kapal dan asuransi dihitung sampai titik ini. Pin wajib dipasang sebelum lanjut dan bisa digeser.', 'Ocean freight and insurance are quoted up to this point. The pin is required before you continue and can be dragged.')}
        </small>
        <div className="addr-geo-search">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('Nama pelabuhan atau kota, mis. Port Klang', 'Port or city name, e.g. Port Klang')}
            aria-label={t('Cari pelabuhan', 'Search port')}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
          <button type="button" className="btn btn-line btn-sm" onClick={() => void search()} disabled={busy || !query.trim()}>
            <Icon name="search" size={15} /> {busy ? t('Mencari…', 'Searching…') : t('Cari', 'Search')}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="addr-geo-results">
            {results.map((r, i) => (
              <li key={`${r.lat}-${r.lng}-${i}`}>
                <button type="button" onClick={() => pickResult(r)}>
                  <Icon name="pin" size={14} />
                  <span>
                    {r.displayName}
                    {r.type && <small className="port-result-type"> · {r.type}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchError && <p className="form-error" role="alert">{searchError}</p>}
        <AddressMap lat={value.lat} lng={value.lng} onChange={setPin} focusKey={focusKey} defaultCenter={WORLD_CENTER} defaultZoom={WORLD_ZOOM} focusZoom={PORT_ZOOM} />
        <div className="addr-map-foot">
          <span className="qty-moq">
            {hasPin ? `${value.lat}, ${value.lng}` : t('Klik peta atau pilih hasil pencarian untuk menandai pelabuhan. Pin bisa digeser.', 'Click the map or pick a search result to mark the port. You can drag the pin.')}
          </span>
          {hasPin && (
            <button type="button" className="link" onClick={() => onChange({ ...value, lat: null, lng: null })}>
              {t('Hapus titik', 'Clear pin')}
            </button>
          )}
        </div>
        {pinError && <p className="form-error" role="alert">{pinError}</p>}
      </div>
    </div>
  );
}
