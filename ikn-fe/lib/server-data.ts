// ===================== FETCHER SISI SERVER =====================
// Dipakai server component (RSC) untuk data publik dari ikn-api lewat API_INTERNAL_URL.
// Konten company profile dan katalog sama-sama dari API nyata; tidak ada mock/Supabase.

import { cache } from 'react';
import type { Category, CommerceConfig, Product, ProductDetail, ProductQuery } from '@/lib/types';
import type {
  BrochureData,
  CertificateData,
  CustomerLogoData,
  DocLinkData,
  GalleryItemData,
  MenuData,
  PagedMeta,
  PageData,
  PostDetail,
  PostSummary,
  SiteData,
  SiteSettings,
} from '@/lib/cms';

const INTERNAL_URL = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/$/, '');

class ServerApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface ServerEnvelope<T> {
  data?: T;
  meta?: PagedMeta;
  message?: string;
}

async function getEnvelope<T>(path: string): Promise<ServerEnvelope<T>> {
  const res = await fetch(`${INTERNAL_URL}${path}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  const payload = (await res.json().catch(() => ({}))) as ServerEnvelope<T>;
  if (!res.ok) throw new ServerApiError(res.status, payload.message || `API ${res.status}`);
  return payload;
}

async function get<T>(path: string): Promise<T> {
  return (await getEnvelope<T>(path)).data as T;
}

// Konten tidak boleh menjatuhkan halaman: kembalikan null/[] bila API tidak tersedia.
async function safe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await get<T>(path);
  } catch (err) {
    if (!(err instanceof ServerApiError && err.status === 404)) {
      console.error(`[server-data] ${path}:`, err instanceof Error ? err.message : err);
    }
    return fallback;
  }
}

// ---------------------------------------------------------------- Company profile (API)

export const emptySettings: SiteSettings = {
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
    footer_cta_label: { id: 'Mulai percakapan', en: 'Start a conversation' },
    subsidiary_note: { id: '', en: '' },
  },
  seo: { default_title: { id: '', en: '' }, default_description: { id: '', en: '' } },
  contact: { whatsapp: '', whatsapp_message: { id: '', en: '' } },
  analytics: { ga_measurement_id: '', gsc_verification: '' },
};

const emptyMenu = (location: 'header' | 'footer'): MenuData => ({ location, items: [] });

// Dibungkus React.cache: layout + generateMetadata + page memanggil fetcher yang sama dalam satu render.
export const fetchSite = cache((): Promise<SiteData> =>
  safe<SiteData>('/content/site', {
    settings: emptySettings,
    menus: { header: emptyMenu('header'), footer: emptyMenu('footer') },
    contact: null,
    docLinks: [],
  }),
);

export const fetchPage = cache((slug: string): Promise<PageData | null> =>
  safe<PageData | null>(`/content/pages/${encodeURIComponent(slug)}`, null),
);

export function fetchNews(): Promise<PostSummary[]> {
  return safe<PostSummary[]>('/content/news', []);
}

export const fetchNewsDetail = cache((slug: string): Promise<PostDetail | null> =>
  safe<PostDetail | null>(`/content/news/${encodeURIComponent(slug)}`, null),
);

export function fetchGallery(): Promise<GalleryItemData[]> {
  return safe<GalleryItemData[]>('/content/gallery', []);
}

export function fetchCertificates(): Promise<CertificateData[]> {
  return safe<CertificateData[]>('/content/certificates', []);
}

export function fetchBrochures(): Promise<BrochureData[]> {
  return safe<BrochureData[]>('/content/brochures', []);
}

export function fetchCustomerLogos(): Promise<CustomerLogoData[]> {
  return safe<CustomerLogoData[]>('/content/customer-logos', []);
}

export function fetchDocLinks(category?: string): Promise<DocLinkData[]> {
  return safe<DocLinkData[]>(`/content/doc-links${category ? `?category=${encodeURIComponent(category)}` : ''}`, []);
}

// ---------------------------------------------------------------- Katalog (API)

export const fetchCategories = cache((): Promise<Category[]> => safe<Category[]>('/catalog/categories', []));

export interface ProductPage {
  items: Product[];
  meta: PagedMeta;
}

const emptyMeta: PagedMeta = { page: 1, perPage: 0, total: 0, lastPage: 1 };

/** Daftar produk published, berpaginasi; filter lewat query string kontrak bagian 6. */
export async function fetchProducts(params: ProductQuery = {}): Promise<ProductPage> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category && params.category !== 'all') qs.set('category', params.category);
  if (params.sort) qs.set('sort', params.sort);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  const query = qs.toString();
  try {
    const payload = await getEnvelope<Product[]>(`/catalog/products${query ? `?${query}` : ''}`);
    return { items: payload.data || [], meta: payload.meta || { ...emptyMeta, total: (payload.data || []).length } };
  } catch (err) {
    console.error('[server-data] /catalog/products:', err instanceof Error ? err.message : err);
    return { items: [], meta: emptyMeta };
  }
}

/** Detail produk + reviews[] + related[]; null bila tidak ada / tidak published. */
export const fetchProduct = cache((slug: string): Promise<ProductDetail | null> =>
  safe<ProductDetail | null>(`/catalog/products/${encodeURIComponent(slug)}`, null),
);

export function fetchCommerceConfig(): Promise<CommerceConfig | null> {
  return safe<CommerceConfig | null>('/commerce/config', null);
}
