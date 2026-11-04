'use client';

import dynamic from 'next/dynamic';

// Leaflet hanya di browser: dynamic import ssr:false (pola sama dengan components/ContactMap).
const CustomerWorldMap = dynamic(() => import('./CustomerWorldMap'), {
  ssr: false,
  loading: () => <div className="cmap-map cmap-map-loading" aria-hidden="true" />,
});

export type { CustomerWorldMapProps, MapCountry } from './CustomerWorldMap';
export default CustomerWorldMap;
