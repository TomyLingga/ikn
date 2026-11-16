// Lapisan tile untuk semua peta Leaflet (ASUMSI A-98). Penyedia (bawaan OSM/Esri, Google Map Tiles API, atau
// layanan XYZ lain) dipilih admin di Pengaturan Situs kartu "Peta"; browser hanya membaca hasil jadinya dari
// GET /geo/map-config dan tidak perlu tahu penyedia mana yang aktif. Komponen peta memakai <MapTiles kind="…">
// (components/MapTiles), bukan <TileLayer> dengan URL sendiri.
import { api } from '@/lib/api';

/** street = peta jalan, satellite = citra satelit polos, hybrid = citra satelit + nama jalan/tempat. */
export type MapLayerKind = 'street' | 'satellite' | 'hybrid';
export type MapProvider = 'default' | 'google' | 'custom';

export interface MapTileLayer {
  /** Templat Leaflet: {z}, {x}, {y}, opsional {s} dan {r}. */
  url: string;
  /** HTML atribusi (sudah aman: teks dari admin di-escape server). */
  attribution: string;
  maxZoom: number;
  subdomains?: string | null;
  /** Merek yang wajib tampil di atas peta (google = logo Google Maps). */
  brand?: string | null;
  /** Endpoint yang menjawab { copyright } untuk area yang sedang tampil (Google); null = atribusi tetap. */
  attributionUrl?: string | null;
  /** Atribusi wajib tampil juga di peta kecil yang biasanya tanpa kontrol atribusi (footer, ubin beranda). */
  attributionRequired?: boolean;
}

export interface MapTileConfig {
  provider: MapProvider;
  /** true = penyedia pilihan gagal (key salah, kuota habis, …) dan lapisan bawaan yang disajikan. */
  fallback: boolean;
  layers: {
    street: MapTileLayer;
    satellite: MapTileLayer;
    /** Lapisan transparan nama tempat di atas `satellite`; null bila penyedia tidak punya. */
    satelliteLabels: MapTileLayer | null;
    /** Citra + label dalam satu tile (Google); bila ada, menggantikan satellite + satelliteLabels. */
    hybrid: MapTileLayer | null;
  };
}

// Wajib sama dengan `ikn.maps.default` di ikn-api/config/ikn.php: dipakai sebelum /geo/map-config menjawab
// terlalu lama dan saat endpoint itu gagal, supaya peta tidak pernah kosong.
export const DEFAULT_MAP_TILES: MapTileConfig = {
  provider: 'default',
  fallback: false,
  layers: {
    street: {
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    },
    satelliteLabels: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      attribution: '',
      maxZoom: 19,
    },
    hybrid: null,
  },
};

/** Pengaturan grup `maps` (privat, GET/PUT /admin/site-settings). google_api_key = "********" bila tersimpan. */
export interface MapSettings {
  provider: MapProvider;
  google_api_key: string;
  custom_street_url: string;
  custom_satellite_url: string;
  custom_attribution: string;
  custom_max_zoom: number;
}

export const EMPTY_MAP_SETTINGS: MapSettings = {
  provider: 'default',
  google_api_key: '',
  custom_street_url: '',
  custom_satellite_url: '',
  custom_attribution: '',
  custom_max_zoom: 19,
};

/** Hasil POST /admin/site-settings/maps-test. */
export interface MapTestResult {
  provider: MapProvider;
  ok: boolean;
  results: { layer: MapLayerKind; ok: boolean; message: string }[];
  /** Lapisan untuk pratinjau: milik penyedia yang diuji, atau bawaan (fallback) bila ujinya gagal. */
  config: MapTileConfig;
}

// Token sesi Google berlaku sekitar dua minggu dan server memperbaruinya sehari sebelum habis; konfigurasi di
// memori disegarkan lebih sering dari itu supaya tab yang lama terbuka tidak memegang token usang.
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

