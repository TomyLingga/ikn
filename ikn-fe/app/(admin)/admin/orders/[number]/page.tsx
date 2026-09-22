'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import OrderTracking from '@/components/OrderTracking';
import EmptyState from '@/components/EmptyState';
import SessionLoader from '@/components/SessionLoader';
import { AdminCard } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderStatus, paymentStatus } from '@/lib/commerce';
import { api, ApiError, errorMessage } from '@/lib/api';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import type { Order } from '@/lib/types';
import styles from './page.module.css';

const proofStatusLabels: Record<string, { id: string; en: string; tone: 'ok' | 'warn' | 'bad' }> = {
  pending: { id: 'Menunggu pemeriksaan', en: 'Awaiting inspection', tone: 'warn' },
  accepted: { id: 'Diterima', en: 'Accepted', tone: 'ok' },
  rejected: { id: 'Ditolak', en: 'Rejected', tone: 'bad' },
};

export default function AdminOrderDetail({ params }: { params: { number: string } }) {
  const { lang } = useLang();
  const number = decodeURIComponent(params.number);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [trackingNo, setTrackingNo] = useState('');
  const [dueHours, setDueHours] = useState('24');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      const result = await api<Order>(`/admin/orders/${encodeURIComponent(number)}`);
      setOrder(result);
      setTrackingNo(result.trackingNo || '');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<Order>) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      const next = await action();
      setOrder(next);
      setTrackingNo(next.trackingNo || '');
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function acceptPayment() {
    void run(() => api<Order>(`/admin/payments/${encodeURIComponent(number)}/accept`, { method: 'POST', body: {} }));
  }

  function rejectPayment() {
    const reason = window.prompt(
      lang === 'en'
        ? 'Reason for rejecting payment proof (required):'
        : 'Alasan penolakan bukti pembayaran (wajib):'
    );
    if (reason === null) return;
    if (!reason.trim()) {
      setActionError(lang === 'en' ? 'Rejection reason is required.' : 'Alasan penolakan wajib diisi.');
      return;
    }
    void run(() =>
      api<Order>(`/admin/payments/${encodeURIComponent(number)}/reject`, {
        method: 'POST',
        body: { reason: reason.trim() },
      })
    );
  }

  function markPacking() {
    void run(() =>
      api<Order>(`/admin/orders/${encodeURIComponent(number)}/status`, {
        method: 'POST',
        body: { status: 'packing' },
      })
    );
  }

  function markShipped() {
    void run(() =>
      api<Order>(`/admin/orders/${encodeURIComponent(number)}/status`, {
        method: 'POST',
        body: trackingNo.trim() ? { status: 'shipped', trackingNo: trackingNo.trim() } : { status: 'shipped' },
      })
    );
  }

  function markDelivered() {
    void run(() =>
      api<Order>(`/admin/orders/${encodeURIComponent(number)}/status`, {
        method: 'POST',
        body: { status: 'delivered' },
      })
    );
  }

  function cancelOrder() {
    if (!window.confirm(lang === 'en' ? `Cancel order ${number}?` : `Batalkan pesanan ${number}?`)) return;
    void run(() => api<Order>(`/admin/orders/${encodeURIComponent(number)}/cancel`, { method: 'POST', body: {} }));
  }

  function updateDue() {
    const hours = Number(dueHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      setActionError(lang === 'en' ? 'Time limit hours must be greater than 0.' : 'Jumlah jam batas waktu harus lebih dari 0.');
      return;
    }
    void run(() =>
      api<Order>(`/admin/orders/${encodeURIComponent(number)}/due`, {
        method: 'PUT',
        body: { hours },
      })
    );
  }

  if (loading && !order) {
    return (
      <SessionLoader
        message={lang === 'en' ? 'Loading order details...' : 'Memuat detail order...'}
      />
    );
  }

  if (notFound) {
    return (
      <EmptyState
        icon="close"
        title={lang === 'en' ? 'Order not found' : 'Order tidak ditemukan'}
        body={
          lang === 'en'
            ? 'Transaction is unavailable or order number is incorrect.'
            : 'Transaksi tidak tersedia atau nomor order salah.'
        }
        action={{ href: '/admin/orders', label: lang === 'en' ? 'Back to orders' : 'Kembali ke order' }}
      />
    );
  }

  if (!order) {
    return (
      <div>
        <p className="form-error">
          {error || (lang === 'en' ? 'Failed to load order.' : 'Gagal memuat order.')}
        </p>
        <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()}>
          {lang === 'en' ? 'Reload' : 'Muat ulang'}
        </button>
      </div>
    );
  }

  const statusLabel = orderStatus[order.status]?.[lang] || orderStatus[order.status]?.id || order.status;
  const paymentLabel = paymentStatus[order.payment]?.[lang] || paymentStatus[order.payment]?.id || order.payment;
  const proofUrl = `/api/admin/payments/${encodeURIComponent(order.number)}/proof/file`;
  const proofStatus = order.proof ? proofStatusLabels[order.proof.status] : null;
  const canCancel = ['awaiting_payment', 'awaiting_verification'].includes(order.status);

  return (
    <div>
      <div className="admin-head">
        <div>
          <Link href="/admin/orders" className="link" style={{ marginBottom: 8 }}>
            <Icon name="chevronLeft" size={16} /> {lang === 'en' ? 'All orders' : 'Semua order'}
          </Link>
          <h1 className="admin-title mono">{order.number}</h1>
          <p className="admin-desc">
            {lang === 'en' ? 'Created on' : 'Dibuat'} {formatDate(order.date)}
          </p>
        </div>
        <div className={styles.badges}>
          <StatusBadge label={statusLabel} tone={orderStatus[order.status]?.tone} />
          <StatusBadge label={paymentLabel} tone={paymentStatus[order.payment]?.tone} />
        </div>
      </div>

      {actionError && <p className="form-error" role="alert">{actionError}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="admin-grid-2">
        <AdminCard title={lang === 'en' ? 'Order Items' : 'Item pesanan'}>
          {order.items.map((item) => (
            <div key={item.slug} className={styles.item}>
              <span className={styles.itemName}>{item.name} <small>({item.code}) ×{item.qty} {item.unit}</small></span>
              <span>{formatIDR(item.price * item.qty)}</span>
            </div>
          ))}
          <div className={styles.summaryRow}><span>Subtotal</span><span>{formatIDR(order.subtotal)}</span></div>
          <div className={styles.summaryRow}>
            <span>
              {lang === 'en' ? 'Shipping' : 'Ongkir'}
              {order.shippingMethod ? ` · ${order.shippingMethod}` : ''}
            </span>
            <span>{formatIDR(order.shipping)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{lang === 'en' ? 'Admin fee' : 'Biaya admin'}</span>
            <span>{formatIDR(order.adminFee)}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.total}`}>
            <span>Total</span>
            <span>{formatIDR(order.total)}</span>
          </div>
          {order.note && (
            <p className="admin-note" style={{ marginTop: 12 }}>
              {lang === 'en' ? 'Customer note' : 'Catatan customer'}: {order.note}
            </p>
          )}
        </AdminCard>

        <AdminCard title={lang === 'en' ? 'Customer & Shipping' : 'Customer & pengiriman'}>
          <p className={styles.address}>
            <strong>{order.customer.name}</strong><br />
            PIC: {order.customer.pic}<br />
            {order.customer.email}
          </p>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '14px 0' }} />
          <p className={styles.address}>
            <strong>{order.address.recipient}</strong><br />
            {order.address.phone}<br />
            {order.address.line}
          </p>
          {order.trackingNo && (
            <p className={styles.trackingNumber}>
              {lang === 'en' ? 'Tracking No.:' : 'No. resi:'} <strong>{order.trackingNo}</strong>
            </p>
          )}
        </AdminCard>
      </div>

      <div className="admin-grid-2">
        <AdminCard title={lang === 'en' ? 'Payment' : 'Pembayaran'}>
          {order.bankInfo ? (
            <div className={styles.bank}>
              <span className={styles.bankName}>{order.bankInfo.bank}</span>
              <span className={styles.bankNumber}>{order.bankInfo.number}</span>
              <span className={styles.bankHolder}>a.n. {order.bankInfo.holder}</span>
            </div>
          ) : (
            <p className="admin-note">
              {lang === 'en' ? 'Customer has not selected destination bank.' : 'Customer belum memilih bank tujuan.'}
            </p>
          )}

          {order.dueAt && (
            <p className="admin-note">
              {lang === 'en' ? 'Payment deadline:' : 'Batas waktu pembayaran:'} <strong>{formatDateTime(order.dueAt)}</strong>
            </p>
          )}

          {order.proof ? (
            <div style={{ marginTop: 12 }}>
              <p className="admin-note" style={{ marginBottom: 6 }}>
                {lang === 'en' ? 'Transfer proof:' : 'Bukti transfer:'} <span className="mono">{order.proof.originalName}</span> · {lang === 'en' ? 'uploaded' : 'diunggah'} {formatDateTime(order.proof.uploadedAt)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {proofStatus && (
                  <StatusBadge
                    label={proofStatus[lang] || proofStatus.id}
                    tone={proofStatus.tone}
                    small
                  />
                )}
                <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="link">
                  {lang === 'en' ? 'View proof' : 'Lihat bukti'} <Icon name="arrow" size={14} />
                </a>
              </div>
              {order.proof.status === 'rejected' && order.proof.rejectReason && (
                <p className="admin-note" style={{ marginTop: 8 }}>
                  {lang === 'en' ? 'Rejection reason:' : 'Alasan penolakan:'} {order.proof.rejectReason}
                </p>
              )}
            </div>
          ) : (
            <p className="admin-note">
              {lang === 'en' ? 'Transfer proof not yet uploaded by customer.' : 'Bukti transfer belum diunggah customer.'}
            </p>
          )}

          {order.rejectReason && (
            <p className="admin-note" style={{ marginTop: 8 }}>
              {lang === 'en' ? 'Last rejection reason:' : 'Alasan penolakan terakhir:'} {order.rejectReason}
            </p>
          )}

          {order.payment === 'awaiting_confirmation' && (
            <div className="row-actions" style={{ marginTop: 14, flexWrap: 'wrap' }}>
              <button type="button" className="row-act row-act-success" disabled={busy} onClick={acceptPayment}>
                {lang === 'en' ? 'Accept payment' : 'Terima pembayaran'}
              </button>
              <button type="button" className="row-act row-act-danger" disabled={busy} onClick={rejectPayment}>
                {lang === 'en' ? 'Reject…' : 'Tolak…'}
              </button>
            </div>
          )}

          {order.status === 'awaiting_payment' && (
            <div className="admin-form" style={{ marginTop: 16 }}>
              <span className="field-label">
                {lang === 'en' ? 'Change payment time limit (hours from now)' : 'Ubah batas waktu pembayaran (jam dari sekarang)'}
              </span>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                <input
                  type="number"
                  min={1}
                  value={dueHours}
                  onChange={(event) => setDueHours(event.target.value)}
                  style={{ width: 100 }}
                />
                <button type="button" className="row-act" disabled={busy} onClick={updateDue}>
                  {lang === 'en' ? 'Save time limit' : 'Simpan batas waktu'}
                </button>
              </div>
            </div>
          )}
        </AdminCard>

        <AdminCard title={lang === 'en' ? 'Track & Transaction Actions' : 'Lacak & aksi transaksi'}>
          <OrderTracking order={order} />

          {(order.status === 'processing' || order.status === 'packing') && (
            <div className="admin-form" style={{ marginTop: 16 }}>
              <label>
                <span className="field-label">
                  {lang === 'en' ? 'Tracking No. (optional upon shipping)' : 'No. resi (opsional saat kirim)'}
                </span>
                <input
                  value={trackingNo}
                  onChange={(event) => setTrackingNo(event.target.value)}
                  placeholder={lang === 'en' ? 'Example: JNE-000123' : 'Contoh: JNE-000123'}
                />
              </label>
            </div>
          )}

          <div className="row-actions" style={{ marginTop: 16, flexWrap: 'wrap' }}>
            {order.status === 'processing' && (
              <button type="button" className="row-act" disabled={busy} onClick={markPacking}>
                {lang === 'en' ? 'Mark as packing' : 'Tandai dikemas'}
              </button>
            )}
            {(order.status === 'processing' || order.status === 'packing') && (
              <button type="button" className="row-act" disabled={busy} onClick={markShipped}>
                {lang === 'en' ? 'Mark as shipped' : 'Tandai dikirim'}
              </button>
            )}
            {order.status === 'shipped' && (
              <button type="button" className="row-act row-act-success" disabled={busy} onClick={markDelivered}>
                {lang === 'en' ? 'Mark as delivered' : 'Tandai diterima'}
              </button>
            )}
            {canCancel && (
              <button type="button" className="row-act row-act-danger" disabled={busy} onClick={cancelOrder}>
                {lang === 'en' ? 'Cancel order' : 'Batalkan pesanan'}
              </button>
            )}
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
