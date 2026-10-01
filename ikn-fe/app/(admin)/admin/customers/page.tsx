'use client';

import { Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import AdminTabs, { type AdminTab } from '@/components/admin/AdminTabs';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { accountStatusLabels, orderLabel, paymentLabel } from '@/lib/commerce';
import { api, apiPaged, ApiError, errorMessage } from '@/lib/api';
import { queryString, refreshAdminBadges, type AdminCustomerDetail, type AdminCustomerOrder, type AdminCustomerRow, type CountsMeta } from '@/lib/admin';
import { formatAddressLines } from '@/components/customer/CustomerAddresses';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import type { AccountStatus, IconName } from '@/lib/types';

type StatusTab = AccountStatus | ''; // '' = semua status
type Action = { status: 'active' | 'rejected' | 'inactive'; customer: AdminCustomerRow | AdminCustomerDetail } | null;

const TABS: StatusTab[] = ['pending', 'active', 'rejected', 'inactive', ''];
const DEFAULT_STATUS: StatusTab = 'pending';
const TAB_ICONS: Record<StatusTab, IconName> = { pending: 'clock', active: 'checkCircle', rejected: 'cancelCircle', inactive: 'close', '': 'users' };
const PER_PAGE = 20;

function statusBadge(status: AccountStatus, lang: 'id' | 'en') {
  const label = accountStatusLabels[status] || { id: status, en: status, tone: 'info' as const };
  return <StatusBadge label={label[lang]} tone={label.tone} small />;
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={null}>
      <AdminCustomers />
    </Suspense>
  );
}