let cached: MapTileConfig | null = null;
let cachedAt = 0;
let pending: Promise<MapTileConfig> | null = null;

function isLayer(value: unknown): value is MapTileLayer {
  const layer = value as MapTileLayer | null;
  return !!layer && typeof layer.url === 'string' && layer.url.includes('{z}') && Number.isFinite(Number(layer.maxZoom));
}

/** Jawaban API yang bentuknya tidak dikenal diperlakukan sebagai gagal (pakai bawaan). */
function parseConfig(raw: unknown): MapTileConfig | null {
  const config = raw as MapTileConfig | null;
  if (!config || !config.layers || !isLayer(config.layers.street) || !isLayer(config.layers.satellite)) return null;
  return {
    provider: config.provider === 'google' || config.provider === 'custom' ? config.provider : 'default',
    fallback: Boolean(config.fallback),
    layers: {
      street: config.layers.street,
      satellite: config.layers.satellite,
      satelliteLabels: isLayer(config.layers.satelliteLabels) ? config.layers.satelliteLabels : null,
      hybrid: isLayer(config.layers.hybrid) ? config.layers.hybrid : null,
    },
  };
}

/** Konfigurasi yang sudah ada di memori (null sebelum permintaan pertama selesai). */
export function cachedMapTiles(): MapTileConfig | null {
  return cached;
}

/** Ambil GET /geo/map-config sekali per sesi halaman. Tidak pernah gagal: galat = lapisan bawaan. */
export function loadMapTiles(): Promise<MapTileConfig> {
  if (cached && Date.now() - cachedAt < MAX_AGE_MS) return Promise.resolve(cached);
  if (!pending) {
    pending = api<unknown>('/geo/map-config')
      .then((raw) => {
        cached = parseConfig(raw) ?? DEFAULT_MAP_TILES;
        cachedAt = Date.now();
        return cached;
      })
      // Gagal: pakai yang terakhir diketahui (atau bawaan) tanpa menyimpannya, supaya dicoba lagi berikutnya.
      .catch(() => cached ?? DEFAULT_MAP_TILES)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/** Buang konfigurasi di memori (setelah admin menyimpan pengaturan peta). */
export function resetMapTiles(): void {
  cached = null;
  cachedAt = 0;
}

/** Lapisan untuk satu jenis peta, urut dari dasar ke atas. */
export function layersFor(config: MapTileConfig, kind: MapLayerKind): MapTileLayer[] {
  const { street, satellite, satelliteLabels, hybrid } = config.layers;
  if (kind === 'street') return [street];
  if (kind === 'satellite') return [satellite];
  if (hybrid) return [hybrid];
  return satelliteLabels ? [satellite, satelliteLabels] : [satellite];
}

export interface MapViewport {
  zoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/**
 * Teks hak cipta data untuk area yang tampil (Google: wajib ditampilkan bersama tile). Permintaan ini langsung
 * ke penyedia tile, bukan ke API IKN, jadi tidak lewat `api()`. null = gagal, pemanggil memakai atribusi tetap.
 */
export async function fetchTileCopyright(attributionUrl: string, view: MapViewport, signal?: AbortSignal): Promise<string | null> {
  const whole = view.east - view.west >= 360;
  const query = new URLSearchParams({
    zoom: String(Math.min(22, Math.max(0, Math.round(view.zoom)))),
    north: String(Math.min(85, view.north)),
    south: String(Math.max(-85, view.south)),
    east: String(whole ? 179.99 : wrapLng(view.east)),
    west: String(whole ? -179.99 : wrapLng(view.west)),
  });
  try {
    const response = await fetch(`${attributionUrl}${attributionUrl.includes('?') ? '&' : '?'}${query.toString()}`, { signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { copyright?: unknown };
    return typeof body.copyright === 'string' && body.copyright.trim() ? body.copyright.trim() : null;
  } catch {
    return null;
  }
}
