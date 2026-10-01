'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/Icon';
import { api, errorMessage } from '@/lib/api';
import type { GeoResult } from '@/lib/types';

const AddressMap = dynamic(() => import('@/components/customer/AddressMap'), {
  ssr: false,
  loading: () => <div className="addr-map addr-map-loading">Memuat peta…</div>,
});

export interface GeoValue {
  lat: number | null;
  lng: number | null;
}

interface GeoPickerProps {
  value: GeoValue | null | undefined;
  onChange: (value: GeoValue) => void;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

// Pemilih titik peta untuk field `geo`: cari alamat (proxy Nominatim GET /geo/search), klik/geser pin di peta
// Leaflet/OSM, atau ketik koordinat. Kosong = tanpa pin.
export default function GeoPicker({ value, onChange }: GeoPickerProps) {
  const lat = typeof value?.lat === 'number' ? value.lat : null;
  const lng = typeof value?.lng === 'number' ? value.lng : null;
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<GeoResult[]>([]);
  const [error, setError] = useState('');
  const [focusKey, setFocusKey] = useState(0);

  const set = (nextLat: number, nextLng: number) => onChange({ lat: round6(nextLat), lng: round6(nextLng) });

  async function search() {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError('');
    try {
      const found = await api<GeoResult[]>(`/geo/search?q=${encodeURIComponent(q)}`);
      setResults(found);
      if (found.length === 0) setError('Lokasi tidak ditemukan. Coba kata kunci lain atau klik langsung di peta.');
    } catch (err) {
      setError(errorMessage(err, 'Layanan peta tidak tersedia.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="geo-picker">
      <div className="geo-picker-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Cari alamat atau nama tempat, lalu Enter"
        />
        <button type="button" className="btn btn-line btn-sm" onClick={() => void search()} disabled={busy}>
          {busy ? 'Mencari…' : 'Cari'}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="geo-picker-results">
          {results.map((r, i) => (
            <li key={`${r.lat},${r.lng},${i}`}>
              <button
                type="button"
                onClick={() => {
                  set(r.lat, r.lng);
                  setFocusKey((k) => k + 1);
                  setResults([]);
                }}
              >
                <Icon name="pin" size={14} /> {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <small className="cms-field-error">{error}</small>}
      <AddressMap lat={lat} lng={lng} onChange={set} focusKey={focusKey} />
      <div className="geo-picker-row">
        <label>
          <span className="field-label">Lat</span>
          <input type="number" step="any" min={-90} max={90} value={lat ?? ''} onChange={(e) => onChange({ lat: e.target.value === '' ? null : Number(e.target.value), lng })} className="mono" />
        </label>
        <label>
          <span className="field-label">Lng</span>
          <input type="number" step="any" min={-180} max={180} value={lng ?? ''} onChange={(e) => onChange({ lat, lng: e.target.value === '' ? null : Number(e.target.value) })} className="mono" />
        </label>
        <button type="button" className="row-act" onClick={() => onChange({ lat: null, lng: null })} disabled={lat === null && lng === null}>
          Hapus titik
        </button>
      </div>
      <small className="admin-field-hint">Klik peta atau geser penanda untuk menempatkan pin. Kosong = lokasi tidak ditampilkan di peta.</small>
    </div>
  );
}
