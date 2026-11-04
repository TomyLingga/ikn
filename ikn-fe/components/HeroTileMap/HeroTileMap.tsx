'use client';

// Peta satelit kecil tanpa interaksi untuk ubin hero kisi (2026-11-04): pin (tanpa label) tiap lokasi dari blok kontak,
// diperbesar agar semua pin terlihat. Hanya latar dekoratif; tautan lokasi lengkap ada di halaman Kontak.
import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapPoint } from '@/components/cms/utils';

const pin = L.divIcon({ className: 'hgrid-map-pin', html: '<span></span>', iconSize: [16, 16], iconAnchor: [8, 8] });

function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    // Ukur ulang setelah ubin selesai ditata (dan saat ukurannya berubah), lalu muat semua pin.
    const fit = () => {
      map.invalidateSize();
      if (points.length > 1) map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [36, 36] });
      else if (points[0]) map.setView([points[0].lat, points[0].lng], 12);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map, points]);
  return null;
}

export default function HeroTileMap({ points }: { points: MapPoint[] }) {
  if (points.length === 0) return null;
  return (
    <MapContainer
      center={[points[0]!.lat, points[0]!.lng]}
      zoom={10}
      dragging={false}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={18} />
      <Fit points={points} />
      {points.map((p) => (
        <Marker key={`${p.lat},${p.lng}`} position={[p.lat, p.lng]} icon={pin} interactive={false} title={p.name} />
      ))}
    </MapContainer>
  );
}
