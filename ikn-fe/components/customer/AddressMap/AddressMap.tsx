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
}

function Recenter({ lat, lng, focusKey }: { lat: number | null; lng: number | null; focusKey?: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat == null || lng == null) return;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
    // Hanya saat fokus diminta (pencarian / pilih hasil), bukan setiap drag marker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);
  return null;
}

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function AddressMap({ lat, lng, onChange, focusKey }: AddressMapProps) {
  const hasPoint = lat != null && lng != null;
  const center: [number, number] = hasPoint ? [lat as number, lng as number] : INDONESIA_CENTER;

  return (
    <MapContainer center={center} zoom={hasPoint ? 15 : 5} scrollWheelZoom={false} className="addr-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter lat={lat} lng={lng} focusKey={focusKey} />
      <ClickToPlace onChange={onChange} />
      {hasPoint && (
        <Marker
          position={[lat as number, lng as number]}
          draggable
          icon={pinIcon}
          eventHandlers={{
            dragend: (e) => {
              const p = (e.target as L.Marker).getLatLng();
              onChange(p.lat, p.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}
