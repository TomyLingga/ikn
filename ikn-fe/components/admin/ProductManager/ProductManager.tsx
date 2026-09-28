'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { stockLabels } from '@/lib/commerce';
import { api, apiPaged, errorMessage } from '@/lib/api';
import { tr, type PagedMeta } from '@/lib/cms';
import { queryString, type AdminProduct } from '@/lib/admin';
import { formatIDR } from '@/lib/format';
import type { Category } from '@/lib/types';
import ProductForm from './ProductForm';
import StockPanel from './StockPanel';

type ModalState =
  | { type: 'form'; product: AdminProduct | null }
  | { type: 'stock'; product: AdminProduct }
  | { type: 'delete'; product: AdminProduct }
  | null;

const PER_PAGE = 20;

// Katalog produk admin: GET /admin/products?q&category&published&trashed&page, CRUD by id, publish, panel stok.
export default function ProductManager() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [items, setItems] = useState<AdminProduct[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [published, setPublished] = useState('');
  const [trashed, setTrashed] = useState(false);
  const [page, setPage] = useState(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<AdminProduct>(`/admin/products${queryString({ q, category, published, trashed: trashed ? 1 : '', page, perPage: PER_PAGE })}`);
      setItems(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, category, published, trashed, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    api<Category[]>('/admin/categories')
      .then(setCategories)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  async function setPublishedState(product: AdminProduct, isPublished: boolean) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/products/${product.id}/publish`, { method: 'PUT', body: { isPublished } });
      setNotice(isPublished ? t(`${tr(product.name, lang)} ditampilkan di katalog.`, `${tr(product.name, lang)} is now published.`) : t(`${tr(product.name, lang)} disembunyikan dari katalog.`, `${tr(product.name, lang)} is now hidden.`));
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(product: AdminProduct) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/products/${product.id}`, { method: 'DELETE' });
      setNotice(t(`${tr(product.name, lang)} dihapus (arsip). Riwayat order dan stok tetap tersimpan.`, `${tr(product.name, lang)} deleted (archived). Order and stock history are kept.`));
      setModal(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<AdminProduct>[] = [
    {
      key: 'product',
      label: t('Produk', 'Product'),
      render: (product) => (
        <span className="cms-cell-media">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="cms-cell-thumb" />
          ) : (
            <span className="cms-cell-thumb">—</span>
          )}
          <span>
            <strong>{tr(product.name, lang)}</strong>
            <small className="admin-cell-sub mono">
              {product.code}
              {product.kind ? ` · ${product.kind}` : ''}
            </small>
          </span>
        </span>
      ),
    },
    { key: 'category', label: t('Kategori', 'Category'), render: (product) => (product.category ? tr(product.category.name, lang) : '—') },
    {
      key: 'price',
      label: t('Harga', 'Price'),
      align: 'right',
      render: (product) =>
        product.priceMode === 'fixed' ? (
          <span>
            {product.promoActive && product.promoPrice !== null ? (
              <>
                <strong>{formatIDR(product.promoPrice)}</strong>
                <small className="admin-cell-sub">
                  <s>{formatIDR(product.price)}</s> · promo
                </small>
              </>
            ) : (
              <>
                {formatIDR(product.price)}
                <small className="admin-cell-sub">/{product.unit}</small>
              </>
            )}
          </span>
        ) : (
          <span className="admin-field-hint">{t('Penawaran', 'Quote')}</span>
        ),
    },
    {
      key: 'stock',
      label: t('Stok', 'Stock'),
      render: (product) => {
        const stock = stockLabels[product.stockStatus] || stockLabels.out_of_stock;
        return (
          <span>
            <StatusBadge label={stock[lang]} tone={stock.tone} small />
            <small className="admin-cell-sub mono">
              {product.available} {t('tersedia', 'avail.')} / {product.stock} {product.unit}
              {product.reserved > 0 ? ` · ${product.reserved} ${t('reservasi', 'reserved')}` : ''}
            </small>
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (product) =>
        product.deletedAt ? (
          <StatusBadge label={t('Dihapus', 'Deleted')} tone="bad" small />
        ) : (
          <StatusBadge label={product.isPublished ? t('Tayang', 'Published') : t('Draf', 'Draft')} tone={product.isPublished ? 'ok' : 'warn'} small />
        ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (product) =>
        product.deletedAt ? (
          <span className="admin-field-hint">{t('Arsip', 'Archived')}</span>
        ) : (
          <RowActions
            actions={[
              { label: 'Edit', onClick: () => setModal({ type: 'form', product }) },
              { label: t('Stok', 'Stock'), onClick: () => setModal({ type: 'stock', product }) },
              product.isPublished
                ? { label: t('Sembunyikan', 'Unpublish'), tone: 'danger', disabled: busy, onClick: () => void setPublishedState(product, false) }
                : { label: t('Tayangkan', 'Publish'), tone: 'success', disabled: busy, onClick: () => void setPublishedState(product, true) },
              { label: t('Hapus', 'Delete'), tone: 'danger', disabled: busy, onClick: () => setModal({ type: 'delete', product }) },
            ]}
          />
        ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Produk', 'Products')}
        desc={t('Kelola katalog produk: data, harga & promo, gambar, dan stok (ledger).', 'Manage the product catalog: details, pricing & promos, images, and stock (ledger).')}
        action={{ label: t('Tambah produk', 'Add product'), icon: 'plus', onClick: () => setModal({ type: 'form', product: null }) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <label className="admin-search">
          <span className="sr-only">{t('Cari produk', 'Search products')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari kode, nama, atau alias', 'Search code, name, or alias')} />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Cari', 'Search')}
        </button>
        <label className="admin-filter">
          <span>{t('Kategori', 'Category')}</span>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('Semua', 'All')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {tr(c.name, lang)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={published}
            onChange={(e) => {
              setPublished(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('Semua', 'All')}</option>
            <option value="1">{t('Tayang', 'Published')}</option>
            <option value="0">{t('Draf', 'Draft')}</option>
          </select>
        </label>
        <label className="cms-check admin-filter">
          <input
            type="checkbox"
            checked={trashed}
            onChange={(e) => {
              setTrashed(e.target.checked);
              setPage(1);
            }}
          />
          <span>{t('Tampilkan yang dihapus', 'Include deleted')}</span>
        </label>
        <span className="admin-result-count">
          {meta.total} {t('produk', 'products')}
        </span>
      </form>

      <DataTable
        columns={columns}
        rows={items}
        pagination={false}
        empty={loading ? t('Memuat produk...', 'Loading products...') : t('Produk tidak ditemukan.', 'No products found.')}
      />
      <Pager meta={meta} onPage={setPage} disabled={loading} />

      {modal?.type === 'form' && (
        <ProductForm
          product={modal.product}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={(saved, created) => {
            setModal(null);
            setNotice(created ? t(`Produk ${tr(saved.name, lang)} ditambahkan.`, `Product ${tr(saved.name, lang)} added.`) : t('Perubahan produk disimpan.', 'Product changes saved.'));
            void refresh();
          }}
        />
      )}

      {modal?.type === 'stock' && <StockPanel product={modal.product} onClose={() => setModal(null)} onChanged={() => void refresh()} />}

      {modal?.type === 'delete' && (
        <AdminModal title={t('Hapus produk', 'Delete product')} onClose={() => setModal(null)} small>
          <div className="admin-confirm">
            <div className="admin-confirm-icon">
              <Icon name="cancelCircle" size={24} />
            </div>
            <p>
              {t('Hapus', 'Delete')} <strong>{tr(modal.product.name, lang)}</strong> ({modal.product.code})?
            </p>
            <p className="admin-confirm-note">
              {t(
                'Produk diarsipkan (soft delete): hilang dari katalog dan tidak bisa dipesan, tetapi riwayat order, ulasan, dan ledger stok tetap tersimpan. Untuk sekadar menyembunyikan, gunakan "Sembunyikan".',
                'The product is archived (soft delete): removed from the catalog and no longer orderable, while order, review, and stock history are kept. To only hide it, use "Unpublish".',
              )}
            </p>
            <footer className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => void remove(modal.product)}>
                {busy ? t('Menghapus...', 'Deleting...') : t('Ya, hapus', 'Yes, delete')}
              </button>
            </footer>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
