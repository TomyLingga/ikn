'use client';

// Peta pratinjau kecil di kartu "Peta" (Pengaturan Situs). Dimuat lewat dynamic import ssr:false karena Leaflet
// menyentuh `window` saat diimpor.
import { MapContainer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapTiles from '@/components/MapTiles';
import type { MapLayerKind, MapTileConfig } from '@/lib/map-tiles';

// Pusat Kota Medan, lokasi perusahaan.
const CENTER: [number, number] = [3.5952, 98.6722];

export interface MapPreviewProps {
  kind: MapLayerKind;
  /** Lapisan hasil uji; null = konfigurasi situs yang sedang berlaku. */
  config: MapTileConfig | null;
}

export default function MapPreview({ kind, config }: MapPreviewProps) {
  return (
    <MapContainer center={CENTER} zoom={12} scrollWheelZoom={false} style={{ width: '100%', height: '100%' }}>
      <MapTiles kind={kind} config={config} />
    </MapContainer>
  );
}
