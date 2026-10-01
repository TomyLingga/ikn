'use client';

import dynamic from 'next/dynamic';

// Leaflet hanya di browser: dynamic import ssr:false (pola sama dengan components/customer/AddressMap).
const ContactMap = dynamic(() => import('./ContactMap'), {
  ssr: false,
  loading: () => <div className="contact-map contact-map-loading" aria-hidden="true" />,
});

export type { ContactMapProps } from './ContactMap';
export default ContactMap;
