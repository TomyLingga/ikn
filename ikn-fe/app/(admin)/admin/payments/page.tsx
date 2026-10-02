'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import AdminTabs, { type AdminTab, type AdminTabGroup } from '@/components/admin/AdminTabs';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { paymentLabel, paymentStatus } from '@/lib/commerce';
import { api, apiPaged, ApiError, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { defaultDateRange, paymentMethodSummary, queryString, refreshAdminBadges, type AdminPayment, type CountsMeta, type PaymentMethodRow } from '@/lib/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import type { IconName, PaymentStatusKey } from '@/lib/types';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';
import { FileLink } from '@/components/FileViewer';

type StatusFilter = PaymentStatusKey | 'all';

// Antrean (tanpa filter tanggal) vs riwayat (rentang tanggal bawaan awal bulan s.d. hari ini).
const QUEUE_STATUSES: StatusFilter[] = ['awaiting_verification', 'pending', 'paid'];
const HISTORY_STATUSES: StatusFilter[] = ['all', 'rejected', 'expired', 'failed', 'cancelled'];
// Tab bawaan: antrean verifikasi (lencana merah). Rentang tanggal bawaan awal bulan s.d. hari ini di semua tab.
const DEFAULT_STATUS: StatusFilter = 'awaiting_verification';
const TAB_ICONS: Record<StatusFilter, IconName> = {
  all: 'wallet',
  awaiting_verification: 'paymentCheck',
  pending: 'clock',
  paid: 'checkCircle',
  rejected: 'cancelCircle',
  expired: 'close',
  failed: 'close',
  cancelled: 'cancelCircle',
};
const PER_PAGE = 20;

function actionErrorText(err: unknown): string {
  if (err instanceof ApiError && err.code === 'INVALID_TRANSITION' && err.meta) {
    return `${err.message} (${String(err.meta.from ?? '?')} → ${String(err.meta.to ?? '?')})`;
  }
  return errorMessage(err);
}

// Verifikasi pembayaran: GET /admin/payments?status&q&method&from&to (per percobaan bayar), detail + accept/reject by id.
export default function AdminPayments() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [status, setStatus] = useState<StatusFilter>(DEFAULT_STATUS);
  const dated = HISTORY_STATUSES.includes(status);
  const [range, setRange] = useState(() => defaultDateRange());
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [method, setMethod] = useState('');
  const [methods, setMethods] = useState<PaymentMethodRow[]>([]);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AdminPayment[]>([]);
  const [meta, setMeta] = useState<CountsMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [detail, setDetail] = useState<AdminPayment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<AdminPayment>(
        `/admin/payments${queryString({ status, q, method, from: dated ? range.from : '', to: dated ? range.to : '', page, perPage: PER_PAGE })}`,
      );
      setRows(result.items);
      setMeta(result.meta as CountsMeta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, q, method, dated, range.from, range.to, page]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Daftar metode untuk filter; admin tanpa modul payment_methods cukup memakai kode dari baris yang tampil.
  useEffect(() => {
    api<PaymentMethodRow[]>('/admin/payment-methods')
      .then(setMethods)
      .catch(() => setMethods([]));
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    setActionError('');
    setRejecting(false);
    setReason('');
    try {
      setDetail(await api<AdminPayment>(`/admin/payments/${id}`));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  async function accept(payment: AdminPayment) {
    if (busy) return;
    if (!await confirmDialog(t(`Terima pembayaran ${payment.order?.number ?? `#${payment.id}`} sebesar ${formatIDR(payment.amount)}?`, `Accept payment ${payment.order?.number ?? `#${payment.id}`} of ${formatIDR(payment.amount)}?`))) return;
    setBusy(true);
    setActionError('');
    try {
      await api(`/admin/payments/${payment.id}/accept`, { method: 'POST', body: {} });
      setNotice(t(`Pembayaran ${payment.order?.number ?? ''} diterima; order berstatus dibayar.`, `Payment ${payment.order?.number ?? ''} accepted; order is now paid.`));
      setDetail(null);
      refreshAdminBadges();
      await refresh();
    } catch (err) {
      const text = actionErrorText(err);
      if (detail) setActionError(text);
      else setError(text);
    } finally {
      setBusy(false);
    }
  }

  function startReject(payment: AdminPayment) {
    if (detail?.id !== payment.id) {
      setDetail(payment);
    }
    setRejecting(true);
    setReason('');
    setActionError('');
  }

  async function submitReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || busy) return;
    if (!reason.trim()) {
      setActionError(t('Alasan penolakan wajib diisi.', 'Rejection reason is required.'));
      return;
    }
    setBusy(true);
    setActionError('');
    try {
      await api(`/admin/payments/${detail.id}/reject`, { method: 'POST', body: { reason: reason.trim() } });
      setNotice(t('Bukti pembayaran ditolak; customer dapat mengunggah ulang.', 'Payment proof rejected; the customer can upload again.'));
      setDetail(null);
      refreshAdminBadges();
      await refresh();
    } catch (err) {
      setActionError(actionErrorText(err));
    } finally {
      setBusy(false);
    }
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  function resetFilters() {
    setStatus(DEFAULT_STATUS);
    setRange(defaultDateRange());
    setMethod('');
    setSearch('');
    setQ('');
    setPage(1);
  }

  const statusLabel = (key: StatusFilter) => (key === 'all' ? t('Semua', 'All') : paymentStatus[key][lang]);
  const defaults = defaultDateRange();
  const filtersChanged = status !== DEFAULT_STATUS || !!q || !!method || (dated && (range.from !== defaults.from || range.to !== defaults.to));
  const counts = meta.counts || {};
  const allCount = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const tabFor = (key: StatusFilter): AdminTab<StatusFilter> => ({
    key,
    label: statusLabel(key),
    icon: TAB_ICONS[key],
    count: key === 'all' ? allCount : counts[key] || 0,
    badge: key === 'awaiting_verification',
  });
  const groups: AdminTabGroup<StatusFilter>[] = [
    { key: 'queue', label: t('Perlu diproses', 'In progress'), note: t('semua tanggal', 'all dates'), tabs: QUEUE_STATUSES.map(tabFor) },
    { key: 'history', label: t('Riwayat', 'History'), note: t('filter tanggal', 'date filter'), tabs: HISTORY_STATUSES.map(tabFor) },
  ];
  const tabTotal = status === 'all' ? allCount : counts[status] || 0;
  const outsideRange = dated && !q && !method && (range.from || range.to) ? Math.max(0, tabTotal - meta.total) : 0;

  const columns: Column<AdminPayment>[] = [
    {
      key: 'number',
      label: t('No / Invoice', 'No / Invoice'),
      render: (p) => (
        <span>
          {p.order ? (
            <Link href={`/admin/orders/${encodeURIComponent(p.order.number)}`} className="mono link">
              {p.order.number}
            </Link>
          ) : (
            <span className="mono">#{p.id}</span>
          )}
          {p.order?.invoiceNumber && <small className="admin-cell-sub mono">{p.order.invoiceNumber}</small>}
        </span>
      ),
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (p) => (
        <span>
          {p.order?.customer.name || '—'}
          {p.order?.customer.company && p.order.customer.company !== p.order.customer.name && (
            <small className="admin-cell-sub">{p.order.customer.company}</small>
          )}
          {p.order?.customer.company && p.order.customer.company === p.order.customer.name && p.order.customer.pic && (
            <small className="admin-cell-sub">{p.order.customer.pic}</small>
          )}
        </span>
      ),
    },
    { key: 'method', label: t('Metode', 'Method'), render: (p) => paymentMethodSummary(p, lang) },
    {
      key: 'amount',
      label: t('Jumlah', 'Amount'),
      align: 'right',
      render: (p) => (
        <span>
          <strong>{formatIDR(p.amount)}</strong>
          {p.order && p.order.grandTotal !== p.amount && <small className="admin-cell-sub">{t('order', 'order')} {formatIDR(p.order.grandTotal)}</small>}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => <StatusBadge label={paymentLabel(p.status)[lang]} tone={paymentLabel(p.status).tone} small />,
    },
    {
      key: 'date',
      label: t('Tanggal', 'Date'),
      render: (p) => (
        <span>
          {formatDateTime(p.proof?.uploadedAt || p.createdAt, lang)}
          <small className="admin-cell-sub">{p.proof ? t('bukti diunggah', 'proof uploaded') : t('dibuat', 'created')}</small>
        </span>
      ),
    },
    {
      key: 'act',
      label: t('Aksi', 'Action'),
      render: (p) => (
        <RowActions
          actions={[
            { label: 'Detail', onClick: () => void openDetail(p.id) },
            ...(p.status === 'awaiting_verification'
              ? [
                  { label: t('Terima', 'Accept'), tone: 'success' as const, disabled: busy, onClick: () => void accept(p) },
                  { label: t('Tolak', 'Reject'), tone: 'danger' as const, disabled: busy, onClick: () => startReject(p) },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  const proofIsImage = detail?.proof?.mime?.startsWith('image/') ?? false;
  const proofUrl = detail?.proofUrl || detail?.proof?.url || null;
  const amountMismatch = !!detail?.order && detail.order.grandTotal !== detail.amount;

  return (
    <div>
      <AdminPageHead
        title={t('Pembayaran', 'Payments')}
        desc={t('Verifikasi bukti transfer/QRIS dan pantau status setiap percobaan pembayaran.', 'Verify transfer/QRIS proofs and track every payment attempt.')}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <AdminTabs
        groups={groups}
        value={status}
        label={t('Status pembayaran', 'Payment status')}
        onChange={(key) => {
          setStatus(key);
          setPage(1);
        }}
      />

      <form className="admin-toolbar" onSubmit={submitSearch}>
        <label className="admin-search">
          <span className="sr-only">{t('Cari pembayaran', 'Search payments')}</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari nomor order, invoice, customer', 'Search order number, invoice, customer')} />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Cari', 'Search')}
        </button>
        {dated && (
          <>
            <label className="admin-filter">
              <span>{t('Dari', 'From')}</span>
              <input
                type="date"
                className="admin-filter-input"
                value={range.from}
                max={range.to || undefined}
                onChange={(e) => {
                  setRange({ ...range, from: e.target.value });
                  setPage(1);
                }}
              />
            </label>
            <label className="admin-filter">
              <span>{t('Sampai', 'To')}</span>
              <input
                type="date"
                className="admin-filter-input"
                value={range.to}
                min={range.from || undefined}
                onChange={(e) => {
                  setRange({ ...range, to: e.target.value });
                  setPage(1);
                }}
              />
            </label>
          </>
        )}
        <label className="admin-filter">
          <span>{t('Metode', 'Method')}</span>
          <Select
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
          >
            <option value="">{t('Semua metode', 'All methods')}</option>
            {methods.map((m) => (
              <option key={m.code} value={m.code}>
                {tr(m.name, lang)}
              </option>
            ))}
          </Select>
        </label>
        {filtersChanged && (
          <button type="button" className="row-act" onClick={resetFilters}>
            Reset
          </button>
        )}
        <span className="admin-result-count">
          {meta.total} {t('pembayaran', 'payments')}
        </span>
      </form>
      <p className="admin-field-hint admin-filter-note">
        {!dated
          ? t('Antrean ini menampilkan semua pembayaran pada status tersebut tanpa batas tanggal.', 'This queue shows every payment in this status, with no date limit.')
          : range.from || range.to
          ? t('Tanggal = bukti diunggah (atau percobaan bayar dibuat bila belum ada bukti).', 'Date = proof uploaded (or payment attempt created when no proof yet).')
          : t('Semua tanggal.', 'All dates.')}
        {outsideRange > 0 && (
          <>
            {' '}
            {t(`${outsideRange} pembayaran lain berada di luar rentang tanggal.`, `${outsideRange} more payment(s) fall outside the date range.`)}
            <button type="button" onClick={() => { setRange({ from: '', to: '' }); setPage(1); }}>
              {t('Tampilkan semua tanggal', 'Show all dates')}
            </button>
          </>
        )}
      </p>

      <DataTable
        columns={columns}
        rows={rows}
        pagination={false}
        empty={loading ? t('Memuat pembayaran...', 'Loading payments...') : t('Tidak ada pembayaran pada filter ini.', 'No payments match this filter.')}
      />
      <Pager meta={meta} onPage={setPage} disabled={loading} />

      {detailLoading && <p className="admin-field-hint" style={{ marginTop: 12 }}>{t('Memuat detail pembayaran...', 'Loading payment details...')}</p>}

      {detail && !detailLoading && (
        <AdminModal title={`${t('Detail pembayaran', 'Payment details')} #${detail.id}`} onClose={() => setDetail(null)} width={880}>
          <div className="admin-modal-body">
            <div className="admin-grid-2">
              <div>
                <h3 className="admin-subtitle">{t('Bukti pembayaran', 'Payment proof')}</h3>
                {detail.proof && proofUrl ? (
                  <div className="admin-proof">
                    {proofIsImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={proofUrl} alt={detail.proof.originalName} className="admin-proof-image" />
                    ) : (
                      <div className="admin-image-placeholder" style={{ padding: 30 }}>
                        <Icon name="quote" size={28} />
                        <span>{detail.proof.originalName}</span>
                      </div>
                    )}
                    <p className="admin-field-hint">
                      <FileLink file={proofUrl ? { url: proofUrl, name: detail.proof.originalName, mime: detail.proof.mime } : null} className="link">
                        {t('Lihat berkas', 'View file')} <Icon name="arrow" size={13} />
                      </FileLink>{' '}
                      · {detail.proof.originalName} · {Math.round(detail.proof.size / 1024)} KB · {t('diunggah', 'uploaded')} {formatDateTime(detail.proof.uploadedAt, lang)}
                    </p>
                  </div>
                ) : (
                  <p className="admin-field-hint">{t('Belum ada bukti yang diunggah untuk percobaan ini.', 'No proof uploaded for this attempt.')}</p>
                )}
              </div>
              <div>
                <h3 className="admin-subtitle">{t('Ringkasan', 'Summary')}</h3>
                <dl className="admin-kv">
                  <div>
                    <dt>Order</dt>
                    <dd>
                      {detail.order ? (
                        <Link href={`/admin/orders/${encodeURIComponent(detail.order.number)}`} className="mono link">
                          {detail.order.number}
                        </Link>
                      ) : (
                        '—'
                      )}
                      {detail.order?.invoiceNumber && <span className="mono"> · {detail.order.invoiceNumber}</span>}
                    </dd>
                  </div>
                  <div>
                    <dt>Customer</dt>
                    <dd>
                      {detail.order?.customer.name}
                      {detail.order?.customer.company && detail.order.customer.company !== detail.order.customer.name ? ` · ${detail.order.customer.company}` : ''}
                      <br />
                      <span className="mono">{detail.order?.customer.email}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Metode', 'Method')}</dt>
                    <dd>{paymentMethodSummary(detail, lang)}</dd>
                  </div>
                  {detail.bankAccount && (
                    <div>
                      <dt>{t('Rekening tujuan', 'Destination account')}</dt>
                      <dd>
                        {detail.bankAccount.bankName} <span className="mono">{detail.bankAccount.accountNumber}</span> a.n. {detail.bankAccount.accountHolder}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>{t('Jumlah tagihan', 'Amount due')}</dt>
                    <dd>
                      <strong>{formatIDR(detail.amount)}</strong>
                      {detail.uniqueCode ? ` (${t('termasuk kode unik', 'incl. unique code')} ${detail.uniqueCode})` : ''}
                      {detail.order && (
                        <>
                          <br />
                          <small className={amountMismatch ? 'admin-warn-text' : undefined}>
                            {t('Total order', 'Order total')}: {formatIDR(detail.order.grandTotal)}
                            {amountMismatch && ` — ${t('berbeda dari jumlah percobaan ini', 'differs from this attempt')}`}
                          </small>
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge label={paymentLabel(detail.status)[lang]} tone={paymentLabel(detail.status).tone} small />
                      {detail.order && (
                        <>
                          {' '}
                          · {t('order', 'order')}: {detail.order.status}
                        </>
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{t('Waktu', 'Timing')}</dt>
                    <dd>
                      {t('Dibuat', 'Created')} {formatDateTime(detail.createdAt, lang)}
                      {detail.expiresAt && (
                        <>
                          <br />
                          {t('Batas bayar', 'Due')} {formatDateTime(detail.expiresAt, lang)}
                        </>
                      )}
                      {detail.paidAt && (
                        <>
                          <br />
                          {t('Dibayar', 'Paid')} {formatDateTime(detail.paidAt, lang)}
                        </>
                      )}
                    </dd>
                  </div>
                  {detail.verifiedBy && (
                    <div>
                      <dt>{t('Diverifikasi oleh', 'Verified by')}</dt>
                      <dd>
                        {detail.verifiedBy.name}
                        {detail.verifiedAt ? ` · ${formatDateTime(detail.verifiedAt, lang)}` : ''}
                      </dd>
                    </div>
                  )}
                  {detail.rejectReason && (
                    <div>
                      <dt>{t('Alasan penolakan', 'Rejection reason')}</dt>
                      <dd>{detail.rejectReason}</dd>
                    </div>
                  )}
                  {detail.externalId && (
                    <div>
                      <dt>{t('Referensi', 'Reference')}</dt>
                      <dd className="mono">{detail.externalId}</dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>

            {actionError && (
              <p className="admin-form-error" role="alert" style={{ marginTop: 16 }}>
                {actionError}
              </p>
            )}

            {detail.status === 'awaiting_verification' && rejecting && (
              <form className="admin-form" style={{ padding: 0, marginTop: 16 }} onSubmit={submitReject}>
                <label>
                  <span className="field-label">{t('Alasan penolakan', 'Rejection reason')} *</span>
                  <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('Contoh: nominal transfer tidak sesuai / bukti tidak terbaca', 'e.g. transfer amount mismatch / proof unreadable')} required />
                </label>
                <div className="admin-modal-actions">
                  <button type="button" className="btn btn-line btn-sm" onClick={() => setRejecting(false)}>
                    {t('Batal', 'Cancel')}
                  </button>
                  <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                    {busy ? t('Memproses...', 'Processing...') : t('Tolak bukti pembayaran', 'Reject payment proof')}
                  </button>
                </div>
              </form>
            )}

            {!rejecting && (
              <div className="admin-modal-actions">
                <button type="button" className="btn btn-line btn-sm" onClick={() => setDetail(null)}>
                  {t('Tutup', 'Close')}
                </button>
                {detail.status === 'awaiting_verification' && (
                  <>
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => startReject(detail)}>
                      {t('Tolak…', 'Reject…')}
                    </button>
                    <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => void accept(detail)}>
                      <Icon name="check" size={14} /> {t('Terima pembayaran', 'Accept payment')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  );
}
