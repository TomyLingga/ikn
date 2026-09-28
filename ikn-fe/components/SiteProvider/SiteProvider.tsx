'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { SiteData } from '@/lib/cms';

// Site-wide CMS data (settings, menus, contact block, doc links) fetched once by
// app/(site)/layout.tsx and shared with client components through context.

// Fallback used outside the provider or when the API is unreachable.
export const emptySite: SiteData = {
  settings: {
    company: {
      name: 'PT Industri Karet Nusantara',
      short: 'PT IKN',
      parent: 'PT Perkebunan Nusantara III',
      since: '1965',
      location: 'Medan, Sumatera Utara',
      tagline: { id: '', en: '' },
      profile_document: null,
    },
    site: {
      footer_headline: { id: '', en: '' },
      footer_cta_label: { id: '', en: '' },
      subsidiary_note: { id: '', en: '' },
    },
    seo: { default_title: { id: '', en: '' }, default_description: { id: '', en: '' } },
    contact: { whatsapp: '', whatsapp_message: { id: '', en: '' } },
    analytics: { ga_measurement_id: '', gsc_verification: '' },
  },
  menus: {
    header: { location: 'header', items: [] },
    footer: { location: 'footer', items: [] },
  },
  contact: null,
  docLinks: [],
};

const SiteContext = createContext<SiteData>(emptySite);

export function SiteProvider({ site, children }: { site: SiteData; children: ReactNode }) {
  return <SiteContext.Provider value={site}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteData {
  return useContext(SiteContext);
}
