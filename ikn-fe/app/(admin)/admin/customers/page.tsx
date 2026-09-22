'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge from '@/components/StatusBadge';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderStatus } from '@/lib/commerce';
import { api, errorMessage } from '@/lib/api';
import { formatDate, formatIDR } from '@/lib/format';
import type { Order } from '@/lib/types';

interface CustomerRow {
  id: string;
  name: string;
  pic: string;
  email: string;
  phone: string;
  company: string;
  orders: number;
  status: 'active' | 'inactive';
  joined: string;
}

interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  companyEmail: string;
  companyPhone: string;
  taxId: string;
  status: 'active' | 'inactive';
  joined: string;
  addresses: { id: string; label: string; recipient: string; phone: string; line: string; primary: boolean }[];
  orders: Order[];
}

export default function AdminCustomers() {
  const { lang } = useLang();
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      setRows(await api<CustomerRow[]>('/admin/customers'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await api<CustomerDetail>(`/admin/customers/${encodeURIComponent(id)}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function setStatus(customer: { id: string; status: 'active' | 'inactive' }, status: 'active' | 'inactive') {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/admin/customers/${encodeURIComponent(customer.id)}/status`, {
        method: 'PUT',
        body: { status },
      });
      await refresh();
      if (detail?.id === customer.id) await openDetail(customer.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<CustomerRow>[] = [
    { key: 'company', label: lang === 'en' ? 'Company' : 'Perusahaan', render: (c) => c.company || c.name },
    { key: 'pic', label: 'PIC' },
    { key: 'email', label: 'Email', render: (c) => <span className="mono">{c.email}</span> },
    { key: 'phone', label: lang === 'en' ? 'Phone' : 'Telepon', render: (c) => c.phone || '—' },
    { key: 'orders', label: lang === 'en' ? 'Orders' : 'Order', align: 'right', render: (c) => String(c.orders) },
    { key: 'joined', label: lang === 'en' ? 'Joined' : 'Bergabung', render: (c) => formatDate(c.joined) },
    {
      key: 'status',
      label: 'Status',
      render: (c) => (
        <StatusBadge
          label={
            c.status === 'active'
              ? lang === 'en' ? 'Active' : 'Aktif'
              : lang === 'en' ? 'Inactive' : 'Nonaktif'
          }
          tone={c.status === 'active' ? 'ok' : 'bad'}
          small
        />
      ),
    },
    {
      key: 'act',
      label: lang === 'en' ? 'Action' : 'Aksi',
      render: (c) => (
        <RowActions
          actions={[
            { label: lang === 'en' ? 'Detail' : 'Detail', onClick: () => void openDetail(c.id) },
            c.status === 'active'
              ? { label: lang === 'en' ? 'Deactivate' : 'Nonaktifkan', tone: 'danger', disabled: busy, onClick: () => void setStatus(c, 'inactive') }
              : { label: lang === 'en' ? 'Activate' : 'Aktifkan', tone: 'success', disabled: busy, onClick: () => void setStatus(c, 'active') },
          ]}
        />
      ),
    },
  ];

  const orderColumns: Column<Order>[] = [
    {
      key: 'number',
      label: lang === 'en' ? 'Order No.' : 'No. Order',
      render: (o) => <Link href={`/admin/orders/${o.number}`} className="mono link">{o.number}</Link>,
    },
    { key: 'date', label: lang === 'en' ? 'Date' : 'Tanggal', render: (o) => formatDate(o.date) },
    { key: 'total', label: 'Total', align: 'right', render: (o) => formatIDR(o.total) },
    {
      key: 'status',
      label: 'Status',
      render: (o) => (
        <StatusBadge
          label={orderStatus[o.status]?.[lang] || orderStatus[o.status]?.id || o.status}
          tone={orderStatus[o.status]?.tone}
          small
        />
      ),
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={lang === 'en' ? 'Customers' : 'Customer'}
        desc={lang === 'en' ? 'List of registered customers.' : 'Daftar pelanggan terdaftar.'}
      />

      {error && <p className="form-error">{error}</p>}

      <DataTable
        columns={columns}
        rows={rows}
        empty={
          loading
            ? lang === 'en' ? 'Loading customers...' : 'Memuat customer...'
            : lang === 'en' ? 'No customers yet.' : 'Belum ada customer.'
        }
      />

      {detailLoading && (
        <p className="admin-note" style={{ marginTop: 16 }}>
          {lang === 'en' ? 'Loading customer details...' : 'Memuat detail customer...'}
        </p>
      )}

      {/* Modal Detail Customer */}
      {detail && !detailLoading && (
        <div className="admin-modal-backdrop" onClick={() => setDetail(null)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <h2>{lang === 'en' ? 'Customer Detail' : 'Detail Customer'}: {detail.company || detail.name}</h2>
              <button type="button" className="admin-modal-close" onClick={() => setDetail(null)}>✕</button>
            </div>

            <div className="admin-product-detail" style={{ padding: 22 }}>
              <div className="admin-grid-2" style={{ marginBottom: 20 }}>
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: '0.95rem' }}>
                    {lang === 'en' ? 'Customer Profile' : 'Profil Customer'}
                  </h3>
                  <p className="admin-note" style={{ lineHeight: 1.8 }}>
                    {lang === 'en' ? 'PIC Name' : 'Nama PIC'}: <strong>{detail.name}</strong><br />
                    {lang === 'en' ? 'Position' : 'Jabatan'}: {detail.position || '—'}<br />
                    Email: <span className="mono">{detail.email}</span><br />
                    {lang === 'en' ? 'Phone' : 'Telepon'}: {detail.phone || '—'}<br />
                    {lang === 'en' ? 'Company' : 'Perusahaan'}: {detail.company || '—'}<br />
                    {lang === 'en' ? 'Company Email' : 'Email perusahaan'}: {detail.companyEmail || '—'}<br />
                    {lang === 'en' ? 'Company Phone' : 'Telepon perusahaan'}: {detail.companyPhone || '—'}<br />
                    {lang === 'en' ? 'Tax ID (NPWP)' : 'NPWP'}: {detail.taxId || '—'}<br />
                    {lang === 'en' ? 'Joined Date' : 'Bergabung'}: {formatDate(detail.joined)}<br />
                    Status:{' '}
                    <StatusBadge
                      label={
                        detail.status === 'active'
                          ? lang === 'en' ? 'Active' : 'Aktif'
                          : lang === 'en' ? 'Inactive' : 'Nonaktif'
                      }
                      tone={detail.status === 'active' ? 'ok' : 'bad'}
                      small
                    />
                  </p>
                </div>
                <div>
                  <h3 style={{ marginBottom: 8, fontSize: '0.95rem' }}>
                    {lang === 'en' ? 'Saved Addresses' : 'Daftar Alamat'}
                  </h3>
                  {detail.addresses.length === 0 && (
                    <p className="admin-note">
                      {lang === 'en' ? 'No saved addresses yet.' : 'Belum ada alamat tersimpan.'}
                    </p>
                  )}
                  {detail.addresses.map((address) => (
                    <p key={address.id} className="admin-note" style={{ marginBottom: 10, lineHeight: 1.7 }}>
                      <strong>{address.label}</strong>{address.primary ? (lang === 'en' ? ' · Primary' : ' · Utama') : ''}<br />
                      {address.recipient} · {address.phone}<br />
                      {address.line}
                    </p>
                  ))}
                </div>
              </div>

              <h3 style={{ margin: '18px 0 10px', fontSize: '0.95rem' }}>
                {lang === 'en' ? 'Order History' : 'Riwayat Pesanan'}
              </h3>
              <DataTable
                columns={orderColumns}
                rows={detail.orders}
                rowKey="number"
                empty={lang === 'en' ? 'No orders found.' : 'Belum ada order.'}
              />

              <div className="admin-modal-actions">
                {detail.status === 'active' ? (
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => void setStatus(detail, 'inactive')}
                  >
                    {lang === 'en' ? 'Deactivate Account' : 'Nonaktifkan Akun'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-solid btn-sm"
                    disabled={busy}
                    onClick={() => void setStatus(detail, 'active')}
                  >
                    {lang === 'en' ? 'Activate Account' : 'Aktifkan Akun'}
                  </button>
                )}
                <button type="button" className="btn btn-line btn-sm" onClick={() => setDetail(null)}>
                  {lang === 'en' ? 'Close' : 'Tutup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
