'use client';

import dynamic from 'next/dynamic';

// Leaflet hanya di browser: dynamic import ssr:false (pola sama dengan components/ContactMap).
const HeroTileMap = dynamic(() => import('./HeroTileMap'), { ssr: false, loading: () => null });

export default HeroTileMap;
