'use client';

// Pemilih pelabuhan/bandara tujuan untuk checkout term CIF (ASUMSI A-89). Urutan: cari → nama + negara terisi → pin di peta.
// Saran saat mengetik berasal dari daftar lokal pelabuhan dan bandara dunia (lib/destinations.ts); layanan Nominatim publik
// melarang autocomplete, jadi pencarian peta (GET /geo/search?scope=world) hanya jalan lewat tombol "Cari di peta".
// Memilih saran/hasil atau mengeklik peta dekat pelabuhan yang dikenal mengisi nama dan negara; keduanya tetap bisa diedit.
// Server mewajibkan lat/lng, jadi `completeDestinationPort()` baru mengembalikan payload bila nama, negara, dan pin ada.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';
import { api, errorMessage } from '@/lib/api';
import { countryName, useCountries } from '@/lib/countries';
import { destinationKindLabel, destinationLabel, loadDestinations, nearestDestination, rankGeoResults, searchDestinations, type Destination } from '@/lib/destinations';
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
  if (!draft.name.trim()) out.name = t('Nama pelabuhan atau bandara wajib diisi.', 'Port or airport name is required.');
  if (!draft.country.trim()) out.country = t('Pilih negara tujuan.', 'Choose the destination country.');
  if (draft.lat == null || draft.lng == null) out.pin = t('Tandai lokasinya di peta: pilih dari saran pencarian, atau klik peta.', 'Mark the location on the map: pick a search suggestion, or click the map.');
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
  const listId = useId();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [focusKey, setFocusKey] = useState(0);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(0);
  // True while the name came from a suggestion/map match (or is empty): only then a map click may replace it.
  const nameIsAuto = useRef(!value.name.trim());

  useEffect(() => {
    let alive = true;
    loadDestinations()
      .then((list) => {
        if (alive) setDestinations(list);
      })
      .catch(() => undefined); // suggestions are optional: map search and manual entry still work
    return () => {
      alive = false;
    };
  }, []);

  const errors = showErrors ? destinationPortErrors(value, lang) : {};
  const serverError = (key: string) => serverErrors[`destinationPort.${key}`] || '';
  const pinError = errors.pin || serverError('lat') || serverError('lng');

  /** Nama negara EN dari daftar GET /countries; '' bila daftar belum dimuat atau kode tidak dikenal (countryName mengembalikan kodenya). */
  const knownCountryName = (code: string) => {
    const name = countryName(code, 'en', countries);
    return name && name !== code.toUpperCase() ? name : '';
  };

  const suggestions = useMemo(
    () =>
      searchDestinations(destinations, query, {
        countryCode: value.countryCode,
        countryTerms: (code) => {
          const c = countries.find((row) => row.code === code);
          return c ? `${c.name.en} ${c.name.id}` : '';
        },
      }),
    [destinations, query, value.countryCode, countries],
  );
  const showSuggestions = suggestOpen && suggestions.length > 0;

  function pickCountry(code: string) {
    // Nama negara disimpan dalam bahasa Inggris karena dicetak di proforma/commercial invoice.
    onChange({ ...value, countryCode: code, country: code ? knownCountryName(code) || code : '' });
  }

  function pickDestination(d: Destination) {
    nameIsAuto.current = true;
    onChange({ name: destinationLabel(d), countryCode: d.countryCode, country: knownCountryName(d.countryCode) || d.countryCode, ...normalizeLatLng(d.lat, d.lng) });
    setQuery(destinationLabel(d));
    setSuggestOpen(false);
    setResults([]);
    setSearchError('');
    setFocusKey((k) => k + 1);
  }

  /** Klik/geser pin: bila namanya belum diketik sendiri, isi dari pelabuhan/bandara terdekat yang dikenal (≤ 30 km). */
  function setPin(lat: number, lng: number) {
    const point = normalizeLatLng(lat, lng);
    const near = nameIsAuto.current ? nearestDestination(destinations, point.lat, point.lng) : null;
    if (!near) {
      onChange({ ...value, ...point });
      return;
    }
    onChange({ name: destinationLabel(near), countryCode: near.countryCode, country: knownCountryName(near.countryCode) || near.countryCode, ...point });
  }

  async function searchMap() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setSearchError('');
    setSuggestOpen(false);
    try {
      const found = rankGeoResults(await api<GeoResult[]>(`/geo/search?q=${encodeURIComponent(q)}&scope=world`));
      setResults(found);
      if (found.length === 0) setSearchError(t('Lokasi tidak ditemukan. Coba nama pelabuhan, bandara, atau kota lain, atau klik langsung di peta.', 'No match found. Try another port, airport or city name, or click the map directly.'));
    } catch (err) {
      setSearchError(errorMessage(err, t('Layanan peta tidak tersedia.', 'Map service is unavailable.')));
    } finally {
      setBusy(false);
    }
  }

  function pickResult(result: GeoResult) {
    const code = (result.countryCode || '').toUpperCase();
    const picked = (result.displayName.split(',')[0] || result.displayName).trim();
    nameIsAuto.current = true;
    onChange({
      ...value,
      name: picked || value.name,
      countryCode: code || value.countryCode,
      country: code ? knownCountryName(code) || result.country || code : value.country || result.country || '',
      ...normalizeLatLng(result.lat, result.lng),
    });
    setResults([]);
    setFocusKey((k) => k + 1);
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setSuggestOpen(true);
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = showSuggestions ? suggestions[Math.min(active, suggestions.length - 1)] : undefined;
      if (chosen) pickDestination(chosen);
      else void searchMap();
    } else if (e.key === 'Escape' && showSuggestions) {
      e.preventDefault();
      setSuggestOpen(false);
    }
  }

  const hasPin = value.lat != null && value.lng != null;

  return (
    <div className="co-fields port-picker">
      <div className="co-full addr-map-block port-search">
        <span className="label" id={`${listId}-label`}>{t('Cari pelabuhan atau bandara tujuan', 'Search destination port or airport')}</span>
        <small className="addr-map-why">
          {t(
            'Ketik nama pelabuhan, bandara, kota, atau negara, lalu pilih dari saran. Nama, negara, dan titik di peta terisi otomatis dan masih bisa diubah.',
            'Type a port, airport, city or country name and pick a suggestion. Name, country and map pin are filled in and can still be changed.',
          )}
        </small>
        <div className="addr-geo-search port-combo">
          <div className="port-combo-field">
            <Icon name="search" size={16} />
            <input
              value={query}
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={`${listId}-list`}
              aria-autocomplete="list"
              aria-activedescendant={showSuggestions ? `${listId}-opt-${active}` : undefined}
              aria-labelledby={`${listId}-label`}
              autoComplete="off"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setSuggestOpen(true);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
              onKeyDown={onSearchKey}
              placeholder={t('Mis. Shanghai, Port Klang, Rotterdam, Changi', 'e.g. Shanghai, Port Klang, Rotterdam, Changi')}
            />
            {showSuggestions && (
              <ul className="port-suggest" id={`${listId}-list`} role="listbox">
                {suggestions.map((d, i) => (
                  <li key={`${d.kind}-${d.code}`} id={`${listId}-opt-${i}`} role="option" aria-selected={i === active} className={i === active ? 'is-active' : undefined}>
                    {/* onMouseDown keeps the input focused, so the blur timer does not close the list before the click lands. */}
                    <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={() => pickDestination(d)} onMouseEnter={() => setActive(i)}>
                      <span className={`port-suggest-icon is-${d.kind}`}>
                        <Icon name={d.kind === 'airport' ? 'plane' : 'ship'} size={16} />
                      </span>
                      <span className="port-suggest-text">
                        <strong>{destinationLabel(d)}</strong>
                        <small>
                          {destinationKindLabel(d.kind, lang)} · {countryName(d.countryCode, lang, countries)}
                          {d.kind === 'port' ? ` · ${d.code}` : ''}
                        </small>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void searchMap()} disabled={busy || !query.trim()} title={t('Cari nama ini di peta OpenStreetMap', 'Look this name up on OpenStreetMap')}>
            <Icon name="pin" size={15} /> {busy ? t('Mencari…', 'Searching…') : t('Cari di peta', 'Search map')}
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
      </div>

      <label>
        <span className="label">{t('Nama pelabuhan / bandara', 'Port / airport name')} *</span>
        <input
          value={value.name}
          maxLength={120}
          onChange={(e) => {
            nameIsAuto.current = !e.target.value.trim();
            onChange({ ...value, name: e.target.value });
          }}
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
            <option key={c.code} value={c.code} data-keywords={`${c.name.en} ${c.name.id}`}>
              {c.name[lang] || c.name.id}
            </option>
          ))}
        </Select>
        {(errors.country || serverError('country') || serverError('countryCode')) && (
          <p className="form-error" role="alert">{errors.country || serverError('country') || serverError('countryCode')}</p>
        )}
      </label>

      <div className="co-full addr-map-block">
        <span className="label">{t('Titik di peta', 'Map pin')} *</span>
        <small className="addr-map-why">
          {t('Ongkos angkut dan asuransi dihitung sampai titik ini. Klik peta untuk memasang pin, geser bila kurang tepat.', 'Freight and insurance are quoted up to this point. Click the map to place the pin and drag it to adjust.')}
        </small>
        <AddressMap lat={value.lat} lng={value.lng} onChange={setPin} focusKey={focusKey} defaultCenter={WORLD_CENTER} defaultZoom={WORLD_ZOOM} focusZoom={PORT_ZOOM} />
        <div className="addr-map-foot">
          <span className="qty-moq">
            {hasPin ? `${value.lat}, ${value.lng}` : t('Belum ada titik. Pilih saran pencarian atau klik peta.', 'No pin yet. Pick a search suggestion or click the map.')}
          </span>
          {hasPin && (
            <button type="button" className="link" onClick={() => onChange({ ...value, lat: null, lng: null })}>
              <Icon name="close" size={13} /> {t('Hapus titik', 'Clear pin')}
            </button>
          )}
        </div>
        {pinError && <p className="form-error" role="alert">{pinError}</p>}
      </div>
    </div>
  );
}
