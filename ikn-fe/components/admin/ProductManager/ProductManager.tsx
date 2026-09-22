'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import StatusBadge from '@/components/StatusBadge';
import Icon from '@/components/Icon';
import {
  AdminPageHead,
  DataTable,
  RowActions,
  type Column,
} from '@/components/admin/AdminPage';
import { stockLabels } from '@/lib/commerce';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { formatIDR } from '@/lib/format';
import type { PriceMode, Product, StockStatus } from '@/lib/types';

type AdminProduct = Product & { published: boolean };

interface AdminCategory {
  slug: string;
  name: string;
  nameEn: string;
  desc: string;
  productCount: number;
}

type ModalState =
  | { type: 'add' }
  | { type: 'edit'; product: AdminProduct }
  | { type: 'detail'; product: AdminProduct }
  | { type: 'deactivate'; product: AdminProduct }
  | null;

interface ProductFormState {
  code: string;
  name: string;
  nameEn: string;
  category: string;
  kind: string;
  priceMode: PriceMode;
  price: string;
  unit: string;
  stock: string;
  stockStatus: StockStatus;
  image: string;
  summary: string;
  summaryEn: string;
}

const emptyForm: ProductFormState = {
  code: '',
  name: '',
  nameEn: '',
  category: '',
  kind: '',
  priceMode: 'fixed',
  price: '',
  unit: 'kg',
  stock: '0',
  stockStatus: 'in_stock',
  image: '',
  summary: '',
  summaryEn: '',
};

function formFromProduct(product: AdminProduct): ProductFormState {
  return {
    code: product.code,
    name: product.name,
    nameEn: product.nameEn,
    category: product.category,
    kind: product.kind,
    priceMode: product.priceMode,
    price: product.price === null ? '' : String(product.price),
    unit: product.unit,
    stock: String(product.stock ?? 0),
    stockStatus: product.stockStatus,
    image: product.image || '',
    summary: product.summary,
    summaryEn: product.summaryEn || '',
  };
}

