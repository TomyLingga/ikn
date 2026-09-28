// Helper query katalog yang aman diimpor dari server component (bukan modul 'use client').
import type { ProductQuery } from '@/lib/types';

export type CatalogSort = NonNullable<ProductQuery['sort']>;

export interface CatalogQuery {
  q: string;
  category: string;
  sort: CatalogSort;
  page: number;
}

/** Baca query string RSC (`searchParams`) menjadi CatalogQuery. */
export function parseCatalogQuery(params: Record<string, string | string[] | undefined>, category?: string): CatalogQuery {
  const pick = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] || '' : v || '';
  };
  const sort = pick('sort');
  return {
    q: pick('q').trim(),
    category: category ?? pick('category'),
    sort: sort === 'name' || sort === 'price' || sort === 'newest' ? sort : '',
    page: Math.max(1, parseInt(pick('page'), 10) || 1),
  };
}
