'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, MediaPicker, firstError, type FieldErrors, type MediaValue } from '@/components/admin/cms';
import { mediaId } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import { numberOrNull, paymentMethodConfig, paymentMethodTypeLabels, type PaymentDriver, type PaymentMethodRow } from '@/lib/admin';
import type { PaymentMethodType } from '@/lib/types';

interface MethodForm {
  code: string;
  type: PaymentMethodType;
  driver: PaymentDriver;
  name: I18n;
  instructions: I18n;
  isActive: boolean;
  sortOrder: string;
  qrisMedia: MediaValue;
  channelCode: string;
  bankCode: string;
  feePercent: string;
  feeFixed: string;
}

const TYPES = Object.keys(paymentMethodTypeLabels) as PaymentMethodType[];
const GATEWAY_TYPES: PaymentMethodType[] = ['qris_dynamic', 'virtual_account', 'ewallet'];

const emptyForm = (sortOrder: number): MethodForm => ({
  code: '',
  type: 'manual_transfer',
  driver: 'manual',
  name: emptyI18n(),
  instructions: emptyI18n(),
  isActive: false,
  sortOrder: String(sortOrder),
  qrisMedia: null,
  channelCode: '',
  bankCode: '',
  feePercent: '',
  feeFixed: '',
});

function formFrom(row: PaymentMethodRow): MethodForm {
  const config = paymentMethodConfig(row);
  return {
    code: row.code,
    type: row.type,
    driver: row.driver,
    name: { ...row.name },
    instructions: row.instructions ? { ...row.instructions } : emptyI18n(),
    isActive: row.isActive,
    sortOrder: String(row.sortOrder),
    qrisMedia: config.qrisMediaId ? (row.qrisImageUrl ? { id: config.qrisMediaId, url: row.qrisImageUrl, mime: 'image/png', size: 0, originalName: 'qris' } : { id: config.qrisMediaId }) : null,
    channelCode: config.channelCode ?? '',
    bankCode: config.bankCode ?? '',
    feePercent: config.feePercent == null ? '' : String(config.feePercent),
    feeFixed: config.feeFixed == null ? '' : String(config.feeFixed),
  };
}

function toPayload(form: MethodForm) {
  const config: Record<string, unknown> = {};
  if (form.type === 'qris_static') config.qrisMediaId = mediaId(form.qrisMedia);
  if (form.driver === 'xendit') {
    config.channelCode = form.channelCode.trim() || null;
    config.bankCode = form.bankCode.trim() || null;
    config.feePercent = numberOrNull(form.feePercent);
    config.feeFixed = numberOrNull(form.feeFixed);
  }
  return {
    code: form.code.trim().toLowerCase(),
    type: form.type,
    driver: form.driver,
    name: { id: form.name.id.trim(), en: form.name.en.trim() },
    instructions: { id: form.instructions.id.trim(), en: form.instructions.en.trim() },
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
    config,
  };
}

