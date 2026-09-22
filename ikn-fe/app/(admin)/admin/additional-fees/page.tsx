'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, AdminCard, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { api, errorMessage } from '@/lib/api';
import { formatIDR } from '@/lib/format';

type FeeKind = 'shipping' | 'admin' | 'other';
type TabKey = 'due_time' | 'fees' | 'shipping';

interface FeeRow {
  id: string;
  label: string;
  type: FeeKind;
  amount: number;
  active: boolean;
}

interface ShippingMethodRow {
  id: string;
  label: string;
  amount: number;
  active: boolean;
}

const typeLabels: Record<FeeKind, string> = { shipping: 'Ongkir', admin: 'Administrasi', other: 'Lainnya' };

export default function AdminAdditionalFees() {
  const [activeTab, setActiveTab] = useState<TabKey>('due_time');
  const [fees, setFees] = useState<FeeRow[]>([]);
  const [methods, setMethods] = useState<ShippingMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Form biaya tambahan.
  const [feeFormOpen, setFeeFormOpen] = useState(false);
  const [feeEditingId, setFeeEditingId] = useState<string | null>(null);
  const [feeForm, setFeeForm] = useState({ label: '', type: 'admin' as FeeKind, amount: '0' });
  const [feeError, setFeeError] = useState('');
  const [feeSaving, setFeeSaving] = useState(false);

  // Form metode pengiriman.
  const [shipFormOpen, setShipFormOpen] = useState(false);
  const [shipEditingId, setShipEditingId] = useState<string | null>(null);
  const [shipForm, setShipForm] = useState({ label: '', amount: '0' });
  const [shipError, setShipError] = useState('');
  const [shipSaving, setShipSaving] = useState(false);

  // Pengaturan batas waktu bayar.
  const [dueHours, setDueHours] = useState('');
  const [dueSaving, setDueSaving] = useState(false);
  const [dueNotice, setDueNotice] = useState('');
  const [dueError, setDueError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [feeRows, shipRows, settings] = await Promise.all([
        api<FeeRow[]>('/admin/fees'),
        api<ShippingMethodRow[]>('/admin/shipping-methods'),
        api<{ paymentDueHours: number }>('/admin/settings'),
      ]);
      setFees(feeRows);
      setMethods(shipRows);
      setDueHours(String(settings.paymentDueHours));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---------- Biaya tambahan ----------

  function openFeeAdd() {
    setFeeEditingId(null);
    setFeeForm({ label: '', type: 'admin', amount: '0' });
    setFeeError('');
    setFeeFormOpen(true);
  }

  function openFeeEdit(row: FeeRow) {
    setFeeEditingId(row.id);
    setFeeForm({ label: row.label, type: row.type, amount: String(row.amount) });
    setFeeError('');
    setFeeFormOpen(true);
  }

  function closeFeeForm() {
    setFeeFormOpen(false);
    setFeeEditingId(null);
    setFeeForm({ label: '', type: 'admin', amount: '0' });
    setFeeError('');
  }

  async function submitFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (feeSaving) return;
    setFeeSaving(true);
    setFeeError('');
    const editing = fees.find((row) => row.id === feeEditingId);
    const body = {
      label: feeForm.label.trim(),
      type: feeForm.type,
      amount: Math.max(0, Number(feeForm.amount) || 0),
      active: editing ? editing.active : true,
    };
    try {
      if (feeEditingId) {
        await api(`/admin/fees/${encodeURIComponent(feeEditingId)}`, { method: 'PUT', body });
      } else {
        await api('/admin/fees', { method: 'POST', body });
      }
      await refresh();
      closeFeeForm();
    } catch (err) {
      setFeeError(errorMessage(err));
    } finally {
      setFeeSaving(false);
    }
  }

  async function toggleFee(row: FeeRow) {
    setError('');
    try {
      await api(`/admin/fees/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        body: { label: row.label, type: row.type, amount: row.amount, active: !row.active },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeFee(row: FeeRow) {
    if (!window.confirm(`Hapus biaya "${row.label}"?`)) return;
    setError('');
    try {
      await api(`/admin/fees/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // ---------- Metode pengiriman ----------

  function openShipAdd() {
    setShipEditingId(null);
    setShipForm({ label: '', amount: '0' });
    setShipError('');
    setShipFormOpen(true);
  }

  function openShipEdit(row: ShippingMethodRow) {
    setShipEditingId(row.id);
    setShipForm({ label: row.label, amount: String(row.amount) });
    setShipError('');
    setShipFormOpen(true);
  }

  function closeShipForm() {
    setShipFormOpen(false);
    setShipEditingId(null);
    setShipForm({ label: '', amount: '0' });
    setShipError('');
  }

  async function submitShip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (shipSaving) return;
    setShipSaving(true);
    setShipError('');
    const editing = methods.find((row) => row.id === shipEditingId);
    const body = {
      label: shipForm.label.trim(),
      amount: Math.max(0, Number(shipForm.amount) || 0),
      active: editing ? editing.active : true,
    };
    try {
      if (shipEditingId) {
        await api(`/admin/shipping-methods/${encodeURIComponent(shipEditingId)}`, { method: 'PUT', body });
      } else {
        await api('/admin/shipping-methods', { method: 'POST', body });
      }
      await refresh();
      closeShipForm();
    } catch (err) {
      setShipError(errorMessage(err));
    } finally {
      setShipSaving(false);
    }
  }

  async function toggleShip(row: ShippingMethodRow) {
    setError('');
    try {
      await api(`/admin/shipping-methods/${encodeURIComponent(row.id)}`, {
        method: 'PUT',
        body: { label: row.label, amount: row.amount, active: !row.active },
      });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function removeShip(row: ShippingMethodRow) {
    if (!window.confirm(`Hapus metode pengiriman "${row.label}"?`)) return;
    setError('');
    try {
      await api(`/admin/shipping-methods/${encodeURIComponent(row.id)}`, { method: 'DELETE' });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // ---------- Batas waktu bayar ----------

  async function saveDueHours(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dueSaving) return;
    const hours = Number(dueHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setDueError('Batas waktu (jam) harus lebih dari 0.');
      return;
    }
    setDueSaving(true);
    setDueError('');
    setDueNotice('');
    try {
      await api('/admin/settings', { method: 'PUT', body: { paymentDueHours: hours } });
      setDueNotice('Batas waktu pembayaran tersimpan.');
    } catch (err) {
      setDueError(errorMessage(err));
    } finally {
      setDueSaving(false);
    }
  }

  const feeColumns: Column<FeeRow>[] = [
    { key: 'label', label: 'Nama biaya' },
    { key: 'type', label: 'Jenis', render: (f) => typeLabels[f.type] || f.type },
    { key: 'amount', label: 'Nominal', align: 'right', render: (f) => formatIDR(f.amount) },
    {
      key: 'active',
      label: 'Status',
      render: (f) => <StatusBadge label={f.active ? 'Aktif' : 'Nonaktif'} tone={f.active ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (f) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openFeeEdit(f) },
            f.active
              ? { label: 'Nonaktifkan', tone: 'danger', onClick: () => void toggleFee(f) }
              : { label: 'Aktifkan', tone: 'success', onClick: () => void toggleFee(f) },
            { label: 'Hapus', tone: 'danger', onClick: () => void removeFee(f) },
          ]}
        />
      ),
    },
  ];

  const shipColumns: Column<ShippingMethodRow>[] = [
    { key: 'label', label: 'Metode pengiriman' },
    { key: 'amount', label: 'Nominal', align: 'right', render: (m) => formatIDR(m.amount) },
    {
      key: 'active',
      label: 'Status',
      render: (m) => <StatusBadge label={m.active ? 'Aktif' : 'Nonaktif'} tone={m.active ? 'ok' : 'bad'} small />,
    },
    {
      key: 'act',
      label: 'Aksi',
      render: (m) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openShipEdit(m) },
            m.active
              ? { label: 'Nonaktifkan', tone: 'danger', onClick: () => void toggleShip(m) }
              : { label: 'Aktifkan', tone: 'success', onClick: () => void toggleShip(m) },
            { label: 'Hapus', tone: 'danger', onClick: () => void removeShip(m) },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title="Pengaturan Checkout"
        desc="Kelola batas waktu pembayaran, biaya tambahan, dan metode pengiriman checkout."
      />

      {/* Tabs Header */}
      <div className="admin-tabs">
        <button
          type="button"
          className={`admin-tab ${activeTab === 'due_time' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('due_time')}
        >
          Batas Waktu Bayar
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'fees' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('fees')}
        >
          Biaya Tambahan ({fees.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${activeTab === 'shipping' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('shipping')}
        >
          Metode Pengiriman ({methods.length})
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="admin-note">Memuat data...</p>}

      {/* Tab 1: Batas Waktu Bayar */}
      {activeTab === 'due_time' && (
        <div style={{ marginBottom: 22 }}>
          <AdminCard title="Pengaturan Jam Kedaluwarsa Pembayaran">
            <form className="admin-form" onSubmit={(event) => void saveDueHours(event)}>
              {dueError && <p className="form-error" role="alert">{dueError}</p>}
              {dueNotice && <p className="admin-note" role="status">{dueNotice}</p>}
              <p className="admin-desc" style={{ marginBottom: 16 }}>
                Pesanan yang belum dibayar atau konfirmasi transfernya ditolak akan otomatis dibatalkan (kedaluwarsa) setelah durasi jam yang ditentukan di bawah ini.
              </p>
              <div style={{ display: 'flex', gap: 14, flexDirection: 'column', maxWidth: 640 }}>
                <label style={{ width: '100%', marginBottom: 0 }}>
                  <span className="field-label" style={{ fontSize: '0.9rem', marginBottom: 8 }}>Order kedaluwarsa setelah (jam)</span>
                  <input
                    type="number"
                    min={1}
                    value={dueHours}
                    onChange={(event) => setDueHours(event.target.value)}
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem' }}
                    required
                  />
                </label>
                <div>
                  <button type="submit" className="btn btn-solid" disabled={dueSaving}>
                    {dueSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                  </button>
                </div>
              </div>
            </form>
          </AdminCard>
        </div>
      )}

      {/* Tab 2: Biaya Tambahan */}
      {activeTab === 'fees' && (
        <div>
          <div className="admin-head" style={{ marginBottom: 18 }}>
            <div>
              <h2 className="admin-title" style={{ fontSize: '1.2rem' }}>Daftar Biaya Tambahan</h2>
              <p className="admin-desc">Biaya administrasi atau biaya layanan yang diterapkan pada checkout.</p>
            </div>
            <button type="button" className="btn btn-solid btn-sm" onClick={openFeeAdd}>Tambah Biaya</button>
          </div>
          <DataTable columns={feeColumns} rows={fees} empty={loading ? 'Memuat biaya...' : 'Belum ada biaya.'} />
        </div>
      )}

      {/* Tab 3: Metode Pengiriman */}
      {activeTab === 'shipping' && (
        <div>
          <div className="admin-head" style={{ marginBottom: 18 }}>
            <div>
              <h2 className="admin-title" style={{ fontSize: '1.2rem' }}>Daftar Metode Pengiriman</h2>
              <p className="admin-desc">Pilihan kurir dan opsi pengiriman yang tampil saat pelanggan checkout.</p>
            </div>
            <button type="button" className="btn btn-solid btn-sm" onClick={openShipAdd}>Tambah Metode</button>
          </div>
          <DataTable columns={shipColumns} rows={methods} empty={loading ? 'Memuat metode...' : 'Belum ada metode pengiriman.'} />
        </div>
      )}

      {/* Modal: Biaya Tambahan */}
      {feeFormOpen && (
        <div className="admin-modal-backdrop" onClick={closeFeeForm}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{feeEditingId ? 'Edit biaya' : 'Tambah biaya'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeFeeForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submitFee(event)}>
              {feeError && <p className="form-error" role="alert">{feeError}</p>}
              <label>
                <span className="field-label">Nama biaya</span>
                <input value={feeForm.label} onChange={(e) => setFeeForm({ ...feeForm, label: e.target.value })} required />
              </label>
              <label>
                <span className="field-label">Jenis</span>
                <select value={feeForm.type} onChange={(e) => setFeeForm({ ...feeForm, type: e.target.value as FeeKind })}>
                  <option value="admin">Administrasi</option>
                  <option value="shipping">Ongkir</option>
                  <option value="other">Lainnya</option>
                </select>
              </label>
              <label>
                <span className="field-label">Nominal (IDR)</span>
                <input type="number" min={0} value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} required />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeFeeForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={feeSaving}>
                  {feeSaving ? 'Menyimpan...' : feeEditingId ? 'Simpan perubahan' : 'Tambah biaya'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Metode Pengiriman */}
      {shipFormOpen && (
        <div className="admin-modal-backdrop" onClick={closeShipForm}>
          <div className="admin-modal admin-modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{shipEditingId ? 'Edit metode pengiriman' : 'Tambah metode pengiriman'}</h2>
              <button type="button" className="admin-modal-close" onClick={closeShipForm}>✕</button>
            </div>
            <form className="admin-form" onSubmit={(event) => void submitShip(event)}>
              {shipError && <p className="form-error" role="alert">{shipError}</p>}
              <label>
                <span className="field-label">Nama metode</span>
                <input value={shipForm.label} onChange={(e) => setShipForm({ ...shipForm, label: e.target.value })} required />
              </label>
              <label>
                <span className="field-label">Nominal (IDR)</span>
                <input type="number" min={0} value={shipForm.amount} onChange={(e) => setShipForm({ ...shipForm, amount: e.target.value })} required />
              </label>
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={closeShipForm}>Batal</button>
                <button type="submit" className="btn btn-solid btn-sm" disabled={shipSaving}>
                  {shipSaving ? 'Menyimpan...' : shipEditingId ? 'Simpan perubahan' : 'Tambah metode'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
