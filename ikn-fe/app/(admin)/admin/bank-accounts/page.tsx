'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { BankAccountRow } from '@/lib/admin';
import { confirmDialog } from '@/components/ConfirmDialog';

interface BankForm {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive: boolean;
  sortOrder: number;
}

const emptyForm = (sortOrder: number): BankForm => ({ bankName: '', accountNumber: '', accountHolder: 'PT Industri Karet Nusantara', isActive: true, sortOrder });

function formFromRow(row: BankAccountRow): BankForm {
  return { bankName: row.bankName, accountNumber: row.accountNumber, accountHolder: row.accountHolder, isActive: row.isActive, sortOrder: row.sortOrder };
}

// Rekening tujuan transfer manual: GET/POST /admin/bank-accounts, PUT/DELETE /admin/bank-accounts/{id}.
export default function AdminBankAccounts() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [rows, setRows] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccountRow | null>(null);
  const [form, setForm] = useState<BankForm>(() => emptyForm(0));
  const [formErrors, setFormErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<BankAccountRow[]>('/admin/bank-accounts'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openForm(row: BankAccountRow | null) {
    setEditing(row);
    setForm(row ? formFromRow(row) : emptyForm(rows.length));
    setFormErrors({});
    setFormError('');
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    setFormErrors({});
    const body = { ...form, bankName: form.bankName.trim(), accountNumber: form.accountNumber.trim(), accountHolder: form.accountHolder.trim() };
    try {
      if (editing) {
        await api(`/admin/bank-accounts/${editing.id}`, { method: 'PUT', body });
      } else {
        await api('/admin/bank-accounts', { method: 'POST', body });
      }
      await refresh();
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

  async function toggleActive(row: BankAccountRow) {
    setError('');
    try {
      await api(`/admin/bank-accounts/${row.id}`, { method: 'PUT', body: { ...formFromRow(row), isActive: !row.isActive } });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: BankAccountRow) {
    if (!await confirmDialog(t(`Hapus rekening ${row.bankName} ${row.accountNumber}?`, `Delete account ${row.bankName} ${row.accountNumber}?`))) return;
    setError('');
    try {
      await api(`/admin/bank-accounts/${row.id}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<BankAccountRow>[] = [
    { key: 'bankName', label: 'Bank' },
    { key: 'accountNumber', label: t('Nomor rekening', 'Account number'), render: (b) => <span className="mono">{b.accountNumber}</span> },
    { key: 'accountHolder', label: t('Atas nama', 'Account holder') },
    { key: 'sortOrder', label: t('Urutan', 'Order'), align: 'right', render: (b) => String(b.sortOrder) },
    {
      key: 'isActive',
      label: 'Status',
      render: (b) => <StatusBadge label={b.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')} tone={b.isActive ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (b) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openForm(b) },
            b.isActive
              ? { label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', onClick: () => void toggleActive(b) }
              : { label: t('Aktifkan', 'Activate'), tone: 'success', onClick: () => void toggleActive(b) },
            { label: t('Hapus', 'Delete'), tone: 'danger', onClick: () => void remove(b) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Rekening Bank', 'Bank Accounts')}
        desc={t('Rekening tujuan yang ditampilkan ke customer saat memilih transfer bank manual.', 'Destination accounts shown to customers who choose manual bank transfer.')}
        action={{ label: t('Tambah rekening', 'Add account'), icon: 'plus', onClick: () => openForm(null) }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable columns={columns} rows={rows} empty={loading ? t('Memuat rekening...', 'Loading accounts...') : t('Belum ada rekening.', 'No bank accounts yet.')} />

      {formOpen && (
        <AdminModal title={editing ? t('Edit rekening', 'Edit account') : t('Tambah rekening', 'Add account')} onClose={() => setFormOpen(false)} small>
          <form className="admin-form" onSubmit={(e) => void submit(e)}>
            {formError && (
              <p className="admin-form-error" role="alert">
                {formError}
              </p>
            )}
            <label>
              <span className="field-label">{t('Nama bank', 'Bank name')} *</span>
              <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Bank BCA" required />
              {firstError(formErrors, 'bankName') && <small className="cms-field-error">{firstError(formErrors, 'bankName')}</small>}
            </label>
            <label>
              <span className="field-label">{t('Nomor rekening', 'Account number')} *</span>
              <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} inputMode="numeric" required />
              {firstError(formErrors, 'accountNumber') && <small className="cms-field-error">{firstError(formErrors, 'accountNumber')}</small>}
            </label>
            <label>
              <span className="field-label">{t('Atas nama', 'Account holder')} *</span>
              <input value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} required />
              {firstError(formErrors, 'accountHolder') && <small className="cms-field-error">{firstError(formErrors, 'accountHolder')}</small>}
            </label>
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Urutan tampil', 'Display order')}</span>
                <input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })} />
              </label>
              <label className="cms-check" style={{ alignSelf: 'end' }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                <span>{t('Aktif (ditawarkan ke customer)', 'Active (offered to customers)')}</span>
              </label>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setFormOpen(false)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                {saving ? t('Menyimpan...', 'Saving...') : editing ? t('Simpan perubahan', 'Save changes') : t('Tambah rekening', 'Add account')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
