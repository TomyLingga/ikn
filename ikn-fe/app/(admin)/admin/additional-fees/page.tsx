'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import CustomerPicker from '@/components/admin/CustomerPicker';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { I18nInput, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type I18n } from '@/lib/cms';
import { audienceLabels, audienceSummary, feeTypeLabels, type Audience, type CustomerOption, type FeeRow, type FeeType } from '@/lib/admin';
import { formatIDR } from '@/lib/format';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';

interface FeeForm {
  name: I18n;
  type: FeeType;
  amount: string;
  isActive: boolean;
  sortOrder: number;
  audience: Audience;
  customers: CustomerOption[];
}

const emptyFee = (sortOrder: number): FeeForm => ({ name: emptyI18n(), type: 'other', amount: '', isActive: true, sortOrder, audience: 'all', customers: [] });

function formFromRow(row: FeeRow): FeeForm {
  return {
    name: { ...row.name },
    type: row.type,
    amount: String(row.amount),
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    audience: row.audience || 'all',
    customers: [...(row.customers || [])],
  };
}

function payload(form: FeeForm) {
  return {
    name: { id: form.name.id.trim(), en: form.name.en.trim() },
    type: form.type,
    amount: Number(form.amount) || 0,
    isActive: form.isActive,
    sortOrder: form.sortOrder,
    audience: form.audience,
    customerIds: form.audience === 'customers' ? form.customers.map((c) => c.id) : [],
  };
}