// Metode pembayaran: GET/POST /admin/payment-methods, PUT /admin/payment-methods/{id} (tanpa DELETE; nonaktifkan lewat isActive).
export default function AdminPaymentMethods() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentMethodRow | null>(null);
  const [form, setForm] = useState<MethodForm>(() => emptyForm(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<PaymentMethodRow[]>('/admin/payment-methods'));
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

  function openForm(row: PaymentMethodRow | null) {
    setEditing(row);
    setForm(row ? formFrom(row) : emptyForm(rows.length));
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  function update<K extends keyof MethodForm>(key: K, value: MethodForm[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      // Driver mengikuti tipe: manual untuk transfer/QRIS statis, xendit untuk tipe gateway.
      if (key === 'type') next.driver = GATEWAY_TYPES.includes(value as PaymentMethodType) ? 'xendit' : 'manual';
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      if (editing) {
        await api(`/admin/payment-methods/${editing.id}`, { method: 'PUT', body: toPayload(form) });
      } else {
        await api('/admin/payment-methods', { method: 'POST', body: toPayload(form) });
      }
      await refresh();
      setNotice(editing ? t('Metode pembayaran diperbarui.', 'Payment method updated.') : t('Metode pembayaran ditambahkan.', 'Payment method added.'));
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

  async function toggleActive(row: PaymentMethodRow) {
    setBusy(true);
    setError('');
    try {
      await api(`/admin/payment-methods/${row.id}`, { method: 'PUT', body: toPayload({ ...formFrom(row), isActive: !row.isActive }) });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<PaymentMethodRow>[] = [
    {
      key: 'name',
      label: t('Metode', 'Method'),
      render: (m) => (
        <span className="cms-cell-media">
          {m.type === 'qris_static' && m.qrisImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.qrisImageUrl} alt="" className="cms-cell-thumb cms-cell-thumb-contain" />
          ) : null}
          <span>
            <strong>{tr(m.name, lang)}</strong>
            <small className="admin-cell-sub mono">{m.code}</small>
          </span>
        </span>
      ),
    },
    { key: 'type', label: t('Jenis', 'Type'), render: (m) => paymentMethodTypeLabels[m.type]?.[lang] || m.type },
    {
      key: 'driver',
      label: 'Driver',
      render: (m) => <span className="mono">{m.driver === 'xendit' ? 'xendit (gateway)' : 'manual'}</span>,
    },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right', render: (m) => String(m.sortOrder) },
    {
      key: 'isActive',
      label: 'Status',
      render: (m) => <StatusBadge label={m.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={m.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (m) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(m) },
            m.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: busy, onClick: () => void toggleActive(m) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', disabled: busy, onClick: () => void toggleActive(m) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Metode Pembayaran', 'Payment Methods')}
        desc={t('Metode yang ditawarkan saat checkout. Metode tidak bisa dihapus karena dirujuk riwayat pembayaran; nonaktifkan bila tidak dipakai.', 'Methods offered at checkout. Methods cannot be deleted because payment history refers to them; deactivate instead.')}
        action={{ label: t('Tambah metode', 'Add method'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} pagination={false} empty={loading ? t('Memuat metode...', 'Loading methods...') : t('Belum ada metode pembayaran.', 'No payment methods yet.')} />

      <p className="cms-hint" style={{ marginTop: 18 }}>
        {t(
          'Metode gateway (QRIS dinamis, virtual account, e-wallet) memakai driver Xendit. Kunci rahasia gateway tidak pernah disimpan lewat panel ini: isi XENDIT_SECRET_KEY dan XENDIT_CALLBACK_TOKEN di berkas .env server, lalu aktifkan metodenya di sini.',
          'Gateway methods (dynamic QRIS, virtual account, e-wallet) use the Xendit driver. Gateway secrets are never stored through this panel: set XENDIT_SECRET_KEY and XENDIT_CALLBACK_TOKEN in the server .env file, then activate the method here.',
        )}
      </p>

      {formOpen && (
        <AdminModal title={editing ? `${t('Edit metode', 'Edit method')}: ${tr(editing.name, lang)}` : t('Tambah metode pembayaran', 'Add payment method')} onClose={() => setFormOpen(false)}>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Kode', 'Code')} *</span>
                <input value={form.code} onChange={(e) => update('code', e.target.value.toLowerCase())} placeholder="manual_transfer" required pattern="[a-z0-9_]+" disabled={!!editing} />
                <small className="admin-field-hint">{t('Huruf kecil, angka, _; dipakai sebagai id di checkout.', 'Lowercase letters, digits, _; used as the id at checkout.')}</small>
                {firstError(formErrors, 'code') && <small className="cms-field-error">{firstError(formErrors, 'code')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Jenis', 'Type')} *</span>
                <select value={form.type} onChange={(e) => update('type', e.target.value as PaymentMethodType)}>
                  {TYPES.map((key) => (
                    <option key={key} value={key}>
                      {paymentMethodTypeLabels[key][lang]}
                    </option>
                  ))}
                </select>
                {firstError(formErrors, 'type') && <small className="cms-field-error">{firstError(formErrors, 'type')}</small>}
              </label>
              <label>
                <span className="field-label">Driver</span>
                <select value={form.driver} onChange={(e) => update('driver', e.target.value as PaymentDriver)}>
                  <option value="manual">manual ({t('verifikasi admin', 'admin verification')})</option>
                  <option value="xendit">xendit ({t('gateway otomatis', 'automatic gateway')})</option>
                </select>
                {firstError(formErrors, 'driver') && <small className="cms-field-error">{firstError(formErrors, 'driver')}</small>}
              </label>
            </div>

            <I18nInput label={t('Nama tampil', 'Display name')} value={form.name} onChange={(v) => update('name', v)} required errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <I18nInput
              label={t('Instruksi pembayaran', 'Payment instructions')}
              value={form.instructions}
              onChange={(v) => update('instructions', v)}
              multiline
              rows={3}
              hint={t('Ditampilkan ke customer setelah checkout.', 'Shown to the customer after checkout.')}
              errorId={firstError(formErrors, 'instructions.id', 'instructions')}
              errorEn={firstError(formErrors, 'instructions.en')}
            />

            {form.type === 'qris_static' && (
              <MediaPicker
                label={t('Gambar kode QRIS', 'QRIS code image')}
                value={form.qrisMedia}
                onChange={(media) => update('qrisMedia', media)}
                accept="image"
                collection="qris"
                required
                hint={t('Unggah gambar QRIS statis merchant (PNG/JPG). Customer memindainya lalu mengunggah bukti bayar.', 'Upload the merchant static QRIS image (PNG/JPG). Customers scan it and upload the payment proof.')}
                error={firstError(formErrors, 'config.qrisMediaId')}
              />
            )}

            {form.driver === 'xendit' && (
              <div className="cms-list" style={{ padding: 14 }}>
                <span className="field-label">{t('Konfigurasi gateway (non-rahasia)', 'Gateway configuration (non-secret)')}</span>
                <div className="admin-form-row">
                  <label>
                    <span className="field-label">Channel code</span>
                    <input value={form.channelCode} onChange={(e) => update('channelCode', e.target.value)} placeholder="QRIS / OVO / DANA" />
                    {firstError(formErrors, 'config.channelCode') && <small className="cms-field-error">{firstError(formErrors, 'config.channelCode')}</small>}
                  </label>
                  <label>
                    <span className="field-label">Bank code</span>
                    <input value={form.bankCode} onChange={(e) => update('bankCode', e.target.value)} placeholder="BCA / MANDIRI" />
                    {firstError(formErrors, 'config.bankCode') && <small className="cms-field-error">{firstError(formErrors, 'config.bankCode')}</small>}
                  </label>
                </div>
                <div className="admin-form-row">
                  <label>
                    <span className="field-label">{t('Biaya gateway (%)', 'Gateway fee (%)')}</span>
                    <input type="number" min={0} max={100} step={0.01} value={form.feePercent} onChange={(e) => update('feePercent', e.target.value)} />
                    {firstError(formErrors, 'config.feePercent') && <small className="cms-field-error">{firstError(formErrors, 'config.feePercent')}</small>}
                  </label>
                  <label>
                    <span className="field-label">{t('Biaya gateway tetap (Rp)', 'Fixed gateway fee (Rp)')}</span>
                    <input type="number" min={0} step={1} value={form.feeFixed} onChange={(e) => update('feeFixed', e.target.value)} />
                    {firstError(formErrors, 'config.feeFixed') && <small className="cms-field-error">{firstError(formErrors, 'config.feeFixed')}</small>}
                  </label>
                </div>
                <small className="admin-field-hint">
                  {t('Kunci API Xendit (XENDIT_SECRET_KEY, XENDIT_CALLBACK_TOKEN) diatur di .env server; metode gateway baru bisa diaktifkan setelah kunci terpasang.', 'Xendit API keys (XENDIT_SECRET_KEY, XENDIT_CALLBACK_TOKEN) are set in the server .env; gateway methods can be activated once the keys are in place.')}
                </small>
              </div>
            )}

            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Urutan tampil', 'Display order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => update('sortOrder', e.target.value)} />
              </label>
              <label className="cms-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => update('isActive', e.target.checked)} />
                <span>{t('Aktif (ditawarkan saat checkout)', 'Active (offered at checkout)')}</span>
              </label>
            </div>

            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editing ? t('Simpan perubahan', 'Save changes') : t('Tambah metode', 'Add method')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
