'use client';

import { useState, type FormEvent } from 'react';
import Icon from '@/components/Icon';
import AdminModal from '@/components/admin/AdminModal';
import { I18nInput, ListField, MediaPicker, firstError, mediaId, mediaSummary, type FieldErrors, type MediaValue } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import {
  fromDateTimeLocal,
  linesToList,
  listToLines,
  numberOrNull,
  toDateTimeLocal,
  type AdminProduct,
  type ProductPayload,
} from '@/lib/admin';
import type { Category, PriceMode } from '@/lib/types';

interface ProductFormState {
  code: string;
  slug: string;
  categoryId: string;
  name: I18n;
  summary: I18n;
  kind: string;
  aliases: string;
  /** Satu baris per item; dikonversi ke { id: string[], en: string[] } saat kirim. */
  highlights: I18n;
  applications: I18n;
  specs: string[][];
  solubility: string[][];
  priceMode: PriceMode;
  price: string;
  promoPrice: string;
  promoStartsAt: string;
  promoEndsAt: string;
  unit: string;
  moq: string;
  weightGram: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  /** '' = otomatis dari stok, 'made_to_order' = manual. */
  stockStatus: '' | 'made_to_order';
  isTaxable: boolean;
  isPublished: boolean;
  /** Foto dan video produk, urut tampil. */
  images: MediaValue[];
  /** Id media foto yang dipilih sebagai thumbnail; null = foto pertama. */
  thumbnailId: number | null;
}

const isVideo = (value: MediaValue): boolean => (mediaSummary(value)?.mime || '').startsWith('video/');

const emptyForm = (categoryId: string): ProductFormState => ({
  code: '',
  slug: '',
  categoryId,
  name: emptyI18n(),
  summary: emptyI18n(),
  kind: '',
  aliases: '',
  highlights: emptyI18n(),
  applications: emptyI18n(),
  specs: [],
  solubility: [],
  priceMode: 'fixed',
  price: '',
  promoPrice: '',
  promoStartsAt: '',
  promoEndsAt: '',
  unit: 'kg',
  moq: '1',
  weightGram: '1000',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  stockStatus: '',
  isTaxable: true,
  isPublished: false,
  images: [],
  thumbnailId: null,
});

function formFromProduct(product: AdminProduct): ProductFormState {
  return {
    code: product.code,
    slug: product.slug,
    categoryId: String(product.categoryId ?? product.category?.id ?? ''),
    name: { ...product.name },
    summary: product.summary ? { ...product.summary } : emptyI18n(),
    kind: product.kind || '',
    aliases: (product.aliases || []).join(', '),
    highlights: { id: listToLines(product.highlights?.id), en: listToLines(product.highlights?.en) },
    applications: { id: listToLines(product.applications?.id), en: listToLines(product.applications?.en) },
    specs: (product.specs || []).map((row) => [row[0] ?? '', row[1] ?? '']),
    solubility: (product.solubility || []).map((row) => [row[0] ?? '', row[1] ?? '']),
    priceMode: product.priceMode,
    price: product.price === null ? '' : String(product.price),
    promoPrice: product.promoPrice === null ? '' : String(product.promoPrice),
    promoStartsAt: toDateTimeLocal(product.promoStartsAt),
    promoEndsAt: toDateTimeLocal(product.promoEndsAt),
    unit: product.unit,
    moq: String(product.moq),
    weightGram: String(product.weightGram),
    lengthCm: product.dimensions?.lengthCm == null ? '' : String(product.dimensions.lengthCm),
    widthCm: product.dimensions?.widthCm == null ? '' : String(product.dimensions.widthCm),
    heightCm: product.dimensions?.heightCm == null ? '' : String(product.dimensions.heightCm),
    stockStatus: product.stockStatus === 'made_to_order' ? 'made_to_order' : '',
    isTaxable: product.isTaxable,
    isPublished: product.isPublished,
    images: product.images.map((image) => image.media ?? { id: image.mediaId }),
    thumbnailId: product.images.find((image) => image.isThumbnail)?.mediaId ?? null,
  };
}

