'use client';

// Peta lokasi kontak (Leaflet + citra satelit Esri World Imagery + lapisan nama tempat, tanpa API key). Selalu dimuat lewat dynamic import ssr:false
// (lihat index.tsx) karena Leaflet menyentuh `window` saat diimpor.
import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { mapsUrl, type MapPoint } from '@/components/cms/utils';

const pinIcon = L.icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface ContactMapProps {
  points: MapPoint[];
  /** Footer: peta kecil tanpa interaksi, satu pin, tautan ke Google Maps. */
  compact?: boolean;
  lang?: 'id' | 'en';
}

function Fit({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const first = points[0];
    if (!first) return;
    if (points.length > 1) {
      map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [48, 48], maxZoom: 13 });
    } else {
      map.setView([first.lat, first.lng], 16);
    }
  }, [points, map]);
  return null;
}

export default function ContactMap({ points, compact = false, lang = 'id' }: ContactMapProps) {
  const first = points[0];
  if (!first) return null;
  const openLabel = lang === 'en' ? 'Open in Google Maps' : 'Buka di Google Maps';

  return (
    <div className={compact ? 'footer-map' : 'contact-map'}>
      <MapContainer
        center={[first.lat, first.lng]}
        zoom={compact ? 14 : 12}
        scrollWheelZoom={false}
        dragging={!compact}
        zoomControl={!compact}
        doubleClickZoom={!compact}
        touchZoom={!compact}
        keyboard={!compact}
        attributionControl={!compact}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Tampilan satelit (permintaan pemilik 2026-11-04); lapisan kedua menambah nama jalan/tempat di atas citra. */}
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={19}
        />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
        <Fit points={points} />
        {points.map((p) => (
          <Marker key={`${p.lat},${p.lng}`} position={[p.lat, p.lng]} icon={pinIcon} title={p.name}>
            {!compact && (
              <Popup>
                <strong>{p.name}</strong>
                {p.address && (
                  <>
                    <br />
                    {p.address}
                  </>
                )}
                <br />
                <a href={mapsUrl(p.lat, p.lng)} target="_blank" rel="noreferrer">
                  {openLabel} ↗
                </a>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
      {/* Lebih dari satu titik: tautan peta per lokasi ada di daftar alamat pemanggil (mis. footer). */}
      {compact && points.length === 1 && (
        <a className="footer-map-link" href={mapsUrl(first.lat, first.lng)} target="_blank" rel="noreferrer">
          {openLabel} ↗
        </a>
      )}
    </div>
  );
}