function ProductModal({
  title,
  children,
  onClose,
  size = 'large',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'small' | 'large';
}) {
  function closeFromBackdrop(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onClose();
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="admin-modal-backdrop" onMouseDown={closeFromBackdrop}>
      <section
        className={`admin-modal admin-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
      >
        <header className="admin-modal-head">
          <h2 id="product-modal-title">{title}</h2>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Tutup">
            <Icon name="close" size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export default function ProductManager() {
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setLoadError('');
    try {
      const [products, cats] = await Promise.all([
        api<AdminProduct[]>('/admin/products'),
        api<AdminCategory[]>('/admin/categories'),
      ]);
      setItems(products);
      setCategories(cats);
    } catch (err) {
      setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const categoryName = useCallback(
    (slug: string) => categories.find((category) => category.slug === slug)?.name || slug || '—',
    [categories]
  );

  const visibleItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((product) => {
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'active' ? product.published : !product.published);
      const matchesQuery =
        !normalizedQuery ||
        [product.code, product.name, product.nameEn, product.kind]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [items, query, statusFilter]);

  function closeModal() {
    setModal(null);
    setFormError('');
  }

  function openAdd() {
    setForm({ ...emptyForm, category: categories[0]?.slug || '' });
    setFormError('');
    setModal({ type: 'add' });
  }

  function openEdit(product: AdminProduct) {
    setForm(formFromProduct(product));
    setFormError('');
    setModal({ type: 'edit', product });
  }

  const PRESET_IMAGES = [
    { label: 'Sarung Egrek', url: '/img/sarung-egrek.png' },
    { label: 'Sepatu Boots', url: '/img/sepatu-boots.png' },
    { label: 'Resiprene 35', url: '/img/resiprene-35.jpg' },
    { label: 'Produksi Karet', url: '/img/produksi-karet-1.webp' },
    { label: 'Pabrik Hilir', url: '/img/pabrik-2-1.png' },
    { label: 'Karet Alam', url: '/img/karet-1-1-scaled.jpg' },
  ];

  function updateField<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleImageFile(file: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFormError('File yang dipilih harus berupa gambar (JPG, PNG, WebP, dll).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError('Ukuran file maksimal 5 MB.');
      return;
    }

    setUploading(true);
    setFormError('');

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          updateField('image', dataUrl);
        }
        setUploading(false);
      };
      reader.onerror = () => {
        setFormError('Gagal membaca file gambar.');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setFormError(errorMessage(err));
      setUploading(false);
    }
  }

  async function submitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const editing = modal?.type === 'edit' ? modal.product : null;

    const body = {
      name: form.name.trim(),
      nameEn: form.nameEn.trim(),
      code: form.code.trim().toUpperCase(),
      category: form.category,
      kind: form.kind.trim(),
      priceMode: form.priceMode,
      price: form.priceMode === 'fixed' ? Number(form.price) : null,
      unit: form.unit.trim(),
      moq: editing?.moq ?? null,
      stock: Math.max(0, Number(form.stock) || 0),
      stockStatus: form.stockStatus,
      image: form.image.trim() || editing?.image || '/img/produksi-karet-1.webp',
      summary: form.summary.trim(),
      summaryEn: form.summaryEn.trim(),
      highlights: editing?.highlights ?? [],
      specs: editing?.specs ?? [],
      applications: editing?.applications ?? [],
      published: editing ? editing.published : true,
    };

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api(`/admin/products/${encodeURIComponent(editing.slug)}`, { method: 'PUT', body });
      } else {
        await api('/admin/products', { method: 'POST', body });
      }
      await refresh();
      setNotice(editing ? 'Perubahan produk berhasil disimpan.' : 'Produk baru berhasil ditambahkan.');
      closeModal();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function setPublished(product: AdminProduct, published: boolean) {
    try {
      await api(`/admin/products/${encodeURIComponent(product.slug)}/publish`, {
        method: 'PUT',
        body: { published },
      });
      await refresh();
      setNotice(
        published
          ? `${product.name} diaktifkan kembali.`
          : `${product.name} dinonaktifkan. Data tetap tersimpan.`
      );
    } catch (err) {
      setNotice('');
      setLoadError(errorMessage(err));
    }
    closeModal();
  }

  const { lang } = useLang();
  const columns: Column<AdminProduct>[] = [
    { key: 'code', label: lang === 'en' ? 'Code' : 'Kode', render: (product) => <span className="mono">{product.code}</span> },
    { key: 'name', label: lang === 'en' ? 'Name' : 'Nama', render: (product) => (lang === 'en' && product.nameEn ? product.nameEn : product.name) },
    { key: 'category', label: lang === 'en' ? 'Category' : 'Kategori', render: (product) => categoryName(product.category) },
    {
      key: 'price',
      label: lang === 'en' ? 'Price' : 'Harga',
      align: 'right',
      render: (product) =>
        product.priceMode === 'fixed'
          ? `${formatIDR(product.price)}/${product.unit}`
          : lang === 'en' ? 'Quote' : 'Penawaran',
    },
    {
      key: 'stock',
      label: lang === 'en' ? 'Stock' : 'Stok',
      render: (product) => {
        const stock = stockLabels[product.stockStatus] || stockLabels.out_of_stock;
        return <StatusBadge label={stock[lang] || stock.id} tone={stock.tone} small />;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (product) => (
        <StatusBadge
          label={
            product.published
              ? lang === 'en' ? 'Active' : 'Aktif'
              : lang === 'en' ? 'Inactive' : 'Nonaktif'
          }
          tone={product.published ? 'ok' : 'bad'}
          small
        />
      ),
    },
    {
      key: 'act',
      label: lang === 'en' ? 'Action' : 'Aksi',
      render: (product) => (
        <RowActions
          actions={[
            { label: lang === 'en' ? 'Detail' : 'Detail', onClick: () => setModal({ type: 'detail', product }) },
            { label: lang === 'en' ? 'Edit' : 'Edit', onClick: () => openEdit(product) },
            product.published
              ? { label: lang === 'en' ? 'Deactivate' : 'Nonaktifkan', tone: 'danger', onClick: () => setModal({ type: 'deactivate', product }) }
              : { label: lang === 'en' ? 'Activate' : 'Aktifkan', tone: 'success', onClick: () => void setPublished(product, true) },
          ]}
        />
      ),
    },
  ];

  const editingProduct = modal?.type === 'edit' ? modal.product : null;
  const showForm = modal?.type === 'add' || modal?.type === 'edit';

  return (
    <div>
      <AdminPageHead
        title={lang === 'en' ? 'Products' : 'Produk'}
        desc={
          lang === 'en'
            ? 'Manage rubber product catalog without deleting historical data.'
            : 'Kelola katalog produk hilir karet tanpa menghapus riwayat data.'
        }
        action={{
          label: lang === 'en' ? 'Add product' : 'Tambah produk',
          icon: 'plus',
          onClick: openAdd,
        }}
      />

      {notice && <div className="admin-toast" role="status">{notice}</div>}
      {loadError && <p className="form-error">{loadError}</p>}

      <div className="admin-toolbar">
        <label className="admin-search">
          <span className="sr-only">{lang === 'en' ? 'Search product' : 'Cari produk'}</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={lang === 'en' ? 'Search code or product name' : 'Cari kode atau nama produk'}
          />
        </label>
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
          >
            <option value="all">{lang === 'en' ? 'All' : 'Semua'}</option>
            <option value="active">{lang === 'en' ? 'Active' : 'Aktif'}</option>
            <option value="inactive">{lang === 'en' ? 'Inactive' : 'Nonaktif'}</option>
          </select>
        </label>
        <span className="admin-result-count">
          {visibleItems.length} {lang === 'en' ? 'products' : 'produk'}
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={visibleItems}
        rowKey="slug"
        empty={
          loading
            ? lang === 'en' ? 'Loading products...' : 'Memuat produk...'
            : lang === 'en' ? 'No products found.' : 'Produk tidak ditemukan.'
        }
      />

      {showForm && (
        <ProductModal title={editingProduct ? 'Edit produk' : 'Tambah produk'} onClose={closeModal}>
          <form className="admin-form" onSubmit={(event) => void submitProduct(event)}>
            {formError && <p className="admin-form-error" role="alert">{formError}</p>}
            <div className="admin-form-row">
              <label>
                <span className="field-label">Kode produk</span>
                <input
                  value={form.code}
                  onChange={(event) => updateField('code', event.target.value)}
                  placeholder="Contoh: RSP-35"
                  required
                />
              </label>
              <label>
                <span className="field-label">Kategori</span>
                <select
                  value={form.category}
                  onChange={(event) => updateField('category', event.target.value)}
                  required
                >
                  {categories.length === 0 && <option value="">— Belum ada kategori —</option>}
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">Nama produk</span>
                <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
              </label>
              <label>
                <span className="field-label">Nama produk (EN)</span>
                <input value={form.nameEn} onChange={(event) => updateField('nameEn', event.target.value)} />
              </label>
            </div>
            <label>
              <span className="field-label">Jenis / material</span>
              <input value={form.kind} onChange={(event) => updateField('kind', event.target.value)} required />
            </label>
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">Mode harga</span>
                <select
                  value={form.priceMode}
                  onChange={(event) => updateField('priceMode', event.target.value as PriceMode)}
                >
                  <option value="fixed">Harga tetap</option>
                  <option value="quote">Hubungi marketing</option>
                </select>
              </label>
              <label>
                <span className="field-label">Harga (IDR)</span>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(event) => updateField('price', event.target.value)}
                  disabled={form.priceMode === 'quote'}
                  required={form.priceMode === 'fixed'}
                />
              </label>
              <label>
                <span className="field-label">Satuan</span>
                <input value={form.unit} onChange={(event) => updateField('unit', event.target.value)} required />
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">Jumlah stok</span>
                <input
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(event) => updateField('stock', event.target.value)}
                  required
                />
              </label>
              <label>
                <span className="field-label">Status stok</span>
                <select
                  value={form.stockStatus}
                  onChange={(event) => updateField('stockStatus', event.target.value as StockStatus)}
                >
                  <option value="in_stock">Tersedia</option>
                  <option value="made_to_order">Pre-order</option>
                  <option value="out_of_stock">Stok habis</option>
                </select>
              </label>
            </div>
            <div className="admin-image-upload-section">
              <span className="field-label">Foto / Gambar Produk</span>
              <div className="admin-image-box">
                <div className="admin-image-preview-wrap">
                  {form.image ? (
                    <img
                      src={form.image}
                      alt="Preview produk"
                      className="admin-image-preview"
                    />
                  ) : (
                    <div className="admin-image-placeholder">
                      <Icon name="image" size={32} />
                      <span>Belum ada foto</span>
                    </div>
                  )}
                </div>
                <div className="admin-image-actions">
                  <div className="admin-image-buttons">
                    <label
                      className="btn btn-solid btn-sm"
                      style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <Icon name="plus" size={16} />
                      <span>{uploading ? 'Memproses...' : form.image ? 'Ganti Foto' : 'Unggah Foto'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={uploading}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) void handleImageFile(file);
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {form.image && (
                      <button
                        type="button"
                        className="btn btn-line btn-sm"
                        onClick={() => updateField('image', '')}
                      >
                        <Icon name="trash" size={16} /> Hapus Foto
                      </button>
                    )}
                  </div>

                  <div>
                    <span className="admin-field-hint" style={{ display: 'block', marginBottom: 4 }}>
                      Atau pilih dari foto aset bawaan:
                    </span>
                    <div className="admin-preset-images">
                      {PRESET_IMAGES.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          title={preset.label}
                          className={`admin-preset-thumb ${form.image === preset.url ? 'is-selected' : ''}`}
                          onClick={() => updateField('image', preset.url)}
                        >
                          <img src={preset.url} alt={preset.label} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="admin-field-hint">
                    Format: JPG, PNG, WebP (maks. 5MB). Foto yang Anda pilih/unggah akan langsung muncul di katalog dan detail produk.
                  </p>
                </div>
              </div>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">Ringkasan</span>
                <textarea rows={4} value={form.summary} onChange={(event) => updateField('summary', event.target.value)} required />
              </label>
              <label>
                <span className="field-label">Ringkasan (EN)</span>
                <textarea rows={4} value={form.summaryEn} onChange={(event) => updateField('summaryEn', event.target.value)} />
              </label>
            </div>
            <footer className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeModal}>Batal</button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving || uploading}>
                <Icon name="check" size={16} /> {saving ? 'Menyimpan...' : editingProduct ? 'Simpan perubahan' : 'Tambah produk'}
              </button>
            </footer>
          </form>
        </ProductModal>
      )}

      {modal?.type === 'detail' && (
        <ProductModal title="Detail produk" onClose={closeModal}>
          <div className="admin-product-detail">
            {modal.product.image && (
              <div style={{ marginBottom: 18, border: '1px solid var(--line)', background: 'var(--paper)', borderRadius: 4, padding: 12, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img
                  src={modal.product.image}
                  alt={modal.product.name}
                  style={{ maxHeight: 200, maxWidth: '100%', objectFit: 'contain', borderRadius: 2 }}
                />
              </div>
            )}
            <div className="admin-product-detail-head">
              <div>
                <span className="mono">{modal.product.code}</span>
                <h3>{modal.product.name}</h3>
                {modal.product.nameEn && <p>{modal.product.nameEn}</p>}
              </div>
              <StatusBadge
                label={modal.product.published ? 'Aktif' : 'Nonaktif'}
                tone={modal.product.published ? 'ok' : 'bad'}
              />
            </div>
            <dl className="admin-product-facts">
              <div><dt>Kategori</dt><dd>{categoryName(modal.product.category)}</dd></div>
              <div><dt>Jenis</dt><dd>{modal.product.kind || '—'}</dd></div>
              <div><dt>Harga</dt><dd>{modal.product.priceMode === 'fixed' ? `${formatIDR(modal.product.price)}/${modal.product.unit}` : 'Hubungi marketing'}</dd></div>
              <div><dt>Stok</dt><dd>{modal.product.stock ?? 0} {modal.product.unit}</dd></div>
              <div><dt>Status stok</dt><dd>{(stockLabels[modal.product.stockStatus] || stockLabels.out_of_stock).id}</dd></div>
              <div><dt>Slug</dt><dd className="mono">{modal.product.slug}</dd></div>
            </dl>
            <div className="admin-product-summary">
              <h4>Ringkasan</h4>
              <p>{modal.product.summary || 'Belum ada ringkasan.'}</p>
            </div>
            <footer className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeModal}>Tutup</button>
              <button type="button" className="btn btn-solid btn-sm" onClick={() => openEdit(modal.product)}>Edit produk</button>
            </footer>
          </div>
        </ProductModal>
      )}

      {modal?.type === 'deactivate' && (
        <ProductModal title="Konfirmasi nonaktif" onClose={closeModal} size="small">
          <div className="admin-confirm">
            <div className="admin-confirm-icon"><Icon name="cancelCircle" size={24} /></div>
            <p>Nonaktifkan <strong>{modal.product.name}</strong>?</p>
            <p className="admin-confirm-note">
              Produk tidak akan tampil pada katalog aktif, tetapi seluruh data dan riwayatnya tetap tersimpan serta dapat diaktifkan kembali.
            </p>
            <footer className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={closeModal}>Batal</button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => void setPublished(modal.product, false)}>
                Ya, nonaktifkan
              </button>
            </footer>
          </div>
        </ProductModal>
      )}
    </div>
  );
}
