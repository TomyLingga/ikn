'use client';

// Form alamat customer (bentuk BE-1): dropdown wilayah bertingkat (GET /regions) + peta Leaflet/OSM
// dengan pencarian Nominatim lewat proxy backend (GET /geo/search, GET /geo/reverse).
// Dipakai di dashboard alamat dan inline saat checkout.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import type { CustomerAddress, CustomerAddressInput, GeoResult, Region, RegionLevel } from '@/lib/types';

const AddressMap = dynamic(() => import('@/components/customer/AddressMap'), {
  ssr: false,
  loading: () => <div className="addr-map addr-map-loading">Memuat peta…</div>,
});

// Cache wilayah per parent agar buka/tutup form tidak memanggil ulang.
const regionCache = new Map<string, Promise<Region[]>>();

function loadRegions(key: 'province' | string): Promise<Region[]> {
  if (!regionCache.has(key)) {
    const path = key === 'province' ? '/regions?level=province' : `/regions?parent=${encodeURIComponent(key)}`;
    const p = api<Region[]>(path).catch((err) => {
      regionCache.delete(key);
      throw err;
    });
    regionCache.set(key, p);
  }
  return regionCache.get(key) as Promise<Region[]>;
}

const emptyInput: CustomerAddressInput = {
  label: '',
  recipientName: '',
  phone: '',
  addressLine: '',
  provinceCode: '',
  regencyCode: '',
  districtCode: '',
  villageCode: '',
  postalCode: '',
  lat: null,
  lng: null,
  note: '',
  isDefault: false,
};

export interface AddressFormProps {
  /** Alamat yang diubah; kosong = tambah baru. */
  initial?: CustomerAddress | null;
  onSaved: (address: CustomerAddress) => void;
  onCancel?: () => void;
  /** Isian awal nama penerima / telepon untuk alamat baru (dari profil). */
  defaults?: { recipientName?: string; phone?: string };
  submitLabel?: string;
}

