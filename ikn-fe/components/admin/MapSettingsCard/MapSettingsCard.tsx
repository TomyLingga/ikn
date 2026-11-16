'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AdminCard } from '@/components/admin/AdminPage';
import { firstError, type FieldErrors } from '@/components/admin/cms';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import NumberInput from '@/components/NumberInput';
import Select from '@/components/Select';
import Spinner from '@/components/Spinner';
import { api, ApiError, errorMessage } from '@/lib/api';
import { loadMapTiles, type MapLayerKind, type MapProvider, type MapSettings, type MapTestResult, type MapTileConfig } from '@/lib/map-tiles';
import styles from './MapSettingsCard.module.css';

const MapPreview = dynamic(() => import('./MapPreview'), {
  ssr: false,
  loading: () => (
    <div className={styles.previewLoading}>
      <Spinner size={24} />
    </div>
  ),
});

interface Props {
  value: MapSettings;
  onChange: (patch: Partial<MapSettings>) => void;
  errors: FieldErrors;
  /** Naik setiap pengaturan berhasil disimpan: pratinjau memuat ulang lapisan yang berlaku di situs. */
  version?: number;
}

/**
 * Kartu "Peta" di Pengaturan Situs (ASUMSI A-98): penyedia tile untuk semua peta, API key Google atau templat XYZ,
 * tombol "Uji penyedia peta" (POST /admin/site-settings/maps-test memakai isian form walau belum disimpan), dan peta
 * pratinjau yang memakai lapisan hasil uji.
 */
