'use client';

// Lapisan tile untuk semua peta Leaflet (ASUMSI A-98). Satu-satunya tempat <TileLayer> dipasang: URL, atribusi,
// dan batas zoom datang dari lib/map-tiles (GET /geo/map-config), jadi mengganti penyedia peta cukup dari
// Pengaturan Situs. Dipakai di dalam <MapContainer>.
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { TileLayer, useMap } from 'react-leaflet';
import {
  DEFAULT_MAP_TILES,
  cachedMapTiles,
  fetchTileCopyright,
  layersFor,
  loadMapTiles,
  type MapLayerKind,
  type MapTileConfig,
  type MapTileLayer,
} from '@/lib/map-tiles';
import styles from './MapTiles.module.css';

// Logo resmi dari Google_Maps_Attribution_Assets (tidak diubah): varian beroutline untuk dipasang di atas peta.
const GOOGLE_LOGO = {
  light: '/img/maps/google-maps-logo-light-outline.svg', // huruf gelap + garis luar terang, untuk peta jalan
  dark: '/img/maps/google-maps-logo-dark-outline.svg', // huruf putih + garis luar gelap, untuk citra satelit
};

// Bila /geo/map-config belum menjawab selama ini, peta memakai tile bawaan dulu lalu berganti saat jawaban tiba.
const SLOW_MS = 2500;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Konfigurasi tile aktif; null selagi permintaan pertama berjalan (peta tampil tanpa tile sesaat). */
export function useMapTiles(): MapTileConfig | null {
  const [config, setConfig] = useState<MapTileConfig | null>(cachedMapTiles);

  useEffect(() => {
    let alive = true;
    const slow = window.setTimeout(() => {
      if (alive) setConfig((current) => current ?? DEFAULT_MAP_TILES);
    }, SLOW_MS);
    void loadMapTiles().then((next) => {
      window.clearTimeout(slow);
      if (alive) setConfig(next);
    });
    return () => {
      alive = false;
      window.clearTimeout(slow);
    };
  }, []);

  return config;
}

export interface MapTilesProps {
  /** street = peta jalan, satellite = citra polos, hybrid = citra + nama jalan/tempat. */
  kind: MapLayerKind;
  /** Batas zoom peta ini; bawaan = batas lapisan. */
  maxZoom?: number;
  /** Lapisan dari luar (pratinjau di admin); tanpa ini memakai konfigurasi situs. */
  config?: MapTileConfig | null;
  /** Sudut untuk logo penyedia (Google); pindahkan bila sudut kiri bawah dipakai elemen lain. */
  brandPosition?: L.ControlPosition;
}

// Server hanya tahu penyedia gagal saat membuat token sesi. Bila browser yang ditolak (mis. kuota harian Google
// habis, pembatasan referrer salah), tile gagal satu per satu: setelah sekian galat tanpa satu tile pun berhasil,
// peta situs beralih ke tile bawaan sampai halaman dimuat ulang. Tidak berlaku untuk pratinjau admin (`config`).
const TILE_ERROR_LIMIT = 4;
const tileStats = new Map<string, { loaded: number; failed: number }>();
const brokenUrls = new Set<string>();
const brokenListeners = new Set<() => void>();

function noteTile(url: string, ok: boolean) {
  const stats = tileStats.get(url) ?? { loaded: 0, failed: 0 };
  if (ok) stats.loaded += 1;
  else stats.failed += 1;
  tileStats.set(url, stats);
  if (!ok && stats.loaded === 0 && stats.failed >= TILE_ERROR_LIMIT && !brokenUrls.has(url)) {
    brokenUrls.add(url);
    brokenListeners.forEach((listener) => listener());
  }
}

function useBrokenTiles(): number {
  const [version, setVersion] = useState(brokenUrls.size);
  useEffect(() => {
    const listener = () => setVersion(brokenUrls.size);
    brokenListeners.add(listener);
    return () => {
      brokenListeners.delete(listener);
    };
  }, []);
  return version;
}