function toPayload(form: ProductFormState, editing: AdminProduct | null): ProductPayload {
  const fixed = form.priceMode === 'fixed';
  // Kembali ke otomatis dari made_to_order: kirim in_stock agar server menurunkan ulang dari stok tersedia.
  let stockStatus: ProductPayload['stockStatus'] = null;
  if (form.stockStatus === 'made_to_order') stockStatus = 'made_to_order';
  else if (editing?.stockStatus === 'made_to_order') stockStatus = 'in_stock';

  return {
    code: form.code.trim().toUpperCase(),
    slug: form.slug.trim() || null,
    categoryId: Number(form.categoryId),
    name: { id: form.name.id.trim(), en: form.name.en.trim() },
    summary: { id: form.summary.id.trim(), en: form.summary.en.trim() },
    kind: form.kind.trim() || null,
    aliases: form.aliases
      .split(',')
      .map((alias) => alias.trim())
      .filter(Boolean),
    highlights: { id: linesToList(form.highlights.id), en: linesToList(form.highlights.en) },
    applications: { id: linesToList(form.applications.id), en: linesToList(form.applications.en) },
    specs: form.specs.map((row) => [row[0]?.trim() ?? '', row[1]?.trim() ?? '']).filter((row) => row[0] || row[1]),
    solubility: form.solubility.map((row) => [row[0]?.trim() ?? '', row[1]?.trim() ?? '']).filter((row) => row[0] || row[1]),
    priceMode: form.priceMode,
    price: fixed ? numberOrNull(form.price) : null,
    promoPrice: fixed ? numberOrNull(form.promoPrice) : null,
    promoStartsAt: fixed ? fromDateTimeLocal(form.promoStartsAt) : null,
    promoEndsAt: fixed ? fromDateTimeLocal(form.promoEndsAt) : null,
    unit: form.unit.trim() || 'pcs',
    moq: Math.max(1, Number(form.moq) || 1),
    weightGram: Math.max(1, Number(form.weightGram) || 1),
    lengthCm: numberOrNull(form.lengthCm),
    widthCm: numberOrNull(form.widthCm),
    heightCm: numberOrNull(form.heightCm),
    stockStatus,
    isTaxable: form.isTaxable,
    isPublished: form.isPublished,
    images: form.images.map(mediaId).filter((id): id is number => id !== null),
    // Thumbnail hanya sah bila masih ada di daftar dan berupa foto; selain itu server memakai foto pertama.
    thumbnailMediaId: form.images.some((item) => mediaId(item) === form.thumbnailId && !isVideo(item)) ? form.thumbnailId : null,
  };
}

interface ProductFormProps {
  product: AdminProduct | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (product: AdminProduct, created: boolean) => void;
}

