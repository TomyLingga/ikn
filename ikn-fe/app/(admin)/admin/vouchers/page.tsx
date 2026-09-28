'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { Pager, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, apiPaged, ApiError, errorMessage } from '@/lib/api';
import { tr, type PagedMeta } from '@/lib/cms';
import {
  fromDateTimeLocal,
  numberOrNull,
  queryString,
  toDateTimeLocal,
  voucherScopeLabels,
  voucherTypeLabels,
  type VoucherRow,
  type VoucherScope,
  type VoucherType,
} from '@/lib/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import type { Category } from '@/lib/types';

interface VoucherForm {
  code: string;
  type: VoucherType;
  value: string;
  minSubtotal: string;
  maxDiscount: string;
  quota: string;
  perUserLimit: string;
  scope: VoucherScope;
  categoryIds: number[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

const PER_PAGE = 20;

const emptyForm = (): VoucherForm => ({ code: '', type: 'percent', value: '', minSubtotal: '0', maxDiscount: '', quota: '', perUserLimit: '', scope: 'all', categoryIds: [], startsAt: '', endsAt: '', isActive: true });

const formFrom = (v: VoucherRow): VoucherForm => ({
  code: v.code,
  type: v.type,
  value: String(v.value),
  minSubtotal: String(v.minSubtotal),
  maxDiscount: v.maxDiscount === null ? '' : String(v.maxDiscount),
  quota: v.quota === null ? '' : String(v.quota),
  perUserLimit: v.perUserLimit === null ? '' : String(v.perUserLimit),
  scope: v.scope,
  categoryIds: [...v.categoryIds],
  startsAt: toDateTimeLocal(v.startsAt),
  endsAt: toDateTimeLocal(v.endsAt),
  isActive: v.isActive,
});

function toPayload(form: VoucherForm) {
  return {
    code: form.code.trim().toUpperCase(),
    type: form.type,
    value: Number(form.value) || 0,
    minSubtotal: Number(form.minSubtotal) || 0,
    maxDiscount: numberOrNull(form.maxDiscount),
    quota: numberOrNull(form.quota),
    perUserLimit: numberOrNull(form.perUserLimit),
    scope: form.scope,
    categoryIds: form.scope === 'category' ? form.categoryIds : [],
    startsAt: fromDateTimeLocal(form.startsAt),
    endsAt: fromDateTimeLocal(form.endsAt),
    isActive: form.isActive,
  };
}

function voucherState(v: VoucherRow, now: number): 'inactive' | 'scheduled' | 'expired' | 'exhausted' | 'active' {
  if (!v.isActive) return 'inactive';
  if (v.startsAt && new Date(v.startsAt).getTime() > now) return 'scheduled';
  if (v.endsAt && new Date(v.endsAt).getTime() < now) return 'expired';
  if (v.quota !== null && v.usedCount >= v.quota) return 'exhausted';
  return 'active';
}

// Voucher diskon: GET/POST /admin/vouchers, PUT/DELETE /admin/vouchers/{id}; scope all|category (categoryIds[]).
export default function AdminVouchers() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<VoucherRow[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [active, setActive] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherRow | null>(null);
  const [form, setForm] = useState<VoucherForm>(emptyForm);
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<VoucherRow>(`/admin/vouchers${queryString({ q, active, page, perPage: PER_PAGE })}`);
      setRows(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [q, active, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    api<Category[]>('/admin/categories')
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openForm(row: VoucherRow | null) {
    setEditing(row);
    setForm(row ? formFrom(row) : emptyForm());
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (form.scope === 'category' && form.categoryIds.length === 0) {
      setFormError(t('Pilih minimal satu kategori untuk cakupan kategori.', 'Pick at least one category for the category scope.'));
      return;
    }
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      if (editing) {
        await api(`/admin/vouchers/${editing.id}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/vouchers', { method: 'POST', body: toPayload(form) });
      }
      await refresh();
      setNotice(editing ? t('Voucher diperbarui.', 'Voucher updated.') : t('Voucher ditambahkan.', 'Voucher added.'));
      setFormOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(err.errors);
        setFormError(err.message);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: VoucherRow) {
    setError('');
    try {
      await api(`/admin/vouchers/${row.id}`, { method: 'PUT', body: toPayload({ ...formFrom(row), isActive: !row.isActive }) });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: VoucherRow) {
    if (!window.confirm(t(`Hapus voucher ${row.code}? Order yang sudah memakainya tetap tersimpan.`, `Delete voucher ${row.code}? Orders that used it are kept.`))) return;
    setError('');
    try {
      await api(`/admin/vouchers/${row.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Voucher dihapus.', 'Voucher deleted.'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const now = Date.now();
  const stateLabel: Record<ReturnType<typeof voucherState>, { id: string; en: string; tone: 'ok' | 'warn' | 'bad' | 'info' }> = {
    active: { id: 'Berlaku', en: 'Active', tone: 'ok' },
    scheduled: { id: 'Terjadwal', en: 'Scheduled', tone: 'info' },
    expired: { id: 'Kedaluwarsa', en: 'Expired', tone: 'bad' },
    exhausted: { id: 'Kuota habis', en: 'Quota used up', tone: 'warn' },
    inactive: { id: 'Nonaktif', en: 'Inactive', tone: 'bad' },
  };

  const categoryName = (id: number) => {
    const c = categories.find((x) => x.id === id);
    return c ? tr(c.name, lang) : `#${id}`;
  };

  const columns: Column<VoucherRow>[] = [
    {
      key: 'code',
      label: t('Kode', 'Code'),
      render: (v) => (
        <span>
          <strong className="mono">{v.code}</strong>
          <small className="admin-cell-sub">
            {v.scope === 'all' ? voucherScopeLabels.all[lang] : v.categoryIds.map(categoryName).join(', ')}
          </small>
        </span>
      ),
    },
    {
      key: 'discount',
      label: t('Diskon', 'Discount'),
      render: (v) => (
        <span>
          <strong>{v.type === 'percent' ? `${v.value}%` : formatIDR(v.value)}</strong>
          {v.maxDiscount !== null && <small className="admin-cell-sub">{t('maks.', 'max')} {formatIDR(v.maxDiscount)}</small>}
        </span>
      ),
    },
    { key: 'minSubtotal', label: t('Min. belanja', 'Min. subtotal'), align: 'right', render: (v) => (v.minSubtotal > 0 ? formatIDR(v.minSubtotal) : '—') },
    {
      key: 'quota',
      label: t('Terpakai / kuota', 'Used / quota'),
      align: 'right',
      render: (v) => (
        <span className="mono">
          {v.usedCount} / {v.quota === null ? '∞' : v.quota}
          {v.perUserLimit !== null && <small className="admin-cell-sub">{t('per customer', 'per customer')} {v.perUserLimit}</small>}
        </span>
      ),
    },
    {
      key: 'period',
      label: t('Periode', 'Period'),
      render: (v) => (
        <span>
          {v.startsAt ? formatDateTime(v.startsAt, lang) : t('sekarang', 'now')}
          <small className="admin-cell-sub">{t('s/d', 'until')} {v.endsAt ? formatDateTime(v.endsAt, lang) : t('tanpa batas', 'no end')}</small>
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => {
        const s = stateLabel[voucherState(v, now)];
        return <StatusBadge label={s[lang]} tone={s.tone} small />;
      },
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (v) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(v) },
            v.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', onClick: () => void toggleActive(v) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleActive(v) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(v) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Voucher', 'Vouchers')}
        desc={t('Kode diskon yang dimasukkan customer saat checkout. Kuota terpakai dihitung dari order aktif dan selesai.', 'Discount codes entered by customers at checkout. Used quota counts active and completed orders.')}
        action={{ label: t('Tambah voucher', 'Add voucher'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <form
        className="admin-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQ(search.trim());
        }}
      >
        <label className="admin-search">
          <span className="sr-only">{t('Cari kode', 'Search code')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari kode voucher', 'Search voucher code')} />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Cari', 'Search')}
        </button>
        <label className="admin-filter">
          <span>Status</span>
          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('Semua', 'All')}</option>
            <option value="1">{t('Aktif', 'Active')}</option>
            <option value="0">{t('Nonaktif', 'Inactive')}</option>
          </select>
        </label>
        <span className="admin-result-count">
          {meta.total} {t('voucher', 'vouchers')}
        </span>
      </form>

      <DataTable columns={columns} rows={rows} pagination={false} empty={loading ? t('Memuat voucher...', 'Loading vouchers...') : t('Belum ada voucher.', 'No vouchers yet.')} />
      <Pager meta={meta} onPage={setPage} disabled={loading} />

      {formOpen && (
        <AdminModal title={editing ? `${t('Edit voucher', 'Edit voucher')}: ${editing.code}` : t('Tambah voucher', 'Add voucher')} onClose={() => setFormOpen(false)}>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Kode voucher', 'Voucher code')} *</span>
                <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="IKN10" required pattern="[A-Za-z0-9_-]+" />
                <small className="admin-field-hint">{t('Huruf, angka, - dan _; disimpan huruf besar.', 'Letters, digits, - and _; stored uppercase.')}</small>
                {firstError(formErrors, 'code') && <small className="cms-field-error">{firstError(formErrors, 'code')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Jenis diskon', 'Discount type')}</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as VoucherType })}>
                  {(Object.keys(voucherTypeLabels) as VoucherType[]).map((key) => (
                    <option key={key} value={key}>
                      {voucherTypeLabels[key][lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">{form.type === 'percent' ? t('Persentase (%)', 'Percentage (%)') : t('Nominal (Rp)', 'Amount (Rp)')} *</span>
                <input type="number" min={0} max={form.type === 'percent' ? 100 : undefined} step={form.type === 'percent' ? 0.01 : 1} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
                {firstError(formErrors, 'value') && <small className="cms-field-error">{firstError(formErrors, 'value')}</small>}
              </label>
            </div>
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Minimum subtotal (Rp)', 'Minimum subtotal (Rp)')}</span>
                <input type="number" min={0} step={1} value={form.minSubtotal} onChange={(e) => setForm({ ...form, minSubtotal: e.target.value })} />
                {firstError(formErrors, 'minSubtotal') && <small className="cms-field-error">{firstError(formErrors, 'minSubtotal')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Maksimum diskon (Rp)', 'Maximum discount (Rp)')}</span>
                <input type="number" min={0} step={1} value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} placeholder={t('kosong = tanpa batas', 'empty = unlimited')} />
                {firstError(formErrors, 'maxDiscount') && <small className="cms-field-error">{firstError(formErrors, 'maxDiscount')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Kuota total', 'Total quota')}</span>
                <input type="number" min={0} step={1} value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} placeholder={t('kosong = tanpa batas', 'empty = unlimited')} />
                {editing && <small className="admin-field-hint">{t('Terpakai', 'Used')}: {editing.usedCount}</small>}
                {firstError(formErrors, 'quota') && <small className="cms-field-error">{firstError(formErrors, 'quota')}</small>}
              </label>
            </div>
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Batas per customer', 'Limit per customer')}</span>
                <input type="number" min={0} step={1} value={form.perUserLimit} onChange={(e) => setForm({ ...form, perUserLimit: e.target.value })} placeholder={t('kosong = tanpa batas', 'empty = unlimited')} />
                {firstError(formErrors, 'perUserLimit') && <small className="cms-field-error">{firstError(formErrors, 'perUserLimit')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Mulai berlaku', 'Starts at')}</span>
                <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
                {firstError(formErrors, 'startsAt') && <small className="cms-field-error">{firstError(formErrors, 'startsAt')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Berakhir', 'Ends at')}</span>
                <input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
                {firstError(formErrors, 'endsAt') && <small className="cms-field-error">{firstError(formErrors, 'endsAt')}</small>}
              </label>
            </div>
            <div className="cms-field">
              <span className="field-label">{t('Cakupan', 'Scope')}</span>
              <div className="admin-form-row">
                {(Object.keys(voucherScopeLabels) as VoucherScope[]).map((key) => (
                  <label key={key} className="cms-check">
                    <input type="radio" name="scope" checked={form.scope === key} onChange={() => setForm({ ...form, scope: key })} />
                    <span>{voucherScopeLabels[key][lang]}</span>
                  </label>
                ))}
              </div>
              {form.scope === 'category' && (
                <div className="cms-check-grid" style={{ marginTop: 8 }}>
                  {categories.length === 0 && <small className="admin-field-hint">{t('Daftar kategori tidak tersedia (butuh akses modul kategori).', 'Category list unavailable (requires the categories module).')}</small>}
                  {categories.map((c) => (
                    <label key={c.id} className="cms-check">
                      <input
                        type="checkbox"
                        checked={form.categoryIds.includes(c.id)}
                        onChange={(e) => setForm({ ...form, categoryIds: e.target.checked ? [...form.categoryIds, c.id] : form.categoryIds.filter((id) => id !== c.id) })}
                      />
                      <span>{tr(c.name, lang)}</span>
                    </label>
                  ))}
                </div>
              )}
              <small className="admin-field-hint">
                {t('Cakupan kategori: minimum subtotal dibandingkan dengan seluruh keranjang, diskon hanya dihitung dari item kategori terpilih.', 'Category scope: minimum subtotal is checked against the whole cart; the discount applies only to items in the selected categories.')}
              </small>
              {firstError(formErrors, 'categoryIds') && <small className="cms-field-error">{firstError(formErrors, 'categoryIds')}</small>}
            </div>
            <label className="cms-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              <span>{t('Aktif', 'Active')}</span>
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editing ? t('Simpan perubahan', 'Save changes') : t('Tambah voucher', 'Add voucher')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