export default function MapTiles({ kind, maxZoom, config, brandPosition = 'bottomleft' }: MapTilesProps) {
  const site = useMapTiles();
  useBrokenTiles();
  const active = config ?? site;
  if (!active) return null;

  let layers = layersFor(active, kind);
  if (!config && layers.some((layer) => brokenUrls.has(layer.url))) layers = layersFor(DEFAULT_MAP_TILES, kind);
  const watch = !config && active.provider !== 'default';

  return (
    <>
      {layers.map((layer, index) => (
        <TileLayer
          // key = URL: atribusi dan subdomain hanya dibaca Leaflet saat lapisan dibuat.
          key={layer.url}
          url={layer.url}
          attribution={layer.attributionUrl ? undefined : layer.attribution || undefined}
          maxZoom={Math.min(layer.maxZoom, maxZoom ?? layer.maxZoom)}
          zIndex={index + 1}
          {...(layer.subdomains ? { subdomains: layer.subdomains } : {})}
          {...(watch ? { eventHandlers: { tileload: () => noteTile(layer.url, true), tileerror: () => noteTile(layer.url, false) } } : {})}
        />
      ))}
      <TileCredits layers={layers} dark={kind !== 'street'} position={brandPosition} />
    </>
  );
}

// Kewajiban atribusi penyedia berbayar: kontrol atribusi juga di peta kecil yang biasanya tanpa atribusi, teks hak
// cipta per area dari `attributionUrl`, dan logo penyedia di atas peta.
function TileCredits({ layers, dark, position }: { layers: MapTileLayer[]; dark: boolean; position: L.ControlPosition }) {
  const map = useMap();
  const required = layers.some((layer) => layer.attributionRequired || layer.brand);
  const brand = layers.find((layer) => layer.brand)?.brand ?? null;
  const dynamic = layers.find((layer) => layer.attributionUrl);
  const dynamicUrl = dynamic?.attributionUrl ?? null;
  const staticText = dynamic?.attribution ?? '';

  useEffect(() => {
    if (!required || map.attributionControl) return;
    // onAdd mengisi atribusi lapisan yang sudah ada dan mendengarkan lapisan berikutnya.
    const control = L.control.attribution({ prefix: false }).addTo(map);
    return () => {
      control.remove();
      if (map.attributionControl === control) Reflect.deleteProperty(map, 'attributionControl');
    };
  }, [map, required]);

  useEffect(() => {
    const control = map.attributionControl;
    if (!dynamicUrl || !control) return;
    let current = staticText;
    let disposed = false;
    let timer = 0;
    let request: AbortController | null = null;
    if (current) control.addAttribution(current);

    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        request?.abort();
        request = new AbortController();
        const bounds = map.getBounds();
        const view = { zoom: map.getZoom(), north: bounds.getNorth(), south: bounds.getSouth(), east: bounds.getEast(), west: bounds.getWest() };
        void fetchTileCopyright(dynamicUrl, view, request.signal).then((text) => {
          const next = text ? escapeHtml(text) : '';
          if (disposed || !next || next === current) return;
          if (current) control.removeAttribution(current);
          control.addAttribution(next);
          current = next;
        });
      }, 500);
    };

    map.on('moveend', refresh);
    map.whenReady(refresh);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      request?.abort();
      map.off('moveend', refresh);
      if (current) control.removeAttribution(current);
    };
  }, [map, dynamicUrl, staticText, required]);

  useEffect(() => {
    if (brand !== 'google') return;
    const Brand = L.Control.extend({
      onAdd() {
        const box = L.DomUtil.create('div', styles.brand);
        const logo = L.DomUtil.create('img', '', box);
        logo.src = dark ? GOOGLE_LOGO.dark : GOOGLE_LOGO.light;
        logo.alt = 'Google Maps';
        return box;
      },
    });
    const control = new Brand({ position }).addTo(map);
    // Logo dan baris atribusi berbagi tepi bawah peta: atribusi dipersempit agar tidak menimpa logo.
    const shared = position === 'bottomleft' ? styles.brandBottomLeft : '';
    if (shared) map.getContainer().classList.add(shared);
    return () => {
      control.remove();
      if (shared) map.getContainer().classList.remove(shared);
    };
  }, [map, brand, dark, position]);

  return null;
}
