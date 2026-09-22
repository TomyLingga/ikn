// ===================== FETCHER SISI SERVER =====================
// Dipakai server component untuk mengambil data publik dari Supabase / Store lokal.
// Dilengkapi fallback lengkap ke data mockup bila offline atau belum dikonfigurasi.

import {
  fetchCategoriesFromDb,
  fetchProductsFromDb,
  fetchProductDetailFromDb,
  fetchNewsFromDb,
  fetchGalleryFromDb,
  fetchCertificatesFromDb,
  fetchBrochuresFromDb,
  fetchCommerceConfigFromDb,
} from '@/lib/supabase-service';
import {
  MOCK_BROCHURES,
  MOCK_CATEGORIES,
  MOCK_CERTIFICATES,
  MOCK_COMMERCE_CONFIG,
  MOCK_GALLERY,
  MOCK_NEWS,
  MOCK_PRODUCTS,
  MOCK_REVIEWS,
} from '@/lib/mock-data';
import type {
  Brochure,
  Category,
  Certificate,
  CustomerLogo,
  GalleryItem,
  Product,
  Review,
} from '@/lib/types';

export interface NewsListItem {
  slug: string;
  title: string;
  titleEn: string;
  date: string;
  tag: string;
  thumb: string;
  excerpt: string;
  excerptEn: string;
}

export interface NewsDetail extends NewsListItem {
  body: string;
  bodyEn: string;
}

export interface CommerceConfig {
  bankAccounts: { id: string; bank: string; number: string; holder: string; active: boolean }[];
  shippingMethods: { id: string; label: string; amount: number }[];
  additionalFees: { id: string; label: string; type: string; amount: number; active: boolean }[];
  paymentDueHours: number;
}

export async function fetchCategories(): Promise<Category[]> {
  try {
    return await fetchCategoriesFromDb();
  } catch {
    return MOCK_CATEGORIES;
  }
}

export async function fetchProducts(params: { q?: string; category?: string } = {}): Promise<Product[]> {
  try {
    return await fetchProductsFromDb(params);
  } catch {
    let fallbackList = [...MOCK_PRODUCTS];
    if (params.category && params.category !== 'all') {
      fallbackList = fallbackList.filter((p) => p.category === params.category);
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      fallbackList = fallbackList.filter((p) =>
        [p.name, p.nameEn, p.code, p.kind, ...(p.aliases || [])].join(' ').toLowerCase().includes(q)
      );
    }
    return fallbackList;
  }
}

export async function fetchProduct(slug: string): Promise<{ product: Product; reviews: Review[] } | null> {
  try {
    const res = await fetchProductDetailFromDb(slug);
    if (res) return res;
  } catch {
    // fallback below
  }
  const prod = MOCK_PRODUCTS.find((p) => p.slug === slug) || null;
  const reviews = MOCK_REVIEWS[slug] || [];
  return prod ? { product: prod, reviews } : null;
}

export async function fetchNews(): Promise<NewsListItem[]> {
  try {
    const list = await fetchNewsFromDb();
    return list.map((n) => ({
      slug: n.slug,
      title: n.title,
      titleEn: n.title,
      date: n.date,
      tag: n.tag,
      thumb: n.thumb,
      excerpt: n.excerpt,
      excerptEn: n.excerpt,
    }));
  } catch {
    return MOCK_NEWS.map((n) => ({
      slug: n.slug,
      title: n.title,
      titleEn: n.title,
      date: n.date,
      tag: n.tag,
      thumb: n.thumb,
      excerpt: n.excerpt,
      excerptEn: n.excerpt,
    }));
  }
}

export async function fetchNewsDetail(slug: string): Promise<NewsDetail | null> {
  const allNews = await fetchNews();
  const item = allNews.find((n) => n.slug === slug);
  if (!item) return null;

  return {
    ...item,
    body: item.excerpt + '\n\nPT Industri Karet Nusantara terus berkomitmen menghadirkan produk hilir berkualitas tinggi untuk memenuhi kebutuhan pasar nasional maupun internasional.',
    bodyEn: item.excerpt + '\n\nPT Industri Karet Nusantara is dedicated to providing high quality rubber products for domestic and global markets.',
  };
}

export async function fetchGallery(): Promise<GalleryItem[]> {
  try {
    return await fetchGalleryFromDb();
  } catch {
    return MOCK_GALLERY;
  }
}

export async function fetchCertificates(): Promise<Certificate[]> {
  try {
    return await fetchCertificatesFromDb();
  } catch {
    return MOCK_CERTIFICATES;
  }
}

export async function fetchBrochures(): Promise<Brochure[]> {
  try {
    return await fetchBrochuresFromDb();
  } catch {
    return MOCK_BROCHURES;
  }
}

export function fetchCustomerLogos(): Promise<CustomerLogo[]> {
  const fallback: CustomerLogo[] = [
    { id: '1', name: 'PT Perkebunan Nusantara' },
    { id: '2', name: 'PT Maritim Warna' },
    { id: '3', name: 'Coating Solutions Co.' },
  ];
  return Promise.resolve(fallback);
}

export function fetchBlock<T>(_key: string, fallback: T): Promise<T> {
  return Promise.resolve(fallback);
}

export async function fetchCommerceConfig(): Promise<CommerceConfig> {
  try {
    return await fetchCommerceConfigFromDb();
  } catch {
    return MOCK_COMMERCE_CONFIG;
  }
}
