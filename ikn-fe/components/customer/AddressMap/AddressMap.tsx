'use client';

// Peta Leaflet + tile OpenStreetMap (KEPUTUSAN: gratis tanpa API key). Selalu dimuat lewat
// dynamic import ssr:false karena Leaflet menyentuh `window` saat diimpor.
import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

// Ikon default Leaflet tidak ter-resolve oleh bundler; pasang eksplisit.
const pinIcon = L.icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const INDONESIA_CENTER: [number, number] = [-2.5, 118];

export interface AddressMapProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  /** Naik bila lokasi dipindah dari luar peta (hasil pencarian) agar peta ikut bergeser. */
  focusKey?: number;
  /** Pusat dan zoom awal tanpa pin (bawaan Indonesia zoom 5; PortPicker memakai tampilan dunia). */
  defaultCenter?: [number, number];
  defaultZoom?: number;
  /** Zoom minimum saat peta terbang ke titik yang dipilih dari pencarian (bawaan 15; pelabuhan memakai lebih kecil). */
  focusZoom?: number;
}

function Recenter({ lat, lng, focusKey, focusZoom = 15 }: { lat: number | null; lng: number | null; focusKey?: number; focusZoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), focusZoom), { duration: 0.6 });
    // Hanya saat fokus diminta (pencarian / pilih hasil), bukan setiap drag marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);
  return null;
}

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      // Di zoom dunia peta berulang ke kiri/kanan: wrap() menjaga bujur tetap -180..180.
      const p = e.latlng.wrap();
      onChange(p.lat, p.lng);
    },
  });
  return null;
}

export default function AddressMap({ lat, lng, onChange, focusKey, defaultCenter = INDONESIA_CENTER, defaultZoom = 5, focusZoom = 15 }: AddressMapProps) {
  const hasPoint = lat != null && lng != null;
  const center: [number, number] = hasPoint ? [lat as number, lng as number] : defaultCenter;

  return (
    <MapContainer center={center} zoom={hasPoint ? focusZoom : defaultZoom} scrollWheelZoom={false} className="addr-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={lat} lng={lng} focusKey={focusKey} focusZoom={focusZoom} />
      <ClickToPlace onChange={onChange} />
      {hasPoint && (
        <Marker
          position={[lat as number, lng as number]}
          draggable
          icon={pinIcon}
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng().wrap();
              onChange(p.lat, p.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
