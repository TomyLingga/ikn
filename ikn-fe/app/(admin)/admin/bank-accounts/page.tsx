'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';

interface BankAccountRow {
  id: string;
  bank: string;
  number: string;
  holder: string;
  active: boolean;
}

interface BankForm {
  bank: string;
  number: string;
  holder: string;
}

const emptyForm: BankForm = { bank: '', number: '', holder: '' };

export default function AdminBankAccounts() {
  const [rows, setRows] = useState<BankAccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BankForm>(emptyForm);
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

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(row: BankAccountRow) {
    setEditingId(row.id);
    setForm({ bank: row.bank, number: row.number, holder: row.holder });
    setFormError('');
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError('');
    const editing = rows.find((row) => row.id === editingId);
    const body = {
      bank: form.bank.trim(),
      number: form.number.trim(),
      holder: form.holder.trim(),
      active: editing ? editing.active : true,
    };
    try {
      if (editingId) {
        await api(`/admin/bank-accounts/${encodeURIComponent(editingId)}`, { method: 'PUT', body });
      } else {
        await api('/admin/bank-accounts', { method: 'POST', body });
      }
      await refresh();
      closeForm();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: BankAccountRow) {
    setError('');
    try {
      await api(`/admin/bank-accounts/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        body: { bank: row.bank, number: row.number, holder: row.holder, active: !row.active },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function remove(row: BankAccountRow) {
    if (!window.confirm(`Hapus rekening ${row.bank} ${row.number}?`)) return;
    setError('');
    try {
      await api(`/admin/bank-accounts/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const columns: Column<BankAccountRow>[] = [
    { key: 'bank', label: 'Bank' },
    { key: 'number', label: 'Nomor rekening', render: (b) => <span className="mono">{b.number}</span> },
    { key: 'holder', label: 'Atas nama' },
    {
      key: 'active',
      label: 'Status',
      render: (b) => <StatusBadge label={b.active ? 'Aktif' : 'Nonaktif'} tone={b.active ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (b) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(b) },
            b.active
              ? { label: 'Nonaktifkan', tone: 'danger', onClick: () => void toggleActive(b) }
              : { label: 'Aktifkan', tone: 'success', onClick: () => void toggleActive(b) },
            { label: 'Hapus', tone: 'danger', onClick: () => void remove(b) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Akun Bank"
        desc="Rekening tujuan transfer yang ditampilkan saat checkout."
        action={{ label: 'Tambah rekening', icon: 'plus', onClick: openAdd }}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        empty={loading ? 'Memuat rekening...' : 'Belum ada rekening.'}
      />

      {formOpen && (
        <div className="admin-modal-backdrop" onClick={closeForm}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{editingId ? 'Edit rekening' : 'Tambah rekening'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submit(event)}>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <label>
                <span className="field-label">Bank</span>
                <input value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} placeholder="Bank Mandiri" required />
              </label>
              <label>
                <span className="field-label">Nomor rekening</span>
                <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required />
              </label>
              <label>
                <span className="field-label">Atas nama</span>
                <input value={form.holder} onChange={(e) => setForm({ ...form, holder: e.target.value })} required />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
                  {saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah rekening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
