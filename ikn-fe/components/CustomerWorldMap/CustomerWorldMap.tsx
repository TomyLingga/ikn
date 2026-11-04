'use client';

// Peta dunia pelanggan (Leaflet + tile Esri World Light Gray, tanpa API key): titik per negara/pelanggan berwarna menurut
// kawasan dan garis putus-putus melengkung dari titik asal (Pelabuhan Belawan). Selalu dimuat lewat dynamic import
// ssr:false (index.tsx) karena Leaflet menyentuh `window` saat diimpor.
import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface MapPoint {
  key: string;
  lat: number;
  lng: number;
  color: string;
  title: string;
  subtitle: string;
  logo: string | null;
  /** md = titik negara, sm = titik lokasi pelanggan sendiri. */
  size: 'md' | 'sm';
}

export interface CustomerWorldMapProps {
  points: MapPoint[];
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

export default function CustomerWorldMap({ points, origin }: CustomerWorldMapProps) {
  // Titik di benua Amerika digeser +360° agar rute dari Indonesia melintasi Pasifik (jalur terpendek).
  const placed = points.map((c) => ({ ...c, lng: c.lng < -30 ? c.lng + 360 : c.lng }));
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
            key={`arc-${c.key}`}
            positions={arc([origin.lat, origin.lng], [c.lat, c.lng])}
            pathOptions={{ color: c.color, weight: c.size === 'sm' ? 1.1 : 1.4, opacity: 0.65, dashArray: '3 6' }}
          />
        ))}
        {placed.map((c) => (
          <CircleMarker
            key={c.key}
            center={[c.lat, c.lng]}
            radius={c.size === 'sm' ? 5 : 7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: c.color, fillOpacity: 1 }}
          >
            <Tooltip direction="top" offset={[0, -6]} className="cmap-tip">
              {c.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo} alt="" className="cmap-tip-logo" />
              )}
              <strong>{c.title}</strong>
              {c.subtitle && (
                <>
                  <br />
                  {c.subtitle}
                </>
              )}
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
