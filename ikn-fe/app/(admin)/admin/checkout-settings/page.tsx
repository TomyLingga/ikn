'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminCard, AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import { feeTypeLabels, type CommerceSettingsData, type FeeRow, type FeeType } from '@/lib/admin';
import { formatIDR } from '@/lib/format';

interface FeeForm {
  name: I18n;
  type: FeeType;
  amount: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyFee = (sortOrder: number): FeeForm => ({ name: emptyI18n(), type: 'admin', amount: '', isActive: true, sortOrder });

function feeFormFromRow(row: FeeRow): FeeForm {
  return { name: { ...row.name }, type: row.type, amount: String(row.amount), isActive: row.isActive, sortOrder: row.sortOrder };
}

function feePayload(form: FeeForm) {
  return { name: { id: form.name.id.trim(), en: form.name.en.trim() }, type: form.type, amount: Number(form.amount) || 0, isActive: form.isActive, sortOrder: form.sortOrder };
}

type SettingsForm = Record<keyof CommerceSettingsData, string | boolean>;

function settingsToForm(s: CommerceSettingsData): SettingsForm {
  return {
    paymentDueHours: String(s.paymentDueHours),
    uniqueCodeEnabled: s.uniqueCodeEnabled,
    taxRate: String(s.taxRate),
    priceIncludesTax: s.priceIncludesTax,
    autoCompleteDays: String(s.autoCompleteDays),
    reminderHoursBeforeDue: String(s.reminderHoursBeforeDue),
  };
}

// Pengaturan checkout: biaya tambahan (GET/POST/PUT/DELETE /admin/fees) + setting commerce (GET/PUT /admin/settings).
// Menggantikan halaman lama /admin/additional-fees.
export default function AdminCheckoutSettings() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [fees, setFees] = useState<FeeRow[]>([]);
  const [feesLoading, setFeesLoading] = useState(true);
  const [feesError, setFeesError] = useState('');
  const [feeOpen, setFeeOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeRow | null>(null);
  const [feeForm, setFeeForm] = useState<FeeForm>(() => emptyFee(0));
  const [feeErrors, setFeeErrors] = useState<FieldErrors>({});
  const [feeError, setFeeError] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);

  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [settingsErrors, setSettingsErrors] = useState<FieldErrors>({});
  const [settingsError, setSettingsError] = useState('');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadFees = useCallback(async () => {
    setFeesError('');
    try {
      setFees(await api<FeeRow[]>('/admin/fees'));
    } catch (err) {
      setFeesError(errorMessage(err));
    } finally {
      setFeesLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setSettingsError('');
    try {
      setSettings(settingsToForm(await api<CommerceSettingsData>('/admin/settings')));
    } catch (err) {
      setSettingsError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadFees();
    void loadSettings();
  }, [loadFees, loadSettings]);

  useEffect(() => {
    if (!settingsNotice) return;
    const timer = window.setTimeout(() => setSettingsNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [settingsNotice]);

  function openFee(row: FeeRow | null) {
    setEditingFee(row);
    setFeeForm(row ? feeFormFromRow(row) : emptyFee(fees.length));
    setFeeErrors({});
    setFeeError('');
    setFeeOpen(true);
  }

  async function submitFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feeSaving) return;
    setFeeSaving(true);
    setFeeError('');
    setFeeErrors({});
    try {
      if (editingFee) {
        await api(`/admin/fees/${editingFee.id}`, { method: 'PUT', body: feePayload(feeForm) });
      } else {
        await api('/admin/fees', { method: 'POST', body: feePayload(feeForm) });
      }
      await loadFees();
      setFeeOpen(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFeeErrors(err.errors);
        setFeeError(err.message);
      } else {
        setFeeError(errorMessage(err));
      }
    } finally {
      setFeeSaving(false);
    }
  }

  async function toggleFee(row: FeeRow) {
    setFeesError('');
    try {
      await api(`/admin/fees/${row.id}`, { method: 'PUT', body: feePayload({ ...feeFormFromRow(row), isActive: !row.isActive }) });
      await loadFees();
    } catch (err) {
      setFeesError(errorMessage(err));
    }
  }

  async function removeFee(row: FeeRow) {
    if (!window.confirm(t(`Hapus biaya "${tr(row.name, lang)}"?`, `Delete fee "${tr(row.name, lang)}"?`))) return;
    setFeesError('');
    try {
      await api(`/admin/fees/${row.id}`, { method: 'DELETE' });
      await loadFees();
    } catch (err) {
      setFeesError(errorMessage(err));
    }
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || settingsSaving) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsErrors({});
    try {
      const saved = await api<CommerceSettingsData>('/admin/settings', {
        method: 'PUT',
        body: {
          paymentDueHours: Number(settings.paymentDueHours),
          uniqueCodeEnabled: settings.uniqueCodeEnabled === true,
          taxRate: Number(settings.taxRate),
          priceIncludesTax: settings.priceIncludesTax === true,
          autoCompleteDays: Number(settings.autoCompleteDays),
          reminderHoursBeforeDue: Number(settings.reminderHoursBeforeDue),
        },
      });
      setSettings(settingsToForm(saved));
      setSettingsNotice(t('Pengaturan checkout disimpan.', 'Checkout settings saved.'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setSettingsErrors(err.errors);
        setSettingsError(err.message);
      } else {
        setSettingsError(errorMessage(err));
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  const feeColumns: Column<FeeRow>[] = [
    { key: 'name', label: t('Nama biaya', 'Fee name'), render: (f) => tr(f.name, lang) },
    { key: 'type', label: t('Jenis', 'Type'), render: (f) => feeTypeLabels[f.type]?.[lang] || f.type },
    { key: 'amount', label: t('Nominal', 'Amount'), align: 'right', render: (f) => formatIDR(f.amount) },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right', render: (f) => String(f.sortOrder) },
    {
      key: 'isActive',
      label: 'Status',
      render: (f) => <StatusBadge label={f.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={f.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (f) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openFee(f) },
            f.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', onClick: () => void toggleFee(f) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleFee(f) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void removeFee(f) },
          ]}
        />
      ),
    },
  ];

  const numberField = (key: keyof CommerceSettingsData, label: string, hint: string, opts: { min: number; max: number; step?: number; suffix?: string }) =>
    settings && (
      <label>
        <span className="field-label">{label}</span>
        <div className="admin-input-suffix">
          <input type="number" min={opts.min} max={opts.max} step={opts.step ?? 1} value={String(settings[key])} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} required />
          {opts.suffix && <span>{opts.suffix}</span>}
        </div>
        <small className="admin-field-hint">{hint}</small>
        {firstError(settingsErrors, key) && <small className="cms-field-error">{firstError(settingsErrors, key)}</small>}
      </label>
    );

  return (
    <div>
      <AdminPageHead
        title={t('Pengaturan Checkout', 'Checkout Settings')}
        desc={t('Biaya tambahan yang dibebankan ke setiap order dan aturan pembayaran/pajak saat checkout.', 'Additional fees charged on every order plus payment and tax rules at checkout.')}
      />

      <div className="admin-grid-2 admin-grid-settings">
        <AdminCard
          title={t('Biaya tambahan', 'Additional fees')}
          desc={t('Biaya aktif otomatis ditambahkan ke ringkasan checkout dan total order.', 'Active fees are added automatically to the checkout summary and order total.')}
          action={{ label: t('Tambah biaya', 'Add fee'), icon: 'plus', onClick: () => openFee(null) }}
        >
          {feesError && <p className="form-error">{feesError}</p>}
          <DataTable columns={feeColumns} rows={fees} pagination={false} empty={feesLoading ? t('Memuat biaya...', 'Loading fees...') : t('Belum ada biaya tambahan.', 'No additional fees yet.')} />
          <p className="admin-field-hint" style={{ marginTop: 12 }}>
            {t('Ongkos kirim diatur per zona wilayah di menu', 'Shipping costs are configured per region zone under')}{' '}
            <Link href="/admin/shipping" className="link">
              {t('Ongkir', 'Shipping Rates')}
            </Link>
            .
          </p>
        </AdminCard>

        <AdminCard title={t('Pengaturan checkout', 'Checkout settings')} desc={t('Berlaku untuk order baru; order yang sudah dibuat tidak berubah.', 'Applies to new orders; existing orders are not changed.')}>
          {settingsError && <p className="form-error">{settingsError}</p>}
          {settingsNotice && (
            <p className="admin-toast" role="status">
              {settingsNotice}
            </p>
          )}
          {!settings ? (
            <p className="admin-field-hint">{t('Memuat pengaturan...', 'Loading settings...')}</p>
          ) : (
            <form className="admin-form" onSubmit={(e) => void submitSettings(e)}>
              {numberField('paymentDueHours', t('Batas waktu pembayaran', 'Payment deadline'), t('Order yang belum dibayar sampai batas ini otomatis kedaluwarsa dan stoknya dikembalikan.', 'Unpaid orders expire automatically after this period and stock is released.'), { min: 1, max: 720, suffix: t('jam', 'hours') })}
              {numberField('reminderHoursBeforeDue', t('Pengingat sebelum batas bayar', 'Reminder before deadline'), t('Email pengingat dikirim sekian jam sebelum batas waktu (0 = tanpa pengingat).', 'A reminder email is sent this many hours before the deadline (0 = no reminder).'), { min: 0, max: 168, suffix: t('jam', 'hours') })}
              <label className="cms-check">
                <input type="checkbox" checked={settings.uniqueCodeEnabled === true} onChange={(e) => setSettings({ ...settings, uniqueCodeEnabled: e.target.checked })} />
                <span>
                  {t('Kode unik transfer manual', 'Unique code for manual transfer')}
                  <small className="admin-field-hint" style={{ display: 'block' }}>
                    {t('Menambahkan 1–999 rupiah ke total agar transfer mudah dicocokkan.', 'Adds Rp 1–999 to the total so transfers are easy to match.')}
                  </small>
                </span>
              </label>
              {numberField('taxRate', t('Tarif PPN', 'VAT rate'), t('Persentase pajak untuk produk kena pajak (mis. 11).', 'Tax percentage for taxable products (e.g. 11).'), { min: 0, max: 100, step: 0.01, suffix: '%' })}
              <label className="cms-check">
                <input type="checkbox" checked={settings.priceIncludesTax === true} onChange={(e) => setSettings({ ...settings, priceIncludesTax: e.target.checked })} />
                <span>
                  {t('Harga produk sudah termasuk PPN', 'Product prices include VAT')}
                  <small className="admin-field-hint" style={{ display: 'block' }}>
                    {t('Aktif: PPN ditampilkan sebagai bagian dari harga. Nonaktif: PPN ditambahkan di atas subtotal.', 'On: VAT is shown as part of the price. Off: VAT is added on top of the subtotal.')}
                  </small>
                </span>
              </label>
              {numberField('autoCompleteDays', t('Selesai otomatis setelah diterima', 'Auto-complete after delivery'), t('Order berstatus "Diterima" ditutup otomatis setelah sekian hari bila customer tidak mengonfirmasi (0 = manual).', 'Delivered orders are closed automatically after this many days if the customer does not confirm (0 = manual).'), { min: 0, max: 90, suffix: t('hari', 'days') })}
              <div className="admin-modal-actions" style={{ borderTop: 0, paddingTop: 0 }}>
                <button type="submit" className="btn btn-solid btn-sm" disabled={settingsSaving}>
                  {settingsSaving ? t('Menyimpan...', 'Saving...') : t('Simpan pengaturan', 'Save settings')}
                </button>
              </div>
            </form>
          )}
        </AdminCard>
      </div>

      {feeOpen && (
        <AdminModal title={editingFee ? t('Edit biaya', 'Edit fee') : t('Tambah biaya', 'Add fee')} onClose={() => setFeeOpen(false)} small>
          <form className="admin-form" onSubmit={(e) => void submitFee(e)}>
            {feeError && (
              <p className="admin-form-error" role="alert">
                {feeError}
              </p>
            )}
            <I18nInput label={t('Nama biaya', 'Fee name')} value={feeForm.name} onChange={(v) => setFeeForm({ ...feeForm, name: v })} required errorId={firstError(feeErrors, 'name.id', 'name')} errorEn={firstError(feeErrors, 'name.en')} />
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Jenis', 'Type')}</span>
                <select value={feeForm.type} onChange={(e) => setFeeForm({ ...feeForm, type: e.target.value as FeeType })}>
                  {(Object.keys(feeTypeLabels) as FeeType[]).map((key) => (
                    <option key={key} value={key}>
                      {feeTypeLabels[key][lang]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">{t('Nominal (Rp)', 'Amount (Rp)')} *</span>
                <input type="number" min={0} step={1} value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} required />
                {firstError(feeErrors, 'amount') && <small className="cms-field-error">{firstError(feeErrors, 'amount')}</small>}
              </label>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Urutan', 'Order')}</span>
                <input type="number" min={0} value={feeForm.sortOrder} onChange={(e) => setFeeForm({ ...feeForm, sortOrder: Number(e.target.value) || 0 })} />
              </label>
              <label className="cms-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={feeForm.isActive} onChange={(e) => setFeeForm({ ...feeForm, isActive: e.target.checked })} />
                <span>{t('Aktif', 'Active')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFeeOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={feeSaving}>
                {feeSaving ? t('Menyimpan...', 'Saving...') : editingFee ? t('Simpan perubahan', 'Save changes') : t('Tambah biaya', 'Add fee')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