// Biaya tambahan: GET/POST /admin/fees, PUT/DELETE /admin/fees/{id}. Biaya aktif ditambahkan ke total order;
// sasaran semua customer atau customer tertentu (audience + customerIds[]).
export default function AdminAdditionalFees() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [rows, setRows] = useState<FeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [audience, setAudience] = useState<'' | Audience>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FeeRow | null>(null);
  const [form, setForm] = useState<FeeForm>(() => emptyFee(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<FeeRow[]>('/admin/fees'));
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

  function openForm(row: FeeRow | null) {
    setEditing(row);
    setForm(row ? formFromRow(row) : emptyFee(rows.length));
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (form.audience === 'customers' && form.customers.length === 0) {
      setFormError(t('Pilih minimal satu customer, atau ubah sasaran menjadi semua customer.', 'Pick at least one customer, or switch the audience to all customers.'));
      return;
    }
    setSaving(true);
    setFormError('');
    setFormErrors({});
    try {
      if (editing) {
        await api(`/admin/fees/${editing.id}`, { method: 'PUT', body: payload(form) });
      } else {
        await api('/admin/fees', { method: 'POST', body: payload(form) });
      }
      await refresh();
      setNotice(editing ? t('Biaya diperbarui.', 'Fee updated.') : t('Biaya ditambahkan.', 'Fee added.'));
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

  async function toggleActive(row: FeeRow) {
    setError('');
    try {
      await api(`/admin/fees/${row.id}`, { method: 'PUT', body: payload({ ...formFromRow(row), isActive: !row.isActive }) });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: FeeRow) {
    if (!await confirmDialog(t(`Hapus biaya "${tr(row.name, lang)}"? Order yang sudah dibuat tidak berubah.`, `Delete fee "${tr(row.name, lang)}"? Existing orders are not changed.`))) return;
    setError('');
    try {
      await api(`/admin/fees/${row.id}`, { method: 'DELETE' });
      await refresh();
      setNotice(t('Biaya dihapus.', 'Fee deleted.'));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const visible = audience ? rows.filter((row) => (row.audience || 'all') === audience) : rows;

  const columns: Column<FeeRow>[] = [
    {
      key: 'name',
      label: t('Nama biaya', 'Fee name'),
      render: (f) => (
        <span>
          <strong>{tr(f.name, lang)}</strong>
          <small className="admin-cell-sub">{feeTypeLabels[f.type]?.[lang] || f.type}</small>
        </span>
      ),
    },
    { key: 'amount', label: t('Nominal', 'Amount'), align: 'right', render: (f) => <strong>{formatIDR(f.amount)}</strong> },
    {
      key: 'audience',
      label: t('Dibebankan ke', 'Charged to'),
      render: (f) =>
        f.audience === 'customers' ? (
          <span title={f.customers.map((c) => c.company || c.name).join(', ')}>
            <StatusBadge label={t('Khusus', 'Targeted')} tone="info" small />
            <small className="admin-cell-sub">{audienceSummary(f, lang)}</small>
          </span>
        ) : (
          t('Setiap order', 'Every order')
        ),
    },
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
            { label: 'Edit', onClick: () => openForm(f) },
            f.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', onClick: () => void toggleActive(f) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleActive(f) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(f) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Biaya Tambahan', 'Additional Fees')}
        desc={t(
          'Biaya aktif otomatis ditambahkan ke ringkasan checkout dan total order, untuk semua customer atau hanya customer tertentu.',
          'Active fees are added automatically to the checkout summary and order total, for every customer or only selected ones.',
        )}
        action={{ label: t('Tambah biaya', 'Add fee'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="admin-toolbar">
        <label className="admin-filter">
          <span>{t('Sasaran', 'Audience')}</span>
          <Select value={audience} onChange={(e) => setAudience(e.target.value as '' | Audience)}>
            <option value="">{t('Semua', 'All')}</option>
            <option value="all">{audienceLabels.all[lang]}</option>
            <option value="customers">{audienceLabels.customers[lang]}</option>
          </Select>
        </label>
        <span className="admin-result-count">
          {visible.length} {t('biaya', 'fees')}
        </span>
      </div>

      <DataTable columns={columns} rows={visible} pagination={false} empty={loading ? t('Memuat biaya...', 'Loading fees...') : t('Belum ada biaya tambahan.', 'No additional fees yet.')} />

      <p className="admin-field-hint" style={{ marginTop: 12 }}>
        {t('Ongkos kirim diatur per zona wilayah di menu', 'Shipping costs are configured per region zone under')}{' '}
        <Link href="/admin/shipping" className="link">
          {t('Ongkir', 'Shipping Rates')}
        </Link>
        {t('; potongan harga lewat menu', '; discounts under')}{' '}
        <Link href="/admin/vouchers" className="link">
          Voucher
        </Link>
        .
      </p>

      {formOpen && (
        <AdminModal title={editing ? t('Edit biaya', 'Edit fee') : t('Tambah biaya', 'Add fee')} onClose={() => setFormOpen(false)}>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <I18nInput label={t('Nama biaya', 'Fee name')} value={form.name} onChange={(name) => setForm({ ...form, name })} required errorId={firstError(formErrors, 'name.id', 'name')} errorEn={firstError(formErrors, 'name.en')} />
            <div className="admin-form-row admin-form-row-3">
              <label>
                <span className="field-label">{t('Jenis', 'Type')}</span>
                <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as FeeType })}>
                  {(Object.keys(feeTypeLabels) as FeeType[]).map((key) => (
                    <option key={key} value={key}>
                      {feeTypeLabels[key][lang]}
                    </option>
                  ))}
                </Select>
              </label>
              <label>
                <span className="field-label">{t('Nominal (Rp)', 'Amount (Rp)')} *</span>
                <input type="number" min={0} step={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                {firstError(formErrors, 'amount') && <small className="cms-field-error">{firstError(formErrors, 'amount')}</small>}
              </label>
              <label>
                <span className="field-label">{t('Urutan', 'Order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
            </div>
            <div className="cms-field">
              <span className="field-label">{t('Dibebankan ke', 'Charged to')}</span>
              <div className="admin-form-row">
                {(Object.keys(audienceLabels) as Audience[]).map((key) => (
                  <label key={key} className="cms-check">
                    <input type="radio" name="fee-audience" checked={form.audience === key} onChange={() => setForm({ ...form, audience: key })} />
                    <span>{audienceLabels[key][lang]}</span>
                  </label>
                ))}
              </div>
              {form.audience === 'customers' && (
                <CustomerPicker value={form.customers} onChange={(customers) => setForm({ ...form, customers })} error={firstError(formErrors, 'customerIds', 'customerIds.0')} />
              )}
              <small className="admin-field-hint">
                {form.audience === 'customers'
                  ? t('Biaya hanya muncul di checkout dan order customer terpilih.', 'The fee only appears in the checkout and orders of the selected customers.')
                  : t('Biaya ditambahkan ke setiap order baru.', 'The fee is added to every new order.')}
              </small>
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
                {saving ? t('Menyimpan...', 'Saving...') : editing ? t('Simpan perubahan', 'Save changes') : t('Tambah biaya', 'Add fee')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