// Customer B2B: GET /admin/customers?status&q&page, detail GET /admin/customers/{id}, PUT .../status (approve/reject/nonaktif).
function AdminCustomers() {
  const { lang } = useLang();
  const params = useSearchParams();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  // Status awal: ?status= bila valid (mis. ?status=pending dari dashboard); datang dengan ?q= saja (dari detail order)
  // → cari di semua status; selain itu pendaftaran yang menunggu persetujuan (pekerjaan admin yang paling mendesak).
  const initialStatus = params.get('status') as StatusTab | null;
  const [tab, setTab] = useState<StatusTab>(initialStatus && TABS.includes(initialStatus) ? initialStatus : params.get('q') ? '' : DEFAULT_STATUS);
  const [search, setSearch] = useState(params.get('q') || '');
  const [q, setQ] = useState(params.get('q') || '');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminCustomerRow[]>([]);
  const [meta, setMeta] = useState<CountsMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<AdminCustomerRow>(`/admin/customers${queryString({ status: tab, q, page, perPage: PER_PAGE })}`);
      setRows(result.items);
      setMeta(result.meta as CountsMeta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, q, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setError('');
    try {
      setDetail(await api<AdminCustomerDetail>(`/admin/customers/${id}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  function startAction(next: Action) {
    setReason('');
    setActionError('');
    setAction(next);
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!action || busy) return;
    if (action.status === 'rejected' && !reason.trim()) {
      setActionError(t('Alasan penolakan wajib diisi.', 'Rejection reason is required.'));
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      const updated = await api<AdminCustomerDetail>(`/admin/customers/${action.customer.id}/status`, {
        method: 'PUT',
        body: { status: action.status, reason: reason.trim() || null },
      });
      const labels: Record<string, [string, string]> = {
        active: ['Akun customer disetujui/diaktifkan; email pemberitahuan dikirim.', 'Customer account approved/activated; notification email sent.'],
        rejected: ['Pendaftaran ditolak; customer menerima email berisi alasan.', 'Registration rejected; the customer receives the reason by email.'],
        inactive: ['Akun dinonaktifkan; customer tidak dapat login/checkout.', 'Account deactivated; the customer can no longer log in or check out.'],
      };
      const [msgId, msgEn] = labels[action.status] || ['Status diperbarui.', 'Status updated.'];
      setNotice(t(msgId, msgEn));
      setAction(null);
      if (detail?.id === updated.id) setDetail(updated);
      refreshAdminBadges();
      await refresh();
    } catch (err) {
      setActionError(err instanceof ApiError && err.status === 422 ? Object.values(err.errors)[0]?.[0] || err.message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  const tabLabel = (key: StatusTab) => (key === '' ? t('Semua', 'All') : accountStatusLabels[key][lang]);
  const counts = meta.counts || {};
  const tabs: AdminTab<StatusTab>[] = TABS.map((key) => ({
    key,
    label: tabLabel(key),
    icon: TAB_ICONS[key],
    count: key === '' ? Object.values(counts).reduce((sum, n) => sum + n, 0) : counts[key] || 0,
    badge: key === 'pending',
  }));

  const rowActions = (c: AdminCustomerRow | AdminCustomerDetail) => {
    const list: Array<{ label: string; tone?: 'danger' | 'success' | 'default'; onClick: () => void; disabled?: boolean }> = [];
    if (c.status === 'pending' || c.status === 'rejected') {
      list.push({ label: t('Setujui', 'Approve'), tone: 'success', disabled: busy, onClick: () => startAction({ status: 'active', customer: c }) });
    }
    if (c.status === 'pending') {
      list.push({ label: t('Tolak', 'Reject'), tone: 'danger', disabled: busy, onClick: () => startAction({ status: 'rejected', customer: c }) });
    }
    if (c.status === 'active') {
      list.push({ label: t('Nonaktifkan', 'Deactivate'), tone: 'danger', disabled: busy, onClick: () => startAction({ status: 'inactive', customer: c }) });
    }
    if (c.status === 'inactive') {
      list.push({ label: t('Aktifkan', 'Activate'), tone: 'success', disabled: busy, onClick: () => startAction({ status: 'active', customer: c }) });
    }
    return list;
  };

  const columns: Column<AdminCustomerRow>[] = [
    {
      key: 'company',
      label: t('Perusahaan / PIC', 'Company / PIC'),
      render: (c) => (
        <span>
          <strong>{c.company || c.name}</strong>
          {c.company && <small className="admin-cell-sub">{c.name}</small>}
        </span>
      ),
    },
    {
      key: 'contact',
      label: t('Kontak', 'Contact'),
      render: (c) => (
        <span>
          <span className="mono">{c.email}</span>
          <small className="admin-cell-sub">{c.phone || '—'}</small>
        </span>
      ),
    },
    {
      key: 'joined',
      label: t('Mendaftar', 'Registered'),
      render: (c) => (
        <span>
          {formatDate(c.joinedAt, lang)}
          <small className="admin-cell-sub">{c.emailVerifiedAt ? t('email terverifikasi', 'email verified') : t('email belum diverifikasi', 'email not verified')}</small>
        </span>
      ),
    },
    { key: 'addresses', label: t('Alamat', 'Addresses'), align: 'right', render: (c) => String(c.addressesCount) },
    {
      key: 'status',
      label: 'Status',
      render: (c) => (
        <span>
          {statusBadge(c.status, lang)}
          {c.status === 'rejected' && c.rejectionReason && <small className="admin-cell-sub">{c.rejectionReason}</small>}
        </span>
      ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (c) => <RowActions actions={[{ label: 'Detail', onClick: () => void openDetail(c.id) }, ...rowActions(c)]} />,
    },
  ];

  const orderColumns: Column<AdminCustomerOrder>[] = [
    {
      key: 'number',
      label: t('No. Order', 'Order No.'),
      render: (o) => (
        <Link href={`/admin/orders/${encodeURIComponent(o.number)}`} className="mono link">
          {o.number}
        </Link>
      ),
    },
    { key: 'date', label: t('Tanggal', 'Date'), render: (o) => formatDateTime(o.date, lang) },
    { key: 'items', label: t('Item', 'Items'), align: 'right', render: (o) => String(o.itemsCount) },
    { key: 'total', label: 'Total', align: 'right', render: (o) => formatIDR(o.grandTotal) },
    { key: 'payment', label: t('Pembayaran', 'Payment'), render: (o) => <StatusBadge label={paymentLabel(o.paymentStatus)[lang]} tone={paymentLabel(o.paymentStatus).tone} small /> },
    { key: 'status', label: 'Status', render: (o) => <StatusBadge label={orderLabel(o.status)[lang]} tone={orderLabel(o.status).tone} small /> },
  ];

  const actionTitle = (a: NonNullable<Action>) =>
    a.status === 'active'
      ? a.customer.status === 'inactive'
        ? t('Aktifkan kembali akun', 'Reactivate account')
        : t('Setujui pendaftaran', 'Approve registration')
      : a.status === 'rejected'
        ? t('Tolak pendaftaran', 'Reject registration')
        : t('Nonaktifkan akun', 'Deactivate account');

  return (
    <div>
      <AdminPageHead
        title={t('Customer', 'Customers')}
        desc={t('Persetujuan pendaftaran B2B dan status akun customer.', 'B2B registration approval and customer account status.')}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <AdminTabs
        tabs={tabs}
        value={tab}
        label={t('Status customer', 'Customer status')}
        onChange={(key) => {
          setTab(key);
          setPage(1);
        }}
      />

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <label className="admin-search">
          <span className="sr-only">{t('Cari customer', 'Search customers')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari nama, email, perusahaan, telepon', 'Search name, email, company, phone')} />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Cari', 'Search')}
        </button>
        <span className="admin-result-count">
          {meta.total} {t('customer', 'customers')}
        </span>
      </form>

      <DataTable columns={columns} rows={rows} pagination={false} empty={loading ? t('Memuat customer...', 'Loading customers...') : t('Tidak ada customer pada filter ini.', 'No customers match this filter.')} />
      <Pager meta={meta} onPage={setPage} disabled={loading} />

      {detailLoading && <p className="admin-field-hint" style={{ marginTop: 12 }}>{t('Memuat detail customer...', 'Loading customer details...')}</p>}

      {detail && !detailLoading && (
        <AdminModal title={`${t('Detail customer', 'Customer details')}: ${detail.company || detail.name}`} onClose={() => setDetail(null)} width={920}>
          <div className="admin-modal-body">
            <div className="admin-grid-2">
              <div>
                <h3 className="admin-subtitle">{t('Profil perusahaan', 'Company profile')}</h3>
                <dl className="admin-kv">
                  <div>
                    <dt>{t('Perusahaan', 'Company')}</dt>
                    <dd>{detail.company || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('Nama PIC', 'PIC name')}</dt>
                    <dd>
                      {detail.name}
                      {detail.position ? ` · ${detail.position}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd className="mono">{detail.email}</dd>
                  </div>
                  <div>
                    <dt>{t('Telepon', 'Phone')}</dt>
                    <dd>{detail.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('Email perusahaan', 'Company email')}</dt>
                    <dd>{detail.companyEmail || '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('Telepon perusahaan', 'Company phone')}</dt>
                    <dd>{detail.companyPhone || '—'}</dd>
                  </div>
                  <div>
                    <dt>NPWP</dt>
                    <dd className="mono">{detail.taxId || '—'}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {statusBadge(detail.status, lang)}
                      {detail.rejectionReason && (
                        <>
                          <br />
                          <small>{detail.rejectionReason}</small>
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Riwayat akun', 'Account timeline')}</dt>
                    <dd>
                      {t('Mendaftar', 'Registered')} {formatDateTime(detail.joinedAt, lang)}
                      <br />
                      {t('Verifikasi email', 'Email verified')} {formatDateTime(detail.emailVerifiedAt, lang)}
                      <br />
                      {t('Disetujui', 'Approved')} {formatDateTime(detail.approvedAt, lang)}
                      {detail.approvedBy ? ` (${detail.approvedBy.name})` : ''}
                      <br />
                      {t('Login terakhir', 'Last login')} {formatDateTime(detail.lastLoginAt, lang)}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="admin-subtitle">
                  {t('Alamat pengiriman', 'Shipping addresses')} ({detail.addressesCount})
                </h3>
                {detail.addresses.length === 0 && <p className="admin-field-hint">{t('Belum ada alamat tersimpan.', 'No saved addresses yet.')}</p>}
                {detail.addresses.map((address) => (
                  <p key={address.id} className="admin-address">
                    <strong>
                      {address.label}
                      {address.isDefault ? ` · ${t('Utama', 'Default')}` : ''}
                    </strong>
                    <br />
                    {address.recipientName} · {address.phone}
                    <br />
                    {formatAddressLines(address).join(', ')}
                  </p>
                ))}
              </div>
            </div>

            <h3 className="admin-subtitle" style={{ marginTop: 18 }}>
              {t('Riwayat order', 'Order history')} ({detail.ordersCount})
            </h3>
            <DataTable columns={orderColumns} rows={detail.orders} rowKey="number" pagination={false} empty={t('Belum ada order.', 'No orders yet.')} />
            {detail.ordersCount > detail.orders.length && (
              <p className="admin-field-hint" style={{ marginTop: 8 }}>
                {t('Menampilkan 10 order terbaru.', 'Showing the 10 most recent orders.')}{' '}
                <Link href={`/admin/orders?q=${encodeURIComponent(detail.email)}`} className="link">
                  {t('Lihat semua di daftar order', 'See all in the order list')}
                </Link>
              </p>
            )}

            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setDetail(null)}>
                {t('Tutup', 'Close')}
              </button>
              {rowActions(detail).map((a) => (
                <button key={a.label} type="button" className={`btn btn-sm ${a.tone === 'danger' ? 'btn-danger' : 'btn-solid'}`} disabled={a.disabled} onClick={a.onClick}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </AdminModal>
      )}

      {action && (
        <AdminModal title={actionTitle(action)} onClose={() => setAction(null)} small>
          <form className="admin-form" onSubmit={(e) => void submitAction(e)}>
            <p className="admin-field-hint">
              <strong>{action.customer.company || action.customer.name}</strong> · <span className="mono">{action.customer.email}</span>
            </p>
            <p className="admin-field-hint">
              {action.status === 'active' &&
                (action.customer.status === 'inactive'
                  ? t('Customer dapat login dan berbelanja kembali. Tidak ada email yang dikirim.', 'The customer can log in and order again. No email is sent.')
                  : t('Customer menerima email persetujuan dan dapat mulai memesan.', 'The customer receives an approval email and can start ordering.'))}
              {action.status === 'rejected' && t('Customer menerima email penolakan berisi alasan di bawah. Akun bisa disetujui belakangan.', 'The customer receives a rejection email with the reason below. The account can still be approved later.')}
              {action.status === 'inactive' && t('Customer tidak dapat login maupun checkout sampai diaktifkan kembali. Order yang sudah ada tidak berubah.', 'The customer cannot log in or check out until reactivated. Existing orders are unaffected.')}
            </p>
            {action.status === 'rejected' ? (
              <label>
                <span className="field-label">{t('Alasan penolakan', 'Rejection reason')} *</span>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
              </label>
            ) : (
              <label>
                <span className="field-label">{t('Catatan (opsional)', 'Note (optional)')}</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            )}
            {actionError && (
              <p className="admin-form-error" role="alert">
                {actionError}
              </p>
            )}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setAction(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className={`btn btn-sm ${action.status === 'active' ? 'btn-solid' : 'btn-danger'}`} disabled={busy}>
                {busy ? t('Memproses...', 'Processing...') : actionTitle(action)}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
