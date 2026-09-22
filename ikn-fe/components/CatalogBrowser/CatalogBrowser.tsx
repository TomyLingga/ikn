'use client';

import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import ProductCard from '@/components/ProductCard';
import EmptyState from '@/components/EmptyState';
import type { Category, Product } from '@/lib/types';

type SortKey = 'featured' | 'name' | 'price-asc' | 'price-desc';

const PAGE_SIZE = 9;

interface CatalogBrowserProps {
  products: Product[];
  categories: Category[];
  initialCategory?: string;
}

// Katalog interaktif: filter kategori, pencarian, urutan, dan pagination. Data dari props.
export default function CatalogBrowser({ products = [], categories = [], initialCategory = 'all' }: CatalogBrowserProps) {
  const [cat, setCat] = useState(initialCategory);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [page, setPage] = useState(1);

  const safeProducts = Array.isArray(products) ? products : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const filtered = useMemo(() => {
    let list = safeProducts.slice();
    if (cat !== 'all') list = list.filter((p) => p.category === cat);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter((p) =>
        [p.name, p.nameEn, p.code, p.kind, ...(p.aliases || [])]
          .join(' ')
          .toLowerCase()
          .includes(query)
      );
    }
    if (sort === 'price-asc') list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    else if (sort === 'price-desc') list.sort((a, b) => (b.price ?? -1) - (a.price ?? -1));
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [safeProducts, cat, q, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  return (
    <div className="cat-layout">
      <aside className="cat-side">
        <div>
          <span className="cat-filter-title">Kategori</span>
          <ul className="cat-filter-list">
            <li>
              <button
                className={`cat-filter-btn ${cat === 'all' ? 'is-active' : ''}`}
                onClick={() => { setCat('all'); setPage(1); }}
              >
                Semua produk
              </button>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <button
                  className={`cat-filter-btn ${cat === c.slug ? 'is-active' : ''}`}
                  onClick={() => { setCat(c.slug); setPage(1); }}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <span className="cat-filter-title">Cari</span>
          <div className="cat-search">
            <Icon name="compass" size={17} />
            <input
              type="search"
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Nama atau kode produk"
              aria-label="Cari produk"
            />
          </div>
        </div>
      </aside>

      <div>
        <div className="cat-bar">
          <span className="cat-count">{filtered.length} produk</span>
          <select
            className="cat-sort"
            value={sort}
            onChange={(e) => { setSort(e.target.value as SortKey); setPage(1); }}
            aria-label="Urutkan"
          >
            <option value="featured">Unggulan</option>
            <option value="name">Nama A–Z</option>
            <option value="price-asc">Harga termurah</option>
            <option value="price-desc">Harga tertinggi</option>
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="compass"
            title="Tidak ada hasil"
            body="Coba kata kunci lain atau pilih kategori berbeda."
          />
        ) : (
          <>
            <div className="pgrid">
              {paged.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="cat-pagination" aria-label="Navigasi halaman" style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 28 }}>
                <button
                  type="button"
                  className="btn btn-line btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  aria-label="Halaman sebelumnya"
                >
                  <Icon name="chevronLeft" size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`btn btn-sm ${n === currentPage ? 'btn-solid' : 'btn-line'}`}
                    onClick={() => setPage(n)}
                    aria-current={n === currentPage ? 'page' : undefined}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-line btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  aria-label="Halaman berikutnya"
                >
                  <Icon name="chevronRight" size={16} />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
