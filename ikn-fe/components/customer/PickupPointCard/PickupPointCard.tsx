'use client';

import Icon from '@/components/Icon';
import ContactMap from '@/components/ContactMap';

interface PickupPointCardProps {
  label: string | null | undefined;
  address: string | null | undefined;
  lat: number | null | undefined;
  lng: number | null | undefined;
  lang: 'id' | 'en';
  /** Judul kartu; bawaan "Ambil di pabrik". */
  title?: string;
  /** Nama produk yang diambil di titik ini (Loco beberapa pabrik, ASUMSI A-90); kosong = tidak ditampilkan. */
  items?: string[];
}

// Kartu titik ambil order Loco (ASUMSI A-85): nama lokasi, alamat, dan peta kecil berpin (Leaflet lewat ContactMap,
// dynamic import ssr:false). Dipakai langkah "Cara serah terima" di checkout dan kartu lokasi di detail pesanan customer;
// satu kartu per pabrik asal bila keranjang memuat produk dari beberapa pabrik.
export default function PickupPointCard({ label, address, lat, lng, lang, title, items }: PickupPointCardProps) {
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const hasPin = typeof lat === 'number' && typeof lng === 'number';

  return (
    <div className="co-pickup">
      <div className="co-addr-card is-active co-pickup-card">
        <Icon name="factory" size={20} />
        <span>
          <strong>{title || t('Ambil di pabrik', 'Pickup at the factory')}</strong>
          {label && (
            <>
              <br />
              {label}
            </>
          )}
          <br />
          <small>{address || t('Alamat titik ambil belum diatur penjual.', 'The seller has not set the pickup address yet.')}</small>
          {items && items.length > 0 && (
            <>
              <br />
              <small className="co-pickup-items">
                {t('Diambil di sini', 'Collected here')}: {items.join(', ')}
              </small>
            </>
          )}
        </span>
      </div>
      {hasPin && (
        <div className="co-pickup-map">
          <ContactMap compact points={[{ name: label || '', address: address || '', lat, lng }]} lang={lang} />
        </div>
      )}
    </div>
  );
}
