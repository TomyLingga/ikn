'use client';

// Peta satelit kecil untuk ubin "Lokasi fasilitas" di hero kisi: tidak bisa digeser/zoom (menyatu dengan layout),
// tetapi tiap pin bisa diklik untuk memilih lokasi (kartu info dirender HeroSection di luar peta agar tidak terpotong).
import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import MapTiles, { useMapTiles } from '@/components/MapTiles';
import { layersFor } from '@/lib/map-tiles';

export interface TilePin {
  /** Indeks lokasi di daftar fasilitas (dipakai onSelect / active). */
  index: number;
  name: string;
  lat: number;
  lng: number;
}

const icon = (active: boolean) =>
  L.divIcon({ className: `hgrid-map-pin${active ? ' is-active' : ''}`, html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 14] });

// `credits` = penyedia tile mewajibkan logo/atribusi di peta (mis. Google): keduanya ditumpuk di kanan bawah, jadi
// pin diberi ruang lebih di bawah agar tidak tertutup.
function Fit({ pins, credits }: { pins: TilePin[]; credits: boolean }) {
  const map = useMap();
  const key = pins.map((p) => `${p.lat},${p.lng}`).join('|');
  useEffect(() => {
    // Ukur ulang setelah ubin selesai ditata (dan saat ukurannya berubah), lalu muat semua pin.
    const fit = () => {
      map.invalidateSize();
      // Pin ditempatkan di kuadran kanan bawah ubin: label/angka di atas dan daftar nama di kiri bawah tidak tertimpa.
      const size = map.getSize();
      if (pins.length > 1) map.fitBounds(pins.map((p) => [p.lat, p.lng] as [number, number]), { paddingTopLeft: [size.x * 0.58, size.y * 0.42], paddingBottomRight: [22, credits ? 62 : 22] });
      else if (pins[0]) map.setView([pins[0].lat, pins[0].lng], 11);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(map.getContainer());
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key, credits]);
  return null;
}

export default function HeroTileMap({ pins, active, onSelect }: { pins: TilePin[]; active: number | null; onSelect: (index: number) => void }) {
  const tiles = useMapTiles();
  const credits = !!tiles && layersFor(tiles, 'satellite').some((layer) => layer.brand || layer.attributionRequired);
  if (pins.length === 0) return null;
  return (
    <MapContainer
      center={[pins[0]!.lat, pins[0]!.lng]}
      zoom={10}
      dragging={false}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      boxZoom={false}
      keyboard={false}
      attributionControl={false}
      style={{ width: '100%', height: '100%' }}
    >
      {/* Label dan angka ubin di atas, daftar lokasi di kiri bawah: logo penyedia tile (bila ada) di kanan bawah,
          di atas baris atribusi. */}
      <MapTiles kind="satellite" maxZoom={18} brandPosition="bottomright" />
      <Fit pins={pins} credits={credits} />
      {pins.map((p) => (
        // Pin hanya untuk mouse/sentuh; pengguna keyboard memakai daftar nama lokasi (tombol) di ubin.
        <Marker
          key={p.index}
          position={[p.lat, p.lng]}
          icon={icon(active === p.index)}
          keyboard={false}
          title={p.name}
          eventHandlers={{ click: () => onSelect(p.index) }}
        />
      ))}
    </MapContainer>
  );
}
