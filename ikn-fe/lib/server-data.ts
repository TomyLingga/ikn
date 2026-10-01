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
  PostCategory,
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

// ---------------------------------------------------------------- Cache konten (proses server Next)
// Konten CMS jarang berubah, sedangkan tiap navigasi memanggil API 1-4 kali. Jawaban sukses disimpan di memori
// proses (globalThis agar satu penyimpanan dipakai bersama bundle halaman dan route handler) dengan pola
// stale-while-revalidate: selama CONTENT_CACHE_TTL detik (bawaan 30) dianggap segar; sesudah itu jawaban lama
// tetap langsung dipakai sambil diperbarui di latar, sampai batas CONTENT_STALE_MS. Aksi tulis admin
// mengosongkannya lewat POST /cache/flush (lib/api.ts), jadi suntingan CMS langsung tampil; jendela basi hanya
// berlaku untuk perubahan di luar panel admin (seeder, penjadwalan, instance lain). ASUMSI A-65.
const CONTENT_TTL_MS = Math.max(0, Number(process.env.CONTENT_CACHE_TTL ?? 30)) * 1000;
const CONTENT_STALE_MS = 10 * 60 * 1000;
const CONTENT_CACHE_MAX = 500;

interface CacheEntry {
  fresh: number; // sampai kapan dianggap segar
  expires: number; // sampai kapan boleh dipakai sambil diperbarui
  value: Promise<unknown>;
  refreshing: boolean;
}

const cacheHolder = globalThis as typeof globalThis & { __iknContentCache?: Map<string, CacheEntry> };
const contentCache: Map<string, CacheEntry> = (cacheHolder.__iknContentCache ??= new Map());

/** Kosongkan cache konten (dipanggil route handler /cache/flush). */
export function flushContentCache(): void {
  contentCache.clear();
}

function cacheEntry(value: Promise<unknown>): CacheEntry {
  const now = Date.now();
  return { fresh: now + CONTENT_TTL_MS, expires: now + CONTENT_TTL_MS + CONTENT_STALE_MS, value, refreshing: false };
}

function getEnvelopeCached<T>(path: string): Promise<ServerEnvelope<T>> {
  if (CONTENT_TTL_MS === 0) return getEnvelope<T>(path);
  const now = Date.now();
  const hit = contentCache.get(path);
  if (hit && hit.expires > now) {
    if (hit.fresh <= now && !hit.refreshing) {
      // Basi tapi masih layak: layani sekarang, perbarui di latar. Gagal memperbarui = tetap pakai yang lama.
      hit.refreshing = true;
      getEnvelope<T>(path)
        .then((payload) => {
          if (contentCache.get(path) === hit) contentCache.set(path, cacheEntry(Promise.resolve(payload)));
        })
        .catch(() => {
          hit.refreshing = false;
        });
    }
    return hit.value as Promise<ServerEnvelope<T>>;
  }
  if (contentCache.size >= CONTENT_CACHE_MAX) contentCache.clear();
  const value = getEnvelope<T>(path);
  contentCache.set(path, cacheEntry(value));
  // Kegagalan (API mati, 404) tidak disimpan: permintaan berikutnya mencoba lagi.
  value.catch(() => {
    if (contentCache.get(path)?.value === value) contentCache.delete(path);
  });
  return value;
}

async function getCached<T>(path: string): Promise<T> {
  return (await getEnvelopeCached<T>(path)).data as T;
}

// Konten tidak boleh menjatuhkan halaman: kembalikan null/[] bila API tidak tersedia.
// `cached` = boleh dilayani dari cache konten (data CMS); data transaksi tetap selalu segar.
async function safe<T>(path: string, fallback: T, cached = false): Promise<T> {
  try {
    return await (cached ? getCached<T>(path) : get<T>(path));
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
  contact: { whatsapp: '', whatsapp_message: { id: '', en: '' }, whatsapp_contacts: [] },
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
  }, true),
);

export const fetchPage = cache((slug: string): Promise<PageData | null> =>
  safe<PageData | null>(`/content/pages/${encodeURIComponent(slug)}`, null, true),
);

export function fetchNews(params: { category?: string } = {}): Promise<PostSummary[]> {
  const q = params.category ? `?category=${encodeURIComponent(params.category)}` : '';
  return safe<PostSummary[]>(`/content/news${q}`, [], true);
}

/** Kategori berita + jumlah berita terbit (filter di /berita). */
export function fetchNewsCategories(): Promise<PostCategory[]> {
  return safe<PostCategory[]>('/content/news-categories', [], true);
}

export const fetchNewsDetail = cache((slug: string): Promise<PostDetail | null> =>
  safe<PostDetail | null>(`/content/news/${encodeURIComponent(slug)}`, null, true),
);

export function fetchGallery(): Promise<GalleryItemData[]> {
  return safe<GalleryItemData[]>('/content/gallery', [], true);
}

export function fetchCertificates(): Promise<CertificateData[]> {
  return safe<CertificateData[]>('/content/certificates', [], true);
}

export function fetchBrochures(): Promise<BrochureData[]> {
  return safe<BrochureData[]>('/content/brochures', [], true);
}

export function fetchCustomerLogos(): Promise<CustomerLogoData[]> {
  return safe<CustomerLogoData[]>('/content/customer-logos', [], true);
}

export function fetchDocLinks(category?: string): Promise<DocLinkData[]> {
  return safe<DocLinkData[]>(`/content/doc-links${category ? `?category=${encodeURIComponent(category)}` : ''}`, [], true);
}

// ---------------------------------------------------------------- Katalog (API)

export const fetchCategories = cache((): Promise<Category[]> => safe<Category[]>('/catalog/categories', [], true));

export interface ProductPage {
  items: Product[];
  meta: PagedMeta;
}

const emptyMeta: PagedMeta = { page: 1, perPage: 0, total: 0, lastPage: 1 };

/**
 * Daftar produk published, berpaginasi; filter lewat query string kontrak bagian 6.
 * `cached` hanya untuk pratinjau di halaman profil (Bisnis); katalog dan detail produk selalu segar.
 */
export async function fetchProducts(params: ProductQuery = {}, options: { cached?: boolean } = {}): Promise<ProductPage> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category && params.category !== 'all') qs.set('category', params.category);
  if (params.sort) qs.set('sort', params.sort);
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  const query = qs.toString();
  try {
    const path = `/catalog/products${query ? `?${query}` : ''}`;
    const payload = await (options.cached ? getEnvelopeCached<Product[]>(path) : getEnvelope<Product[]>(path));
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