// Form tambah/edit produk: POST/PUT /admin/products (ProductRequest). Stok diubah lewat panel stok, bukan di sini.
export default function ProductForm({ product, categories, onClose, onSaved }: ProductFormProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [form, setForm] = useState<ProductFormState>(() => (product ? formFromProduct(product) : emptyForm(String(categories[0]?.id ?? ''))));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function update<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setErrors({});
    try {
      const body = toPayload(form, product);
      const saved = product
        ? await api<AdminProduct>(`/admin/products/${product.id}`, { method: 'PUT', body })
        : await api<AdminProduct>('/admin/products', { method: 'POST', body });
      onSaved(saved, !product);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.errors);
        setError(err.message);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const pairRow = (label: string, key: 'specs' | 'solubility', headA: string, headB: string) => (
    <ListField<string[]>
      label={label}
      items={form[key]}
      onChange={(items) => update(key, items)}
      createItem={() => ['', '']}
      addLabel={t('Tambah baris', 'Add row')}
      error={firstError(errors, key)}
      itemHasError={(index) => !!firstError(errors, `${key}.${index}`, `${key}.${index}.0`, `${key}.${index}.1`)}
      renderItem={(row, _index, set) => (
        <div className="admin-form-row">
          <label>
            <span className="field-label">{headA}</span>
            <input value={row[0] ?? ''} onChange={(e) => set([e.target.value, row[1] ?? ''])} />
          </label>
          <label>
            <span className="field-label">{headB}</span>
            <input value={row[1] ?? ''} onChange={(e) => set([row[0] ?? '', e.target.value])} />
          </label>
        </div>
      )}
    />
  );

  return (
    <AdminModal title={product ? `${t('Edit produk', 'Edit product')}: ${tr(product.name, lang)}` : t('Tambah produk', 'Add product')} onClose={onClose} width={960}>
      <form className="admin-form" onSubmit={(e) => void submit(e)}>
        {error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-form-row">
          <label>
            <span className="field-label">{t('Kode produk', 'Product code')} *</span>
            <input value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="RSP-35" required aria-invalid={!!firstError(errors, 'code')} />
            {firstError(errors, 'code') && <small className="cms-field-error">{firstError(errors, 'code')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Kategori', 'Category')} *</span>
            <select value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)} required>
              {categories.length === 0 && <option value="">{t('— Belum ada kategori —', '— No categories yet —')}</option>}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {tr(category.name, lang)}
                  {!category.isActive ? ` (${t('nonaktif', 'inactive')})` : ''}
                </option>
              ))}
            </select>
            {firstError(errors, 'categoryId') && <small className="cms-field-error">{firstError(errors, 'categoryId')}</small>}
          </label>
        </div>

        <I18nInput label={t('Nama produk', 'Product name')} value={form.name} onChange={(v) => update('name', v)} required errorId={firstError(errors, 'name.id', 'name')} errorEn={firstError(errors, 'name.en')} />

        <div className="admin-form-row">
          <label>
            <span className="field-label">{t('Jenis / material', 'Kind / material')}</span>
            <input value={form.kind} onChange={(e) => update('kind', e.target.value)} placeholder={t('Contoh: Cyclised Rubber', 'e.g. Cyclised Rubber')} />
          </label>
          <label>
            <span className="field-label">Slug URL</span>
            <input value={form.slug} onChange={(e) => update('slug', e.target.value)} placeholder={t('otomatis dari nama', 'auto from name')} />
            {firstError(errors, 'slug') && <small className="cms-field-error">{firstError(errors, 'slug')}</small>}
          </label>
        </div>

        <I18nInput label={t('Ringkasan', 'Summary')} value={form.summary} onChange={(v) => update('summary', v)} multiline rows={3} errorId={firstError(errors, 'summary.id', 'summary')} errorEn={firstError(errors, 'summary.en')} />

        <label>
          <span className="field-label">{t('Kata kunci pencarian (alias)', 'Search aliases')}</span>
          <input value={form.aliases} onChange={(e) => update('aliases', e.target.value)} placeholder={t('pisahkan dengan koma: egrek, sarung pisau, cover', 'comma separated: egrek, sickle cover')} />
          <small className="admin-field-hint">{t('Membantu pencarian katalog; tidak ditampilkan ke customer.', 'Helps catalog search; not shown to customers.')}</small>
          {firstError(errors, 'aliases') && <small className="cms-field-error">{firstError(errors, 'aliases')}</small>}
        </label>

        <I18nInput
          label={t('Keunggulan (satu baris per poin)', 'Highlights (one per line)')}
          value={form.highlights}
          onChange={(v) => update('highlights', v)}
          multiline
          rows={4}
          hint={t('Tampil sebagai daftar poin di halaman produk.', 'Shown as a bullet list on the product page.')}
          errorId={firstError(errors, 'highlights', 'highlights.id')}
          errorEn={firstError(errors, 'highlights.en')}
        />
        <I18nInput
          label={t('Aplikasi / penggunaan (satu baris per item)', 'Applications (one per line)')}
          value={form.applications}
          onChange={(v) => update('applications', v)}
          multiline
          rows={3}
          errorId={firstError(errors, 'applications', 'applications.id')}
          errorEn={firstError(errors, 'applications.en')}
        />

        {pairRow(t('Spesifikasi teknis', 'Technical specifications'), 'specs', t('Parameter', 'Parameter'), t('Nilai', 'Value'))}
        {pairRow(t('Kelarutan (solubility)', 'Solubility'), 'solubility', t('Pelarut', 'Solvent'), t('Hasil', 'Result'))}

        <div className="admin-form-row admin-form-row-3">
          <label>
            <span className="field-label">{t('Mode harga', 'Pricing mode')}</span>
            <select value={form.priceMode} onChange={(e) => update('priceMode', e.target.value as PriceMode)}>
              <option value="fixed">{t('Harga tetap', 'Fixed price')}</option>
              <option value="quote">{t('Penawaran (hubungi marketing)', 'Quote (contact sales)')}</option>
            </select>
          </label>
          <label>
            <span className="field-label">{t('Harga (Rp, sebelum promo)', 'Price (Rp, before promo)')}</span>
            <input type="number" min={0} step={1} value={form.price} onChange={(e) => update('price', e.target.value)} disabled={form.priceMode !== 'fixed'} required={form.priceMode === 'fixed'} />
            {firstError(errors, 'price') && <small className="cms-field-error">{firstError(errors, 'price')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Satuan', 'Unit')}</span>
            <input value={form.unit} onChange={(e) => update('unit', e.target.value)} placeholder="kg / pcs" required />
          </label>
        </div>

        {form.priceMode === 'fixed' && (
          <div className="admin-form-row admin-form-row-3">
            <label>
              <span className="field-label">{t('Harga promo (Rp)', 'Promo price (Rp)')}</span>
              <input type="number" min={0} step={1} value={form.promoPrice} onChange={(e) => update('promoPrice', e.target.value)} placeholder={t('kosong = tanpa promo', 'empty = no promo')} />
              {firstError(errors, 'promoPrice') && <small className="cms-field-error">{firstError(errors, 'promoPrice')}</small>}
            </label>
            <label>
              <span className="field-label">{t('Promo mulai', 'Promo starts')}</span>
              <input type="datetime-local" value={form.promoStartsAt} onChange={(e) => update('promoStartsAt', e.target.value)} />
              {firstError(errors, 'promoStartsAt') && <small className="cms-field-error">{firstError(errors, 'promoStartsAt')}</small>}
            </label>
            <label>
              <span className="field-label">{t('Promo berakhir', 'Promo ends')}</span>
              <input type="datetime-local" value={form.promoEndsAt} onChange={(e) => update('promoEndsAt', e.target.value)} />
              {firstError(errors, 'promoEndsAt') && <small className="cms-field-error">{firstError(errors, 'promoEndsAt')}</small>}
            </label>
          </div>
        )}

        <div className="admin-form-row admin-form-row-3">
          <label>
            <span className="field-label">{t('Panjang kemasan (cm)', 'Package length (cm)')}</span>
            <input type="number" min={0.1} step={0.1} value={form.lengthCm} onChange={(e) => update('lengthCm', e.target.value)} placeholder="40" />
            {firstError(errors, 'lengthCm') && <small className="cms-field-error">{firstError(errors, 'lengthCm')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Lebar kemasan (cm)', 'Package width (cm)')}</span>
            <input type="number" min={0.1} step={0.1} value={form.widthCm} onChange={(e) => update('widthCm', e.target.value)} placeholder="30" />
            {firstError(errors, 'widthCm') && <small className="cms-field-error">{firstError(errors, 'widthCm')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Tinggi kemasan (cm)', 'Package height (cm)')}</span>
            <input type="number" min={0.1} step={0.1} value={form.heightCm} onChange={(e) => update('heightCm', e.target.value)} placeholder="25" />
            {firstError(errors, 'heightCm') && <small className="cms-field-error">{firstError(errors, 'heightCm')}</small>}
          </label>
        </div>
        <p className="admin-field-hint">
          {(() => {
            const volume = (Number(form.lengthCm) || 0) * (Number(form.widthCm) || 0) * (Number(form.heightCm) || 0);
            return volume > 0
              ? t(`Volume per satuan ${(volume / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 4 })} m³ — dipakai untuk ongkir per m³.`, `Volume per unit ${(volume / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: 4 })} m³ — used for per-m³ shipping.`)
              : t('Isi ketiga dimensi kemasan per satuan jual agar volume ikut dihitung di ongkir; kosong = volume tidak dihitung.', 'Fill in all three package dimensions per sale unit so volume counts toward shipping; empty = volume ignored.');
          })()}
        </p>

        <div className="admin-form-row admin-form-row-3">
          <label>
            <span className="field-label">{t('Minimum order (MOQ)', 'Minimum order (MOQ)')}</span>
            <input type="number" min={1} step={1} value={form.moq} onChange={(e) => update('moq', e.target.value)} required />
            {firstError(errors, 'moq') && <small className="cms-field-error">{firstError(errors, 'moq')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Berat per satuan (gram)', 'Weight per unit (gram)')}</span>
            <input type="number" min={1} step={1} value={form.weightGram} onChange={(e) => update('weightGram', e.target.value)} required />
            <small className="admin-field-hint">{t('Dipakai untuk ongkir per kg.', 'Used for per-kg shipping.')}</small>
            {firstError(errors, 'weightGram') && <small className="cms-field-error">{firstError(errors, 'weightGram')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Status stok', 'Stock status')}</span>
            <select value={form.stockStatus} onChange={(e) => update('stockStatus', e.target.value as '' | 'made_to_order')}>
              <option value="">{t('Otomatis dari stok tersedia', 'Automatic from available stock')}</option>
              <option value="made_to_order">{t('Pre-order / made to order (manual)', 'Made to order (manual)')}</option>
            </select>
            <small className="admin-field-hint">{t('Jumlah stok diubah lewat tombol "Stok" pada daftar produk.', 'Stock quantity is changed via the "Stock" button on the product list.')}</small>
          </label>
        </div>

        <div className="admin-form-row">
          <label className="cms-check">
            <input type="checkbox" checked={form.isTaxable} onChange={(e) => update('isTaxable', e.target.checked)} />
            <span>{t('Dikenai PPN', 'Subject to VAT')}</span>
          </label>
          <label className="cms-check">
            <input type="checkbox" checked={form.isPublished} onChange={(e) => update('isPublished', e.target.checked)} />
            <span>{t('Tampilkan di katalog (publish)', 'Show in catalog (published)')}</span>
          </label>
        </div>

        <ListField<MediaValue>
          label={t('Foto & video produk (urutan = urutan geser di halaman produk)', 'Product photos & videos (order = swipe order on the product page)')}
          items={form.images}
          onChange={(items) => update('images', items)}
          createItem={() => null}
          maxItems={20}
          addLabel={t('Tambah foto / video', 'Add photo / video')}
          error={firstError(errors, 'images', 'thumbnailMediaId')}
          itemHasError={(index) => !!firstError(errors, `images.${index}`)}
          renderItem={(item, index, set) => {
            const id = mediaId(item);
            const video = isVideo(item);
            // Tanpa pilihan, thumbnail = foto pertama di daftar (sama dengan perilaku server).
            const firstPhoto = form.images.find((entry) => mediaId(entry) !== null && !isVideo(entry));
            const chosen = form.images.some((entry) => mediaId(entry) === form.thumbnailId && !isVideo(entry)) ? form.thumbnailId : mediaId(firstPhoto);
            return (
              <div className="product-media-item">
                <MediaPicker value={item} onChange={set} accept="visual" collection="products" />
                {id !== null &&
                  (video ? (
                    <span className="admin-field-hint">
                      <Icon name="video" size={15} /> {t('Video: tampil di galeri geser, tidak bisa menjadi thumbnail.', 'Video: shown in the swipe gallery, cannot be the thumbnail.')}
                    </span>
                  ) : (
                    <label className="product-thumb-choice">
                      <input type="radio" name="product-thumbnail" checked={chosen === id} onChange={() => update('thumbnailId', id)} />
                      <span>
                        {t('Jadikan thumbnail', 'Use as thumbnail')}
                        {chosen === id && <em>{t('Thumbnail', 'Thumbnail')}</em>}
                      </span>
                    </label>
                  ))}
                {firstError(errors, `images.${index}`) && <small className="form-error">{firstError(errors, `images.${index}`)}</small>}
              </div>
            );
          }}
        />
        <p className="admin-field-hint">
          {t(
            'Thumbnail adalah foto yang tampil di kartu produk, keranjang, dan pesanan. Customer dapat menggeser semua foto dan video di halaman produk. Video: MP4/WebM.',
            'The thumbnail is the photo shown on product cards, in the cart, and on orders. Customers can swipe through every photo and video on the product page. Video: MP4/WebM.',
          )}
        </p>

        <footer className="admin-modal-actions">
          <button type="button" className="btn btn-line btn-sm" onClick={onClose}>
            {t('Batal', 'Cancel')}
          </button>
          <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
            <Icon name="check" size={16} /> {saving ? t('Menyimpan...', 'Saving...') : product ? t('Simpan perubahan', 'Save changes') : t('Tambah produk', 'Add product')}
          </button>
        </footer>
      </form>
    </AdminModal>
  );
}