export default function MapSettingsCard({ value, onChange, errors, version = 0 }: Props) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<MapTestResult | null>(null);
  const [failure, setFailure] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [kind, setKind] = useState<MapLayerKind>('street');
  const [site, setSite] = useState<MapTileConfig | null>(null);
  const [origin, setOrigin] = useState('');

  const google = value.provider === 'google';
  const custom = value.provider === 'custom';

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Lapisan yang sedang berlaku di situs (untuk peringatan bila penyedia tersimpan gagal).
  useEffect(() => {
    let alive = true;
    void loadMapTiles().then((config) => {
      if (alive) setSite(config);
    });
    return () => {
      alive = false;
    };
  }, [version]);

  // Hasil uji hanya berlaku untuk isian yang diuji.
  useEffect(() => {
    setResult(null);
    setFailure('');
  }, [value.provider, value.google_api_key, value.custom_street_url, value.custom_satellite_url, value.custom_attribution, value.custom_max_zoom, version]);

  async function runTest() {
    if (testing) return;
    setTesting(true);
    setResult(null);
    setFailure('');
    try {
      setResult(await api<MapTestResult>('/admin/site-settings/maps-test', { method: 'POST', body: { maps: value } }));
    } catch (err) {
      setFailure(
        err instanceof ApiError && err.status === 422 && Object.keys(err.errors).length
          ? Object.values(err.errors)
              .flat()
              .join(' ')
          : errorMessage(err),
      );
    } finally {
      setTesting(false);
    }
  }

  const fieldError = (key: keyof MapSettings) => firstError(errors, `maps.${key}`);
  const layerName = (layer: MapLayerKind) =>
    layer === 'street' ? t('Peta jalan', 'Street map') : layer === 'satellite' ? t('Citra satelit', 'Satellite imagery') : t('Satelit + nama tempat', 'Satellite + place names');
  const url = (key: 'custom_street_url' | 'custom_satellite_url', label: string, placeholder: string, hint: string) => (
    <label>
      <span className="field-label">{label}</span>
      <input
        value={value[key]}
        onChange={(e) => onChange({ [key]: e.target.value.trim() })}
        placeholder={placeholder}
        maxLength={500}
        className="mono"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
      />
      <small className="admin-field-hint">{hint}</small>
      {fieldError(key) && <small className="cms-field-error">{fieldError(key)}</small>}
    </label>
  );

  return (
    <AdminCard
      title={t('Peta', 'Maps')}
      desc={t(
        'Penyedia gambar peta untuk semua peta: alamat customer, pelabuhan tujuan, lokasi pabrik, halaman Kontak, footer, beranda, dan peta pelanggan. Pencarian alamat tidak terpengaruh.',
        'The map image provider for every map: customer addresses, destination ports, factory locations, the Contact page, the footer, the home page, and the customer map. Address search is not affected.',
      )}
    >
      <div className="admin-form">
        <label>
          <span className="field-label">{t('Penyedia peta', 'Map provider')}</span>
          <Select value={value.provider} onChange={(e) => onChange({ provider: e.target.value as MapProvider })}>
            <option value="default">{t('Bawaan: OpenStreetMap + Esri (gratis, tanpa API key)', 'Default: OpenStreetMap + Esri (free, no API key)')}</option>
            <option value="google">{t('Google Maps (Map Tiles API, perlu API key)', 'Google Maps (Map Tiles API, needs an API key)')}</option>
            <option value="custom">{t('Layanan lain dengan URL tile (MapTiler, Mapbox, HERE, Stadia, ...)', 'Another service by tile URL (MapTiler, Mapbox, HERE, Stadia, ...)')}</option>
          </Select>
          <small className="admin-field-hint">
            {t(
              'Berlaku setelah disimpan. Bila penyedia yang dipilih menolak (key salah, penagihan mati, kuota habis), situs otomatis kembali memakai peta bawaan sehingga peta tidak pernah kosong.',
              'Applies once saved. If the chosen provider refuses (wrong key, billing off, quota used up), the site automatically goes back to the default map, so a map is never blank.',
            )}
          </small>
          {fieldError('provider') && <small className="cms-field-error">{fieldError('provider')}</small>}
        </label>

        {google && (
          <>
            <label>
              <span className="field-label">{t('API key Google Maps', 'Google Maps API key')}</span>
              <div className="admin-input-affix">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={value.google_api_key}
                  onChange={(e) => onChange({ google_api_key: e.target.value.trim() })}
                  autoComplete="new-password"
                  maxLength={255}
                  className="mono"
                  spellCheck={false}
                />
                <button type="button" className="btn btn-line btn-sm" onClick={() => setShowKey((s) => !s)} aria-label={showKey ? t('Sembunyikan', 'Hide') : t('Tampilkan', 'Show')}>
                  <Icon name={showKey ? 'eyeOff' : 'eye'} size={15} />
                </button>
              </div>
              <small className="admin-field-hint">
                {t('Key tersimpan tidak ditampilkan (********). Biarkan apa adanya bila tidak diganti.', 'The saved key is not shown (********). Leave it as is to keep it.')}
              </small>
              {fieldError('google_api_key') && <small className="cms-field-error">{fieldError('google_api_key')}</small>}
            </label>
            <ol className={styles.steps}>
              <li>{t('Buka Google Cloud Console, pilih proyek, lalu pastikan akun penagihan (billing) proyek itu aktif.', 'Open the Google Cloud Console, pick the project, and make sure its billing account is active.')}</li>
              <li>{t('Di API Library, aktifkan "Map Tiles API".', 'In the API Library, enable "Map Tiles API".')}</li>
              <li>{t('Di Google Maps Platform → Keys & Credentials, buat API key.', 'Under Google Maps Platform → Keys & Credentials, create an API key.')}</li>
              <li>
                {t('Batasi key itu. Application restrictions: Websites, isi ', 'Restrict that key. Application restrictions: Websites, enter ')}
                <code>{origin ? `${origin}/*` : 'https://domain-situs/*'}</code>
                {t('. API restrictions: hanya Map Tiles API.', '. API restrictions: Map Tiles API only.')}
              </li>
              <li>
                {t(
                  'Key ikut terkirim ke browser pengunjung di alamat gambar peta, jadi pembatasan di langkah 4 wajib agar key tidak bisa dipakai situs lain.',
                  'The key reaches visitors’ browsers inside the map image addresses, so the restriction in step 4 is required to stop other sites from using it.',
                )}
              </li>
            </ol>
          </>
        )}

        {custom && (
          <>
            {url(
              'custom_street_url',
              t('URL tile peta jalan', 'Street map tile URL'),
              'https://api.maptiler.com/maps/streets-v4/256/{z}/{x}/{y}{r}.png?key=...',
              t(
                'Dipakai peta alamat, pelabuhan, dan lokasi pabrik. Harus https, memuat {z}, {x}, {y}, dan menyajikan tile 256 px. {s} (subdomain a, b, c) dan {r} (layar retina) boleh dipakai. Kosong = peta jalan bawaan.',
                'Used by the address, port and factory location maps. Must be https, contain {z}, {x}, {y}, and serve 256 px tiles. {s} (subdomains a, b, c) and {r} (retina screens) are allowed. Empty = default street map.',
              ),
            )}
            {url(
              'custom_satellite_url',
              t('URL tile citra satelit', 'Satellite tile URL'),
              'https://api.maptiler.com/maps/ID_PETA/256/{z}/{x}/{y}{r}.jpg?key=...',
              t(
                'Dipakai halaman Kontak, footer, beranda, dan peta pelanggan. Pilih gaya "hybrid" dari penyedia bila nama jalan dan tempat ingin tampil di atas citra. Kosong = citra satelit bawaan.',
                'Used by the Contact page, footer, home page and customer map. Pick the provider’s "hybrid" style if street and place names should show on the imagery. Empty = default satellite imagery.',
              ),
            )}
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Teks atribusi peta', 'Map attribution text')}</span>
                <input value={value.custom_attribution} onChange={(e) => onChange({ custom_attribution: e.target.value })} placeholder="© MapTiler © OpenStreetMap contributors" maxLength={300} />
                <small className="admin-field-hint">
                  {t('Teks hak cipta yang diwajibkan penyedia, tampil di sudut peta. Teks polos, tanpa HTML.', 'The copyright text the provider requires, shown in the map corner. Plain text, no HTML.')}
                </small>
                {fieldError('custom_attribution') && <small className="cms-field-error">{fieldError('custom_attribution')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Zoom maksimum peta', 'Maximum map zoom')}</span>
                <NumberInput min={1} max={22} step={1} value={value.custom_max_zoom} onChange={(e) => onChange({ custom_max_zoom: Number(e.target.value) || 0 })} className="mono" />
                <small className="admin-field-hint">
                  {t('Tingkat zoom terdalam yang disediakan penyedia (1–22). Lihat dokumentasi penyedia; umumnya 18 sampai 20.', 'The deepest zoom level the provider serves (1–22). See the provider documentation; usually 18 to 20.')}
                </small>
                {fieldError('custom_max_zoom') && <small className="cms-field-error">{fieldError('custom_max_zoom')}</small>}
              </label>
            </div>
          </>
        )}

        <div className={styles.previewHead}>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void runTest()} disabled={testing}>
            <Icon name="refresh" size={15} /> {testing ? t('Menguji...', 'Testing...') : t('Uji penyedia peta', 'Test map provider')}
          </button>
          <div className={styles.kinds} role="group" aria-label={t('Jenis peta pratinjau', 'Preview map type')}>
            {(['street', 'hybrid'] as const).map((option) => (
              <button key={option} type="button" className={`btn btn-sm ${kind === option ? 'btn-solid' : 'btn-line'}`} aria-pressed={kind === option} onClick={() => setKind(option)}>
                {option === 'street' ? t('Peta jalan', 'Street map') : t('Satelit', 'Satellite')}
              </button>
            ))}
          </div>
        </div>
        <p className="admin-field-hint">
          {t(
            'Uji memakai isian di atas walaupun belum disimpan: server meminta satu gambar peta contoh dari penyedia dan melaporkan hasilnya per lapisan. Tidak ada yang disimpan.',
            'The test uses the values above even before saving: the server asks the provider for one sample map image and reports the result per layer. Nothing is saved.',
          )}
        </p>

        {failure && (
          <p className="form-error" role="status">
            {failure}
          </p>
        )}
        {result && (
          <ul className={styles.results} role="status">
            {result.results.map((row) => (
              <li key={row.layer} className={`${styles.result} ${row.ok ? styles.ok : styles.fail}`}>
                <span className={styles.mark}>
                  <Icon name={row.ok ? 'checkCircle' : 'alert'} size={18} />
                </span>
                <span>
                  <strong>{layerName(row.layer)}</strong>
                  {row.message}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!result && site?.fallback && (
          <p className="form-error" role="status">
            {t(
              'Penyedia yang tersimpan sedang menolak permintaan, jadi situs memakai peta bawaan. Tekan "Uji penyedia peta" untuk melihat alasannya.',
              'The saved provider is refusing requests, so the site is using the default map. Press "Test map provider" to see why.',
            )}
          </p>
        )}

        <div className={styles.preview}>
          <MapPreview key={`${version}-${result ? 'test' : 'site'}`} kind={kind} config={result?.config ?? null} />
        </div>
        <p className={styles.previewNote}>
          {result
            ? result.ok
              ? t('Pratinjau: lapisan dari penyedia yang baru diuji (belum disimpan).', 'Preview: layers from the provider just tested (not saved yet).')
              : t('Pratinjau: peta bawaan, karena penyedia yang diuji gagal.', 'Preview: the default map, because the tested provider failed.')
            : t('Pratinjau: peta yang sedang berlaku di situs.', 'Preview: the map currently used on the site.')}
        </p>
      </div>
    </AdminCard>
  );
}