export default function AddressForm({ initial, onSaved, onCancel, defaults, submitLabel }: AddressFormProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [form, setForm] = useState<CustomerAddressInput>(() =>
    initial
      ? {
          label: initial.label,
          recipientName: initial.recipientName,
          phone: initial.phone,
          addressLine: initial.addressLine,
          provinceCode: initial.provinceCode,
          regencyCode: initial.regencyCode,
          districtCode: initial.districtCode,
          villageCode: initial.villageCode,
          postalCode: initial.postalCode || '',
          lat: initial.lat,
          lng: initial.lng,
          note: initial.note || '',
          isDefault: initial.isDefault,
        }
      : { ...emptyInput, recipientName: defaults?.recipientName || '', phone: defaults?.phone || '' },
  );
  const set = <K extends keyof CustomerAddressInput>(key: K, value: CustomerAddressInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ---- Wilayah bertingkat ----
  const [provinces, setProvinces] = useState<Region[]>([]);
  const [regencies, setRegencies] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<Region[]>([]);
  const [villages, setVillages] = useState<Region[]>([]);
  const [regionError, setRegionError] = useState('');

  useEffect(() => {
    loadRegions('province').then(setProvinces).catch((err) => setRegionError(errorMessage(err)));
  }, []);
  useEffect(() => {
    if (!form.provinceCode) { setRegencies([]); return; }
    loadRegions(form.provinceCode).then(setRegencies).catch((err) => setRegionError(errorMessage(err)));
  }, [form.provinceCode]);
  useEffect(() => {
    if (!form.regencyCode) { setDistricts([]); return; }
    loadRegions(form.regencyCode).then(setDistricts).catch((err) => setRegionError(errorMessage(err)));
  }, [form.regencyCode]);
  useEffect(() => {
    if (!form.districtCode) { setVillages([]); return; }
    loadRegions(form.districtCode).then(setVillages).catch((err) => setRegionError(errorMessage(err)));
  }, [form.districtCode]);

  function pickRegion(level: RegionLevel, code: string) {
    setForm((prev) => {
      switch (level) {
        case 'province':
          return { ...prev, provinceCode: code, regencyCode: '', districtCode: '', villageCode: '' };
        case 'regency':
          return { ...prev, regencyCode: code, districtCode: '', villageCode: '' };
        case 'district':
          return { ...prev, districtCode: code, villageCode: '' };
        default:
          return { ...prev, villageCode: code };
      }
    });
  }

  // ---- Peta & geocoding ----
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [focusKey, setFocusKey] = useState(0);

  const setPoint = useCallback((lat: number, lng: number, focus = false) => {
    setForm((prev) => ({ ...prev, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }));
    if (focus) setFocusKey((k) => k + 1);
  }, []);

  async function searchGeo(e?: FormEvent) {
    e?.preventDefault();
    const q = geoQuery.trim() || form.addressLine.trim();
    if (!q || geoBusy) return;
    setGeoBusy(true);
    setGeoError('');
    try {
      const results = await api<GeoResult[]>(`/geo/search?q=${encodeURIComponent(q)}`);
      setGeoResults(results);
      if (results.length === 0) setGeoError(t('Lokasi tidak ditemukan. Coba kata kunci lain atau klik langsung di peta.', 'Location not found. Try another keyword or click on the map.'));
    } catch (err) {
      setGeoError(errorMessage(err, t('Layanan peta tidak tersedia.', 'Map service unavailable.')));
    } finally {
      setGeoBusy(false);
    }
  }

  async function useMapLocation() {
    if (form.lat == null || form.lng == null || geoBusy) return;
    setGeoBusy(true);
    setGeoError('');
    try {
      const results = await api<GeoResult[]>(`/geo/reverse?lat=${form.lat}&lng=${form.lng}`);
      const hit = results[0];
      if (!hit) {
        setGeoError(t('Tidak ada data alamat untuk titik ini.', 'No address data for this point.'));
        return;
      }
      setForm((prev) => ({
        ...prev,
        postalCode: hit.address.postcode || prev.postalCode,
        addressLine: prev.addressLine.trim() ? prev.addressLine : hit.displayName,
      }));
    } catch (err) {
      setGeoError(errorMessage(err, t('Layanan peta tidak tersedia.', 'Map service unavailable.')));
    } finally {
      setGeoBusy(false);
    }
  }

  // ---- Simpan ----
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setErrors({});
    const body: CustomerAddressInput = {
      ...form,
      postalCode: form.postalCode?.trim() || null,
      note: form.note?.trim() || null,
    };
    try {
      const saved = initial
        ? await api<CustomerAddress>(`/customer/addresses/${initial.id}`, { method: 'PUT', body })
        : await api<CustomerAddress>('/customer/addresses', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err, t('Alamat gagal disimpan.', 'Address could not be saved.')));
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key: string) => (errors[key] ? <small className="form-error">{errors[key]}</small> : null);
  const regionSelect = (
    level: RegionLevel,
    value: string,
    options: Region[],
    label: string,
    disabled: boolean,
  ) => (
    <label>
      <span className="label">{label}</span>
      <select value={value} onChange={(e) => pickRegion(level, e.target.value)} disabled={disabled} required className="addr-select">
        <option value="">{disabled ? '—' : t('Pilih…', 'Select…')}</option>
        {options.map((r) => (
          <option key={r.code} value={r.code}>{r.name}</option>
        ))}
      </select>
      {fieldError(`${level}Code`)}
    </label>
  );

  const mapPoint = useMemo(() => ({ lat: form.lat, lng: form.lng }), [form.lat, form.lng]);

  return (
    <form className="form acct-form address-form" onSubmit={handleSubmit}>
      <div className="co-fields">
        <label>
          <span className="label">{t('Label alamat', 'Address label')}</span>
          <input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder={t('Gudang / Kantor', 'Warehouse / Office')} required maxLength={80} />
          {fieldError('label')}
        </label>
        <label>
          <span className="label">{t('Nama penerima', 'Recipient name')}</span>
          <input value={form.recipientName} onChange={(e) => set('recipientName', e.target.value)} required maxLength={120} />
          {fieldError('recipientName')}
        </label>
        <label>
          <span className="label">{t('Telepon', 'Phone')}</span>
          <input value={form.phone} onChange={(e) => set('phone', e.target.value)} required maxLength={40} inputMode="tel" />
          {fieldError('phone')}
        </label>
        <label>
          <span className="label">{t('Kode pos', 'Postal code')}</span>
          <input value={form.postalCode || ''} onChange={(e) => set('postalCode', e.target.value)} maxLength={10} inputMode="numeric" />
          {fieldError('postalCode')}
        </label>
        <label className="co-full">
          <span className="label">{t('Alamat lengkap', 'Street address')}</span>
          <textarea value={form.addressLine} onChange={(e) => set('addressLine', e.target.value)} rows={2} required maxLength={1000} placeholder={t('Jalan, nomor, kawasan, patokan', 'Street, number, area, landmark')} />
          {fieldError('addressLine')}
        </label>

        {regionSelect('province', form.provinceCode, provinces, t('Provinsi', 'Province'), provinces.length === 0)}
        {regionSelect('regency', form.regencyCode, regencies, t('Kabupaten / Kota', 'Regency / City'), !form.provinceCode)}
        {regionSelect('district', form.districtCode, districts, t('Kecamatan', 'District'), !form.regencyCode)}
        {regionSelect('village', form.villageCode, villages, t('Kelurahan / Desa', 'Village'), !form.districtCode)}
        {regionError && <p className="form-error co-full" role="alert">{regionError}</p>}

        <div className="co-full addr-map-block">
          <span className="label">{t('Titik lokasi (disarankan)', 'Map location (recommended)')}</span>
          <small className="addr-map-why">{t('Ongkir dihitung dari jarak gudang ke titik ini; tanpa titik, tarif berbasis jarak tidak tersedia.', 'Shipping is calculated from our warehouse to this point; without it, distance-based rates are unavailable.')}</small>
          <div className="addr-geo-search">
            <input
              value={geoQuery}
              onChange={(e) => setGeoQuery(e.target.value)}
              placeholder={t('Cari alamat, kawasan, atau nama tempat', 'Search address, area or place name')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void searchGeo();
                }
              }}
            />
            <button type="button" className="btn btn-line btn-sm" onClick={() => searchGeo()} disabled={geoBusy}>
              <Icon name="compass" size={15} /> {geoBusy ? t('Mencari…', 'Searching…') : t('Cari alamat', 'Search address')}
            </button>
          </div>
          {geoResults.length > 0 && (
            <ul className="addr-geo-results">
              {geoResults.map((r, i) => (
                <li key={`${r.lat}-${r.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setPoint(r.lat, r.lng, true);
                      setGeoResults([]);
                      if (r.address.postcode && !form.postalCode) set('postalCode', r.address.postcode);
                    }}
                  >
                    <Icon name="pin" size={14} /> {r.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddressMap lat={mapPoint.lat} lng={mapPoint.lng} onChange={(lat, lng) => setPoint(lat, lng)} focusKey={focusKey} />
          <div className="addr-map-foot">
            <span className="qty-moq">
              {form.lat != null && form.lng != null
                ? `${form.lat}, ${form.lng}`
                : t('Klik peta atau cari alamat untuk menandai lokasi; marker bisa digeser.', 'Click the map or search to place a pin; the marker can be dragged.')}
            </span>
            <div className="addr-map-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={useMapLocation} disabled={geoBusy || form.lat == null}>
                <Icon name="pin" size={15} /> {t('Gunakan lokasi peta', 'Use map location')}
              </button>
              {form.lat != null && (
                <button type="button" className="link" onClick={() => setForm((prev) => ({ ...prev, lat: null, lng: null }))}>
                  {t('Hapus titik', 'Clear pin')}
                </button>
              )}
            </div>
          </div>
          {geoError && <p className="form-error" role="alert">{geoError}</p>}
          {fieldError('lat') || fieldError('lng')}
        </div>

        <label className="co-full">
          <span className="label">{t('Catatan untuk kurir (opsional)', 'Delivery note (optional)')}</span>
          <input value={form.note || ''} onChange={(e) => set('note', e.target.value)} maxLength={500} placeholder={t('Jam operasional, gerbang, dsb.', 'Opening hours, gate, etc.')} />
          {fieldError('note')}
        </label>
        <label className="co-full addr-check">
          <input type="checkbox" checked={!!form.isDefault} onChange={(e) => set('isDefault', e.target.checked)} disabled={!!initial?.isDefault} />
          <span>{t('Jadikan alamat utama', 'Set as default address')}</span>
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="address-actions" style={{ borderTop: 0, paddingTop: 0 }}>
        <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
          {busy ? t('Menyimpan…', 'Saving…') : <>{submitLabel || t('Simpan alamat', 'Save address')} <Icon name="arrow" /></>}
        </button>
        {onCancel && (
          <button type="button" className="link" onClick={onCancel} disabled={busy}>{t('Batal', 'Cancel')}</button>
        )}
      </div>
    </form>
  );
}
