'use client';

// Peta dunia pelanggan (Leaflet + tile Esri World Light Gray, tanpa API key): titik per negara berwarna menurut
// kawasan dan garis putus-putus melengkung dari titik asal (Pelabuhan Belawan). Selalu dimuat lewat dynamic import
// ssr:false (index.tsx) karena Leaflet menyentuh `window` saat diimpor.
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapCountry {
  region: string;
  country: string;
  lat: number;
  lng: number;
  customers: string[];
}

export interface CustomerWorldMapProps {
  countries: MapCountry[];
  colors: Record<string, string>;
  origin: { lat: number; lng: number; label: string };
}

// Kurva kuadratik antara dua titik (offset tegak lurus ~18% panjang garis) agar rute terlihat seperti lintasan kapal.
function arc(a: [number, number], b: [number, number]): [number, number][] {
  const [y1, x1] = a;
  const [y2, x2] = b;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const cx = mx - dy * 0.18;
  const cy = my + dx * 0.18;
  const pts: [number, number][] = [];
  for (let t = 0; t <= 1.0001; t += 0.05) {
    const u = 1 - t;
    pts.push([u * u * y1 + 2 * u * t * cy + t * t * y2, u * u * x1 + 2 * u * t * cx + t * t * x2]);
  }
  return pts;
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  const key = JSON.stringify(points);
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [36, 36] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

export default function CustomerWorldMap({ countries, colors, origin }: CustomerWorldMapProps) {
  // Negara di benua Amerika digeser +360° agar rute dari Indonesia melintasi Pasifik (jalur terpendek).
  const placed = countries.map((c) => ({ ...c, lng: c.lng < -30 ? c.lng + 360 : c.lng }));
  const lngs = [origin.lng, ...placed.map((c) => c.lng)];
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

  return (
    <div className="cmap-map">
      <MapContainer
        center={[18, centerLng]}
        zoom={2}
        minZoom={1}
        maxZoom={6}
        zoomSnap={0.25}
        scrollWheelZoom={false}
        worldCopyJump={false}
        style={{ width: '100%', height: '100%' }}
      >
        <Fit points={[[origin.lat, origin.lng], ...placed.map((c) => [c.lat, c.lng] as [number, number])]} />
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxZoom={16}
        />
        {placed.map((c) => (
          <Polyline
            key={`arc-${c.country}`}
            positions={arc([origin.lat, origin.lng], [c.lat, c.lng])}
            pathOptions={{ color: colors[c.region] ?? '#1769aa', weight: 1.4, opacity: 0.65, dashArray: '3 6' }}
          />
        ))}
        {placed.map((c) => (
          <CircleMarker
            key={c.country}
            center={[c.lat, c.lng]}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: colors[c.region] ?? '#1769aa', fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <strong>{c.country}</strong>
              <br />
              {c.customers.join(', ')}
            </Tooltip>
          </CircleMarker>
        ))}
        <CircleMarker center={[origin.lat, origin.lng]} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#102d50', fillOpacity: 1 }}>
          <Tooltip direction="right" offset={[8, 0]} permanent className="cmap-origin-tip">
            {origin.label}
          </Tooltip>
        </CircleMarker>
      </MapContainer>
    </div>
  );
}
