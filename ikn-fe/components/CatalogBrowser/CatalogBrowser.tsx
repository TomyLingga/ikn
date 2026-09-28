'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import ProductCard from '@/components/ProductCard';
import EmptyState from '@/components/EmptyState';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PagedMeta } from '@/lib/cms';
import type { Category, Product } from '@/lib/types';
import type { CatalogQuery, CatalogSort } from './query';

export type { CatalogQuery, CatalogSort } from './query';

interface CatalogBrowserProps {
  products: Product[];
  meta: PagedMeta;
  categories: Category[];
  query: CatalogQuery;
  /** Path dasar untuk query string (mis. `/catalog` atau `/dashboard/katalog`). */
  basePath: string;
  /** Halaman kategori: kategori tidak bisa diganti dari sidebar. */
  lockCategory?: boolean;
}

function buildHref(basePath: string, query: Partial<CatalogQuery>, lockCategory: boolean): string {
  const qs = new URLSearchParams();
  if (query.q) qs.set('q', query.q);
  if (!lockCategory && query.category && query.category !== 'all') qs.set('category', query.category);
  if (query.sort) qs.set('sort', query.sort);
  if (query.page && query.page > 1) qs.set('page', String(query.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

// Katalog: filter kategori, pencarian, urutan, dan paginasi dikerjakan server lewat query string
// (GET /catalog/products?q&category&sort&page). Komponen ini hanya menavigasi ke URL baru.
export default function CatalogBrowser({ products, meta, categories, query, basePath, lockCategory = false }: CatalogBrowserProps) {
  const router = useRouter();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [q, setQ] = useState(query.q);

  const go = (next: Partial<CatalogQuery>) => router.push(buildHref(basePath, { ...query, page: 1, ...next }, lockCategory));

  function submitSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    go({ q: q.trim() });
  }

  const pages = Array.from({ length: Math.max(1, meta.lastPage) }, (_, i) => i + 1);
  const current = Math.min(Math.max(1, meta.page), Math.max(1, meta.lastPage));
  const pageWindow = pages.filter((n) => n === 1 || n === meta.lastPage || Math.abs(n - current) <= 2);

  return (
    <div className="cat-layout">
      <aside className="cat-side">
        <div>
          <span className="cat-filter-title">{t('Kategori', 'Category')}</span>
          <ul className="cat-filter-list">
            <li>
              <Link
                href={buildHref(lockCategory ? '/catalog' : basePath, { ...query, category: 'all', page: 1 }, false)}
                className={`cat-filter-btn ${!query.category || query.category === 'all' ? 'is-active' : ''}`}
              >
                {t('Semua produk', 'All products')}
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={buildHref(lockCategory ? '/catalog' : basePath, { ...query, category: c.slug, page: 1 }, false)}
                  className={`cat-filter-btn ${query.category === c.slug ? 'is-active' : ''}`}
                >
                  {tr(c.name, lang)}
                  {typeof c.productCount === 'number' && <small className="cat-filter-count">{c.productCount}</small>}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className="cat-filter-title">{t('Cari', 'Search')}</span>
          <form className="cat-search" onSubmit={submitSearch} role="search">
            <Icon name="compass" size={17} />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('Nama atau kode produk', 'Product name or code')}
              aria-label={t('Cari produk', 'Search products')}
            />
            <button type="submit" className="cat-search-btn" aria-label={t('Cari', 'Search')}>
              <Icon name="arrow" size={16} />
            </button>
          </form>
        </div>
      </aside>

      <div>
        <div className="cat-bar">
          <span className="cat-count">
            {meta.total} {t('produk', 'products')}
            {query.q && <> · “{query.q}” <button type="button" className="cat-clear" onClick={() => { setQ(''); go({ q: '' }); }}>{t('hapus', 'clear')}</button></>}
          </span>
          <select
            className="cat-sort"
            value={query.sort}
            onChange={(e) => go({ sort: e.target.value as CatalogSort })}
            aria-label={t('Urutkan', 'Sort by')}
          >
            <option value="">{t('Unggulan', 'Featured')}</option>
            <option value="name">{t('Nama A–Z', 'Name A–Z')}</option>
            <option value="price">{t('Harga terendah', 'Lowest price')}</option>
            <option value="newest">{t('Terbaru', 'Newest')}</option>
          </select>
        </div>

        {products.length === 0 ? (
          <EmptyState
            icon="compass"
            title={t('Tidak ada hasil', 'No results')}
            body={t('Coba kata kunci lain atau pilih kategori berbeda.', 'Try another keyword or category.')}
          />
        ) : (
          <>
            <div className="pgrid">
              {products.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>

            {meta.lastPage > 1 && (
              <nav className="cat-pagination" aria-label={t('Navigasi halaman', 'Pagination')}>
                <Link
                  href={buildHref(basePath, { ...query, page: Math.max(1, current - 1) }, lockCategory)}
                  className={`btn btn-line btn-sm ${current === 1 ? 'is-disabled' : ''}`}
                  aria-disabled={current === 1}
                  aria-label={t('Halaman sebelumnya', 'Previous page')}
                >
                  <Icon name="chevronLeft" size={16} />
                </Link>
                {pageWindow.map((n, i) => (
                  <span key={n} className="cat-page-item">
                    {i > 0 && pageWindow[i - 1] !== n - 1 && <span className="cat-ellipsis">…</span>}
                    <Link
                      href={buildHref(basePath, { ...query, page: n }, lockCategory)}
                      className={`btn btn-sm ${n === current ? 'btn-solid' : 'btn-line'}`}
                      aria-current={n === current ? 'page' : undefined}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
                <Link
                  href={buildHref(basePath, { ...query, page: Math.min(meta.lastPage, current + 1) }, lockCategory)}
                  className={`btn btn-line btn-sm ${current === meta.lastPage ? 'is-disabled' : ''}`}
                  aria-disabled={current === meta.lastPage}
                  aria-label={t('Halaman berikutnya', 'Next page')}
                >
                  <Icon name="chevronRight" size={16} />
                </Link>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
