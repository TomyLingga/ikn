'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import Select from '@/components/Select';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import { confirmDialog } from '@/components/ConfirmDialog';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import { deliveryMarketLabels, type PaymentTermPayload, type PaymentTermRow } from '@/lib/admin';
import type { DeliveryTermMarket } from '@/lib/types';

interface TermForm {
  code: string;
  name: I18n;
  description: I18n;
  market: DeliveryTermMarket;
  isActive: boolean;
  sortOrder: string;
}

const emptyTerm = (sortOrder: number): TermForm => ({ code: '', name: emptyI18n(), description: emptyI18n(), market: 'export', isActive: true, sortOrder: String(sortOrder) });

const formFromRow = (row: PaymentTermRow): TermForm => ({
  code: row.code,
  name: { ...row.name },
  description: row.description ? { ...row.description } : emptyI18n(),
  market: row.market,
  isActive: row.isActive,
  sortOrder: String(row.sortOrder),
});

// PUT membutuhkan body lengkap (name/market wajib), jadi toggle aktif mengirim baris apa adanya + patch.
const payloadFrom = (row: PaymentTermRow, patch: Partial<PaymentTermPayload> = {}): PaymentTermPayload => ({
  name: row.name,
  description: row.description ?? emptyI18n(),
  market: row.market,
  isActive: row.isActive,
  sortOrder: row.sortOrder,
  ...patch,
});

// Syarat pembayaran ekspor (ASUMSI A-87): GET/POST /admin/payment-terms, PUT/DELETE /admin/payment-terms/{id}
// (modul payment_methods). Customer ekspor wajib memilih satu saat checkout; order membekukan snapshot-nya untuk
// proforma dan commercial invoice. Hapus ditolak 409 PAYMENT_TERM_IN_USE bila sudah dipakai order.
export default function AdminPaymentTerms() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [rows, setRows] = useState<PaymentTermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<{ term: PaymentTermRow | null } | null>(null);
  const [form, setForm] = useState<TermForm>(() => emptyTerm(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<PaymentTermRow[]>('/admin/payment-terms'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  function openForm(term: PaymentTermRow | null) {
    setForm(term ? formFromRow(term) : emptyTerm(rows.length));
    setFormErrors({});
    setFormError('');
    setModal({ term });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const body: PaymentTermPayload = {
      ...(modal.term ? {} : { code: form.code.trim().toLowerCase() }),
      name: { id: form.name.id.trim(), en: form.name.en.trim() },
      description: { id: form.description.id.trim(), en: form.description.en.trim() },
      market: form.market,
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder) || 0,
    };
    try {
      if (modal.term) await api(`/admin/payment-terms/${modal.term.id}`, { method: 'PUT', body });
      else await api('/admin/payment-terms', { method: 'POST', body });
      await refresh();
      setNotice(modal.term ? t('Syarat pembayaran diperbarui.', 'Payment term updated.') : t('Syarat pembayaran ditambahkan.', 'Payment term added.'));
      setModal(null);
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

  async function toggle(row: PaymentTermRow) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/payment-terms/${row.id}`, { method: 'PUT', body: payloadFrom(row, { isActive: !row.isActive }) });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: PaymentTermRow) {
    if (!(await confirmDialog(t(`Hapus syarat pembayaran "${tr(row.name, lang)}"?`, `Delete payment term "${tr(row.name, lang)}"?`)))) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/payment-terms/${row.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Syarat pembayaran dihapus.', 'Payment term deleted.'));
    } catch (err) {
      // 409 PAYMENT_TERM_IN_USE: pesan server menjelaskan bahwa syarat sudah dipakai order; nonaktifkan saja.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PaymentTermRow>[] = [
    {
      key: 'name',
      label: t('Nama', 'Name'),
      render: (row) => (
        <span>
          <strong>{tr(row.name, lang)}</strong>
          <small className="admin-cell-sub mono">
            {row.code}
            {row.ordersCount ? ` · ${row.ordersCount} order` : ''}
          </small>
        </span>
      ),
    },
    { key: 'description', label: t('Keterangan', 'Description'), render: (row) => tr(row.description, lang) || '—' },
    { key: 'market', label: t('Pasar', 'Market'), render: (row) => deliveryMarketLabels[row.market]?.[lang] || row.market },
    { key: 'sort', label: t('Urutan', 'Order'), align: 'right', render: (row) => String(row.sortOrder) },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <StatusBadge label={row.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={row.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (row) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(row) },
            row.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: busy, onClick: () => void toggle(row) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', disabled: busy, onClick: () => void toggle(row) },
            { label: t('Hapus', 'Delete'), tone: 'danger', disabled: busy, onClick: () => void remove(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Syarat Pembayaran', 'Payment Terms')}
        desc={t(
          'Syarat pembayaran yang dipilih customer ekspor saat checkout dan dicetak di proforma serta commercial invoice. Aplikasi tetap mencatat satu pembayaran sebesar total order.',
          'Payment terms export customers pick at checkout, printed on the proforma and commercial invoice. The app still records one payment for the order total.',
        )}
        action={{ label: t('Tambah syarat', 'Add term'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey="id"
        loading={loading}
        empty={loading ? t('Memuat syarat pembayaran...', 'Loading payment terms...') : t('Belum ada syarat pembayaran; customer ekspor tidak bisa checkout sampai ada satu yang aktif.', 'No payment terms yet; export customers cannot check out until one is active.')}
      />

      {modal && (
        <AdminModal title={modal.term ? `${t('Edit syarat pembayaran', 'Edit payment term')}: ${tr(modal.term.name, lang)}` : t('Tambah syarat pembayaran', 'Add payment term')} onClose={() => setModal(null)}>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Kode', 'Code')} *</span>
                <input value={form.code} maxLength={32} disabled={!!modal.term} required={!modal.term} pattern="[a-z0-9][a-z0-9_-]*" className="mono" onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} placeholder="tt_advance" />
                <small className="admin-field-hint">{modal.term ? t('Kode tidak bisa diubah setelah dibuat.', 'The code cannot be changed after creation.') : t('Huruf kecil, angka, tanda hubung atau garis bawah.', 'Lowercase letters, digits, hyphens or underscores.')}</small>
                {firstError(formErrors, 'code') && <small className="cms-field-error">{firstError(formErrors, 'code')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Urutan', 'Order')}</span>
                <input type="number" min={-1000} max={1000} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
                {firstError(formErrors, 'sortOrder') && <small className="cms-field-error">{firstError(formErrors, 'sortOrder')}</small>}
              </label>
            </div>
            <I18nInput label={t('Nama', 'Name')} value={form.name} onChange={(v) => setForm({ ...form, name: v })} required maxLength={160} placeholder="100% T/T in advance" errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <I18nInput label={t('Keterangan', 'Description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} multiline rows={2} maxLength={500} errorId={firstError(formErrors, 'description.id', 'description')} errorEn={firstError(formErrors, 'description.en')} />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Pasar', 'Market')}</span>
                <Select value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value as DeliveryTermMarket })}>
                  {(Object.keys(deliveryMarketLabels) as DeliveryTermMarket[]).map((key) => (
                    <option key={key} value={key}>
                      {deliveryMarketLabels[key][lang]}
                    </option>
                  ))}
                </Select>
                {firstError(formErrors, 'market') && <small className="cms-field-error">{firstError(formErrors, 'market')}</small>}
              </label>
              <label className="cms-check" style={{ alignSelf: 'center' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>{t('Aktif', 'Active')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : modal.term ? t('Simpan perubahan', 'Save changes') : t('Tambah syarat', 'Add term')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
