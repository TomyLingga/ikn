'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import OrderTracking from '@/components/OrderTracking';
import EmptyState from '@/components/EmptyState';
import SessionLoader from '@/components/SessionLoader';
import AdminModal from '@/components/admin/AdminModal';
import { AdminCard } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { orderLabel, paymentLabel, shipmentMetricsText, shippingBreakdownText } from '@/lib/commerce';
import { api, apiUpload, ApiError, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { adminCancellableStatuses, dueEditableStatuses, fromDateTimeLocal, paymentMethodSummary, refreshAdminBadges } from '@/lib/admin';
import { formatDateTime, formatIDR } from '@/lib/format';
import type { Order, OrderAttachment, Payment, TrackingUpdate } from '@/lib/types';
import styles from './page.module.css';
import { confirmDialog } from '@/components/ConfirmDialog';
import Select from '@/components/Select';
import { FileLink } from '@/components/FileViewer';

type Modal = { type: 'cancel' } | { type: 'ship' } | { type: 'due' } | { type: 'reject'; payment: Payment } | { type: 'note'; status: 'processing' | 'delivered' | 'completed' } | null;

const EXTEND_OPTIONS = [6, 12, 24, 48, 72, 168];

/** Pesan aksi: 409 INVALID_TRANSITION menyertakan meta.from/to; 422 pesan field pertama. */
function actionErrorText(err: unknown, lang: 'id' | 'en'): string {
  if (err instanceof ApiError && err.code === 'INVALID_TRANSITION' && err.meta) {
    const from = String(err.meta.from ?? '?');
    const to = String(err.meta.to ?? '?');
    return `${err.message} (${orderLabel(from)[lang]} → ${orderLabel(to)[lang]})`;
  }
  return errorMessage(err);
}

// Detail order admin: GET /admin/orders/{number}; aksi status/cancel/due + accept/reject payment aktif.
export default function AdminOrderDetail({ params }: { params: { number: string } }) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const number = decodeURIComponent(params.number);
  const orderPath = `/admin/orders/${encodeURIComponent(number)}`;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  // Field modal.
  const [reason, setReason] = useState('');
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [note, setNote] = useState('');
  const [trackNote, setTrackNote] = useState('');
  // Lampiran (faktur pajak, surat jalan): dipilih di modal "Tandai dikirim" atau diunggah dari kartu Lampiran.
  const [shipFiles, setShipFiles] = useState<File[]>([]);
  const [attachFile, setAttachFile] = useState<File | null>(null);
  const [attachLabel, setAttachLabel] = useState('');
  const [dueMode, setDueMode] = useState<'hours' | 'date'>('hours');
  const [extendHours, setExtendHours] = useState('24');
  const [dueAt, setDueAt] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotFound(false);
    try {
      setOrder(await api<Order>(orderPath));
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function openModal(next: Modal) {
    setReason('');
    setCourier(order?.courier || '');
    setTrackingNumber(order?.trackingNumber || '');
    setNote('');
    setDueMode('hours');
    setExtendHours('24');
    setDueAt('');
    setActionError('');
    setModal(next);
  }

  async function run(action: () => Promise<unknown>, okMessage: string) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      await action();
      refreshAdminBadges(); // terima/tolak pembayaran atau batal order mengubah antrean verifikasi di sidebar
      await refresh();
      setActionOk(okMessage);
      setModal(null);
    } catch (err) {
      setActionError(actionErrorText(err, lang));
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(status: 'processing' | 'shipped' | 'delivered' | 'completed', extra: Record<string, string | null> = {}) {
    void run(
      () => api(`${orderPath}/status`, { method: 'POST', body: { status, ...extra } }),
      t(`Status order diubah menjadi ${orderLabel(status).id}.`, `Order status changed to ${orderLabel(status).en}.`),
    );
  }

  function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reason.trim()) {
      setActionError(t('Alasan pembatalan wajib diisi.', 'Cancellation reason is required.'));
      return;
    }
    void run(() => api(`${orderPath}/cancel`, { method: 'POST', body: { reason: reason.trim() } }), t('Order dibatalkan.', 'Order cancelled.'));
  }

  // Unggah satu lampiran (multipart) ke POST /admin/orders/{number}/attachments.
  async function uploadAttachment(file: File, label = ''): Promise<void> {
    const fd = new FormData();
    fd.append('file', file);
    if (label.trim()) fd.append('label', label.trim());
    await apiUpload(`${orderPath}/attachments`, fd);
  }

  async function submitShip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const files = shipFiles;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      await api(`${orderPath}/status`, { method: 'POST', body: { status: 'shipped', courier: courier.trim(), trackingNumber: trackingNumber.trim(), note: note.trim() || null } });
    } catch (err) {
      setActionError(actionErrorText(err, lang));
      setBusy(false);
      return;
    }
    // Status sudah berubah; lampiran menyusul satu per satu. Gagal unggah tidak membatalkan status: modal ditutup,
    // berkas yang gagal dilaporkan dan bisa diunggah ulang dari kartu "Lampiran untuk customer".
    const failed: string[] = [];
    for (const file of files) {
      try {
        await uploadAttachment(file);
      } catch (err) {
        failed.push(`${file.name} (${actionErrorText(err, lang)})`);
      }
    }
    setShipFiles([]);
    await refresh();
    setModal(null);
    setBusy(false);
    const uploaded = files.length - failed.length;
    if (failed.length > 0) {
      setActionError(
        t(
          `Order ditandai dikirim, tetapi ${failed.length} lampiran gagal diunggah: ${failed.join('; ')}. Unggah ulang lewat kartu Lampiran.`,
          `Order marked as shipped, but ${failed.length} attachment(s) failed: ${failed.join('; ')}. Re-upload from the Attachments card.`,
        ),
      );
    }
    setActionOk(
      uploaded > 0
        ? t(`Order ditandai dikirim; ${uploaded} lampiran diunggah dan customer diberi tahu.`, `Order marked as shipped; ${uploaded} attachment(s) uploaded and the customer notified.`)
        : t('Order ditandai dikirim.', 'Order marked as shipped.'),
    );
  }

  function submitAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attachFile) return;
    const file = attachFile;
    const label = attachLabel;
    void run(
      async () => {
        await uploadAttachment(file, label);
        setAttachFile(null);
        setAttachLabel('');
      },
      t('Lampiran diunggah; customer mendapat notifikasi.', 'Attachment uploaded; the customer has been notified.'),
    );
  }

  async function removeAttachment(attachment: OrderAttachment) {
    if (!(await confirmDialog(t(`Hapus lampiran "${attachment.label || attachment.file?.originalName}"?`, `Delete attachment "${attachment.label || attachment.file?.originalName}"?`)))) return;
    void run(() => api(`${orderPath}/attachments/${attachment.id}`, { method: 'DELETE' }), t('Lampiran dihapus.', 'Attachment deleted.'));
  }

  // Catatan perjalanan kiriman (ASUMSI A-70): hanya selama order berstatus dikirim; customer mendapat notifikasi.
  function submitTracking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = trackNote.trim();
    if (value.length < 3) {
      setActionError(t('Catatan perjalanan minimal 3 karakter.', 'The shipping note needs at least 3 characters.'));
      return;
    }
    void run(
      () => api(`${orderPath}/tracking`, { method: 'POST', body: { note: value } }).then(() => setTrackNote('')),
      t('Catatan perjalanan ditambahkan; customer menerima notifikasi.', 'Shipping note added; the customer has been notified.'),
    );
  }

  async function removeTracking(update: TrackingUpdate) {
    if (!await confirmDialog(t(`Hapus catatan "${update.note}"?`, `Delete the note "${update.note}"?`))) return;
    void run(() => api(`${orderPath}/tracking/${update.id}`, { method: 'DELETE' }), t('Catatan perjalanan dihapus.', 'Shipping note deleted.'));
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'note') return;
    changeStatus(modal.status, { note: note.trim() || null });
  }

  function submitDue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    if (dueMode === 'hours') {
      const hours = Number(extendHours);
      if (!Number.isFinite(hours) || hours <= 0) {
        setActionError(t('Jumlah jam harus lebih dari 0.', 'Hours must be greater than 0.'));
        return;
      }
      body.extendHours = hours;
    } else {
      const iso = fromDateTimeLocal(dueAt);
      if (!iso) {
        setActionError(t('Tanggal batas bayar tidak valid.', 'Invalid payment due date.'));
        return;
      }
      body.paymentDueAt = iso;
    }
    void run(() => api(`${orderPath}/due`, { method: 'PUT', body }), t('Batas waktu pembayaran diperbarui.', 'Payment deadline updated.'));
  }

  async function acceptPayment(payment: Payment) {
    if (!await confirmDialog(t(`Terima pembayaran #${payment.id} sebesar ${formatIDR(payment.amount)}?`, `Accept payment #${payment.id} of ${formatIDR(payment.amount)}?`))) return;
    void run(() => api(`/admin/payments/${payment.id}/accept`, { method: 'POST', body: {} }), t('Pembayaran diterima; order berstatus dibayar.', 'Payment accepted; order is now paid.'));
  }

  function submitReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (modal?.type !== 'reject') return;
    if (!reason.trim()) {
      setActionError(t('Alasan penolakan wajib diisi.', 'Rejection reason is required.'));
      return;
    }
    void run(
      () => api(`/admin/payments/${modal.payment.id}/reject`, { method: 'POST', body: { reason: reason.trim() } }),
      t('Bukti pembayaran ditolak; customer dapat mengunggah ulang.', 'Payment proof rejected; the customer can upload again.'),
    );
  }

  if (loading && !order) {
    return <SessionLoader message={t('Memuat detail order...', 'Loading order details...')} />;
  }

  if (notFound) {
    return (
      <EmptyState
        icon="close"
        title={t('Order tidak ditemukan', 'Order not found')}
        body={t('Transaksi tidak tersedia atau nomor order salah.', 'Transaction is unavailable or the order number is incorrect.')}
        action={{ href: '/admin/orders', label: t('Kembali ke order', 'Back to orders') }}
      />
    );
  }

  if (!order) {
    return (
      <div>
        <p className="form-error">{error || t('Gagal memuat order.', 'Failed to load order.')}</p>
        <button type="button" className="btn btn-line btn-sm" onClick={() => void refresh()}>
          {t('Muat ulang', 'Reload')}
        </button>
      </div>
    );
  }

  const status = orderLabel(order.status);
  const payStatus = paymentLabel(order.paymentStatus);
  const addr = order.shippingAddress;
  const canCancel = adminCancellableStatuses.includes(order.status);
  const canEditDue = dueEditableStatuses.includes(order.status);
  const awaitingPayments = order.payments.filter((p) => p.status === 'awaiting_verification');
  const activeId = order.activePayment?.id ?? order.payment?.id ?? null;
  const taxLabel = order.priceIncludesTax
    ? t(`PPN ${order.taxRate ?? ''}% (termasuk dalam harga)`, `VAT ${order.taxRate ?? ''}% (included in price)`)
    : t(`PPN ${order.taxRate ?? ''}%`, `VAT ${order.taxRate ?? ''}%`);

  return (
    <div>
      <div className="admin-head">
        <div>
          <Link href="/admin/orders" className="link" style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="chevronLeft" size={16} /> {t('Semua order', 'All orders')}
          </Link>
          <h1 className="admin-title mono">{order.number}</h1>
          <div className={styles.headMeta}>
            <span>
              {t('Dibuat', 'Created')} {formatDateTime(order.date, lang)}
            </span>
            {order.invoiceNumber && (
              <span>
                Invoice <span className="mono">{order.invoiceNumber}</span>
              </span>
            )}
            {order.paymentDueAt && !order.paidAt && (
              <span>
                {t('Batas bayar', 'Payment due')} <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
              </span>
            )}
            {order.paidAt && (
              <span>
                {t('Dibayar', 'Paid')} {formatDateTime(order.paidAt, lang)}
              </span>
            )}
          </div>
        </div>
        <div className={styles.badges}>
          <StatusBadge label={status[lang]} tone={status.tone} />
          <StatusBadge label={payStatus[lang]} tone={payStatus.tone} />
          <a href={`/print/invoice/${encodeURIComponent(order.number)}`} target="_blank" rel="noopener" className="btn btn-line btn-sm">
            <Icon name="arrowDown" size={15} /> {t('Cetak invoice', 'Print invoice')}
          </a>
        </div>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          {actionError}
        </p>
      )}
      {actionOk && (
        <p className="admin-toast" role="status">
          {actionOk}
        </p>
      )}
      {error && <p className="form-error">{error}</p>}

      <div className="admin-grid-2">
        <AdminCard title={t('Item pesanan', 'Order items')}>
          {order.items.map((item) => (
            <div key={item.id ?? item.productSlug} className={styles.item}>
              <span className={styles.itemThumb}>
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.image} alt="" />
                ) : (
                  <Icon name="image" size={18} />
                )}
              </span>
              <span className={styles.itemName}>
                <strong>{tr(item.name, lang)}</strong>
                <small>
                  {item.code} · {item.qty} {item.unit} × {formatIDR(item.unitPrice)}
                  {item.discountAmount > 0 && ` · ${t('diskon', 'discount')} −${formatIDR(item.discountAmount)}`}
                </small>
              </span>
              <span className={styles.itemTotal}>
                {formatIDR(item.lineTotal - (item.discountAmount || 0))}
                {item.productSlug && (
                  <small>
                    <Link href={`/catalog/${item.productSlug}`} className="link" target="_blank">
                      {t('lihat produk', 'view product')}
                    </Link>
                  </small>
                )}
              </span>
            </div>
          ))}

          <div className={styles.summaryRow} style={{ marginTop: 12 }}>
            <span>Subtotal</span>
            <span>{formatIDR(order.subtotal)}</span>
          </div>
          {order.discountTotal > 0 && (
            <div className={styles.summaryRow}>
              <span>
                {t('Diskon', 'Discount')}
                {order.voucherCode && <small> · {t('voucher', 'voucher')} {order.voucherCode}</small>}
              </span>
              <span>−{formatIDR(order.discountTotal)}</span>
            </div>
          )}
          <div className={styles.summaryRow}>
            <span>
              {t('Ongkir', 'Shipping')}
              {order.shippingMethod && (
                <small>
                  {' '}
                  · {tr(order.shippingMethod.label, lang)}
                  {order.shippingMethod.eta ? ` (${tr(order.shippingMethod.eta, lang)})` : ''}
                  {shipmentMetricsText(order.shippingMethod) ? ` · ${shipmentMetricsText(order.shippingMethod)}` : ''}
                  {order.shippingMethod.breakdown && order.shippingMethod.type !== 'flat' && !order.shippingMethod.breakdown.free && (
                    <span className="admin-cell-sub">{shippingBreakdownText(order.shippingMethod.breakdown, lang)}</span>
                  )}
                </small>
              )}
            </span>
            <span>{formatIDR(order.shippingTotal)}</span>
          </div>
          {(order.fees ?? []).map((fee) => (
            <div key={fee.id} className={styles.summaryRow}>
              <span>{tr(fee.name, lang)}</span>
              <span>{formatIDR(fee.amount)}</span>
            </div>
          ))}
          {(!order.fees || order.fees.length === 0) && order.feeTotal > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('Biaya tambahan', 'Additional fees')}</span>
              <span>{formatIDR(order.feeTotal)}</span>
            </div>
          )}
          {order.taxTotal > 0 && (
            <div className={`${styles.summaryRow} ${order.priceIncludesTax ? styles.summaryMuted : ''}`}>
              <span>{taxLabel}</span>
              <span>{order.priceIncludesTax ? `(${formatIDR(order.taxTotal)})` : formatIDR(order.taxTotal)}</span>
            </div>
          )}
          {order.uniqueCode > 0 && (
            <div className={styles.summaryRow}>
              <span>{t('Kode unik transfer', 'Transfer unique code')}</span>
              <span>{formatIDR(order.uniqueCode)}</span>
            </div>
          )}
          <div className={`${styles.summaryRow} ${styles.total}`}>
            <span>Total</span>
            <span>{formatIDR(order.grandTotal)}</span>
          </div>
          {order.note && (
            <p className={styles.note}>
              <strong>{t('Catatan customer', 'Customer note')}:</strong> {order.note}
            </p>
          )}
          {order.cancelReason && (
            <p className={styles.note}>
              <strong>{t('Alasan pembatalan', 'Cancellation reason')}:</strong> {order.cancelReason}
            </p>
          )}
        </AdminCard>

        <AdminCard title={t('Customer & pengiriman', 'Customer & shipping')}>
          <p className={styles.address}>
            <strong>{order.customer.company || order.customer.name}</strong>
            <br />
            PIC: {order.customer.pic || order.customer.name}
            <br />
            <span className="mono">{order.customer.email}</span>
            {order.customer.phone && (
              <>
                <br />
                {t('Telepon', 'Phone')}: {order.customer.phone}
              </>
            )}
            {order.customer.taxId && (
              <>
                <br />
                NPWP: <span className="mono">{order.customer.taxId}</span>
              </>
            )}
            <br />
            <Link href={`/admin/customers?q=${encodeURIComponent(order.customer.email)}`} className="link">
              {t('Lihat profil customer', 'View customer profile')}
            </Link>
            {' · '}
            <Link href={`/admin/chat?customer=${order.customer.id}`} className="link">
              {t('Chat customer', 'Chat with customer')}
            </Link>
          </p>
          <hr className={styles.divider} />
          <p className={styles.address}>
            <strong>
              {addr.label ? `${addr.label} · ` : ''}
              {addr.recipientName}
            </strong>
            <br />
            {addr.phone}
            <br />
            {addr.addressLine}
            <br />
            {[addr.region?.village, addr.region?.district, addr.region?.regency, addr.region?.province].filter(Boolean).join(', ')}
            {addr.postalCode ? ` ${addr.postalCode}` : ''}
            {addr.note && (
              <>
                <br />
                <em>{addr.note}</em>
              </>
            )}
            {addr.lat != null && addr.lng != null && (
              <>
                <br />
                <a className="link" href={`https://www.openstreetmap.org/?mlat=${addr.lat}&mlon=${addr.lng}#map=17/${addr.lat}/${addr.lng}`} target="_blank" rel="noopener noreferrer">
                  {t('Lihat di peta', 'View on map')} ({addr.lat}, {addr.lng})
                </a>
              </>
            )}
          </p>
          {(order.courier || order.trackingNumber) && (
            <p className={styles.trackingNumber}>
              {t('Kurir', 'Courier')}: <strong>{order.courier || '—'}</strong> · {t('No. resi', 'Tracking No.')}:{' '}
              <strong className="mono">{order.trackingNumber || '—'}</strong>
              {order.shippedAt && (
                <>
                  <br />
                  <small>
                    {t('Dikirim', 'Shipped')} {formatDateTime(order.shippedAt, lang)}
                    {order.deliveredAt ? ` · ${t('diterima', 'delivered')} ${formatDateTime(order.deliveredAt, lang)}` : ''}
                  </small>
                </>
              )}
            </p>
          )}
        </AdminCard>
      </div>

      <div className="admin-grid-2" style={{ marginTop: 20 }}>
        <AdminCard title={t('Pembayaran', 'Payments')} desc={t('Setiap percobaan bayar tercatat terpisah; yang aktif ditandai.', 'Each payment attempt is recorded separately; the active one is highlighted.')}>
          {order.payments.length === 0 && <p className="admin-field-hint">{t('Belum ada percobaan pembayaran.', 'No payment attempts yet.')}</p>}
          <div className={styles.paymentList}>
            {[...order.payments].reverse().map((payment) => {
              const label = paymentLabel(payment.status);
              const isActive = payment.id === activeId;
              return (
                <div key={payment.id} className={`${styles.payment} ${isActive ? styles.paymentActive : ''}`}>
                  <div className={styles.paymentHead}>
                    <strong>
                      #{payment.id} · {paymentMethodSummary(payment, lang)}
                    </strong>
                    <StatusBadge label={label[lang]} tone={label.tone} small />
                  </div>
                  <div className={styles.paymentMeta}>
                    <span>
                      {t('Jumlah', 'Amount')}: <b>{formatIDR(payment.amount)}</b>
                      {payment.uniqueCode ? ` (${t('kode unik', 'unique code')} ${payment.uniqueCode})` : ''}
                    </span>
                    <span>
                      {t('Dibuat', 'Created')}: {formatDateTime(payment.createdAt, lang)}
                    </span>
                    {payment.bankAccount && (
                      <span>
                        {t('Rekening', 'Account')}: {payment.bankAccount.bankName} {payment.bankAccount.accountNumber}
                      </span>
                    )}
                    {payment.expiresAt && payment.status === 'pending' && (
                      <span>
                        {t('Kedaluwarsa', 'Expires')}: {formatDateTime(payment.expiresAt, lang)}
                      </span>
                    )}
                    {payment.proof && (
                      <span>
                        {t('Bukti', 'Proof')}:{' '}
                        <FileLink file={{ url: payment.proof.url || `/api/v1/files/${payment.proof.mediaId}`, name: payment.proof.originalName, mime: payment.proof.mime }} className="link">
                          {payment.proof.originalName}
                        </FileLink>{' '}
                        · {formatDateTime(payment.proof.uploadedAt, lang)}
                      </span>
                    )}
                    {payment.paidAt && (
                      <span>
                        {t('Dibayar', 'Paid')}: {formatDateTime(payment.paidAt, lang)}
                      </span>
                    )}
                    {payment.verifiedBy && (
                      <span>
                        {t('Diverifikasi', 'Verified')}: {payment.verifiedBy.name}
                        {payment.verifiedAt ? ` · ${formatDateTime(payment.verifiedAt, lang)}` : ''}
                      </span>
                    )}
                    {payment.rejectReason && (
                      <span>
                        {t('Alasan tolak', 'Reject reason')}: <b>{payment.rejectReason}</b>
                      </span>
                    )}
                    {payment.externalId && (
                      <span>
                        Ref: <span className="mono">{payment.externalId}</span>
                      </span>
                    )}
                  </div>
                  {payment.status === 'awaiting_verification' && (
                    <div className={styles.paymentActions}>
                      <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => acceptPayment(payment)}>
                        <Icon name="check" size={14} /> {t('Terima pembayaran', 'Accept payment')}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => openModal({ type: 'reject', payment })}>
                        {t('Tolak bukti…', 'Reject proof…')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {awaitingPayments.length === 0 && order.status === 'pending_payment' && (
            <p className="admin-field-hint" style={{ marginTop: 12 }}>
              {t('Customer belum mengunggah bukti pembayaran.', 'The customer has not uploaded a payment proof yet.')}
            </p>
          )}
        </AdminCard>

        <AdminCard title={t('Lacak & aksi order', 'Tracking & order actions')}>
          <OrderTracking order={order} onRemoveUpdate={order.canAddTracking ? removeTracking : undefined} removeDisabled={busy} />

          {order.canAddTracking && (
            <form className={styles.trackForm} onSubmit={submitTracking}>
              <label htmlFor="track-note" className="field-label">
                {t('Tambah catatan perjalanan', 'Add a shipping note')}
              </label>
              <div className={styles.trackRow}>
                <input
                  id="track-note"
                  value={trackNote}
                  maxLength={200}
                  onChange={(e) => setTrackNote(e.target.value)}
                  placeholder={t('mis. Pesanan tiba di Provinsi Riau', 'e.g. The parcel has arrived in Riau Province')}
                />
                <button type="submit" className="btn btn-line btn-sm" disabled={busy || trackNote.trim().length < 3}>
                  <Icon name="plus" size={14} /> {t('Tambah', 'Add')}
                </button>
              </div>
              <p className="admin-field-hint">
                {t(
                  'Tampil berurutan di bawah "Dikirim" pada halaman pesanan customer, dan customer mendapat notifikasi. Bisa ditambah berkali-kali sampai pesanan diterima.',
                  'Shown in order under "Shipped" on the customer order page, and the customer gets a notification. Add as many as needed until the order is delivered.',
                )}
              </p>
            </form>
          )}

          <div className={styles.actionGroup}>
            {order.status === 'paid' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'note', status: 'processing' })}>
                <Icon name="gear" size={14} /> {t('Mulai proses', 'Start processing')}
              </button>
            )}
            {order.status === 'processing' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'ship' })}>
                <Icon name="truck" size={14} /> {t('Tandai dikirim…', 'Mark as shipped…')}
              </button>
            )}
            {order.status === 'shipped' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'note', status: 'delivered' })}>
                <Icon name="package" size={14} /> {t('Tandai diterima', 'Mark as delivered')}
              </button>
            )}
            {order.status === 'delivered' && (
              <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => openModal({ type: 'note', status: 'completed' })}>
                <Icon name="checkCircle" size={14} /> {t('Selesaikan order', 'Complete order')}
              </button>
            )}
            {canEditDue && (
              <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => openModal({ type: 'due' })}>
                {t('Perpanjang batas bayar…', 'Extend payment deadline…')}
              </button>
            )}
            {canCancel && (
              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => openModal({ type: 'cancel' })}>
                {t('Batalkan order…', 'Cancel order…')}
              </button>
            )}
          </div>
          {order.status === 'completed' && (
            <p className="admin-field-hint" style={{ marginTop: 12 }}>
              {t('Order selesai', 'Order completed')} {order.completedAt ? formatDateTime(order.completedAt, lang) : ''}.
            </p>
          )}
        </AdminCard>
      </div>

      <div style={{ marginTop: 20 }}>
        <AdminCard title={t('Riwayat status', 'Status history')}>
          {order.timeline.length === 0 ? (
            <p className="admin-field-hint">{t('Belum ada riwayat.', 'No history yet.')}</p>
          ) : (
            <div className="admin-table-wrap">
              <table className={styles.timeline}>
                <thead>
                  <tr>
                    <th>{t('Waktu', 'Time')}</th>
                    <th>Status</th>
                    <th>{t('Oleh', 'By')}</th>
                    <th>{t('Catatan', 'Note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...order.timeline].reverse().map((entry, index) => (
                    <tr key={entry.id ?? index}>
                      <td className="mono">{formatDateTime(entry.at, lang)}</td>
                      <td>
                        {entry.fromStatus ? `${orderLabel(entry.fromStatus)[lang]} → ` : ''}
                        <strong>{orderLabel(entry.status)[lang]}</strong>
                      </td>
                      <td>{entry.actor?.name || (entry.actorType ? `${entry.actorType}` : t('Sistem', 'System'))}</td>
                      <td>{entry.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>
      </div>

      {(order.canAttach || (order.attachments || []).length > 0) && (
        <div style={{ marginTop: 20 }}>
          <AdminCard
            title={t('Lampiran untuk customer', 'Attachments for the customer')}
            desc={t('Faktur pajak, surat jalan, atau dokumen lain. Berkas privat: hanya admin dan customer pemilik order yang bisa membukanya.', 'Tax invoice, delivery note, or other documents. Private files: only admins and the order owner can open them.')}
          >
            {(order.attachments || []).length === 0 ? (
              <p className="admin-field-hint">{t('Belum ada lampiran.', 'No attachments yet.')}</p>
            ) : (
              <ul className={styles.fileList}>
                {(order.attachments || []).map((file) => (
                  <li key={file.id} className={styles.fileRow}>
                    <span className={styles.fileIcon}>
                      <Icon name="orders" size={18} />
                    </span>
                    <span className={styles.fileBody}>
                      <FileLink file={file.file ? { url: file.file.url, name: file.file.originalName, mime: file.file.mime } : null} className="link">
                        {file.label || file.file?.originalName}
                      </FileLink>
                      <small className="admin-cell-sub">
                        {file.file?.originalName}
                        {file.file ? ` · ${Math.max(1, Math.round(file.file.size / 1024))} KB` : ''} · {formatDateTime(file.at, lang)}
                        {file.actor ? ` · ${file.actor.name}` : ''}
                      </small>
                    </span>
                    {order.canAttach && (
                      <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => void removeAttachment(file)}>
                        {t('Hapus', 'Delete')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {order.canAttach && (
              <form className={styles.attachForm} onSubmit={submitAttachment}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setAttachFile(e.target.files?.[0] || null)} />
                <input value={attachLabel} maxLength={120} onChange={(e) => setAttachLabel(e.target.value)} placeholder={t('Keterangan, mis. Faktur Pajak 010.000-26.00000001', 'Label, e.g. Tax Invoice 010.000-26.00000001')} />
                <button type="submit" className="btn btn-solid btn-sm" disabled={busy || !attachFile}>
                  <Icon name="plus" size={14} /> {t('Unggah lampiran', 'Upload attachment')}
                </button>
              </form>
            )}
          </AdminCard>
        </div>
      )}

      {modal?.type === 'cancel' && (
        <AdminModal title={t('Batalkan order', 'Cancel order')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitCancel}>
            <p className="admin-field-hint">
              {t(
                'Stok yang direservasi akan dikembalikan dan customer diberi tahu lewat email. Tindakan ini tidak dapat dibatalkan.',
                'Reserved stock is released and the customer is notified by email. This cannot be undone.',
              )}
            </p>
            <label>
              <span className="field-label">{t('Alasan pembatalan', 'Cancellation reason')} *</span>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Kembali', 'Back')}
              </button>
              <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                {busy ? t('Memproses...', 'Processing...') : t('Ya, batalkan order', 'Yes, cancel order')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'ship' && (
        <AdminModal title={t('Tandai dikirim', 'Mark as shipped')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={(e) => void submitShip(e)}>
            <label>
              <span className="field-label">{t('Kurir / ekspedisi', 'Courier')} *</span>
              <input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder={t('Contoh: JNE Trucking', 'e.g. JNE Trucking')} required />
            </label>
            <label>
              <span className="field-label">{t('Nomor resi', 'Tracking number')} *</span>
              <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="JNE-000123" required />
            </label>
            <label>
              <span className="field-label">{t('Catatan (opsional)', 'Note (optional)')}</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <label>
              <span className="field-label">{t('Lampiran untuk customer (opsional)', 'Attachments for the customer (optional)')}</span>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setShipFiles(Array.from(e.target.files || []))}
              />
              <small className="admin-field-hint">
                {t('Faktur pajak, surat jalan, atau dokumen lain (dokumen PDF atau gambar JPG/PNG/WebP, maks. 10 MB per berkas). Customer dapat mengunduhnya dari detail pesanan dan mendapat notifikasi.', 'Tax invoice, delivery note, or other documents (PDF documents or JPG/PNG/WebP images, max. 10 MB each). The customer can download them from the order details and gets a notification.')}
              </small>
              {shipFiles.length > 0 && (
                <small className="admin-field-hint">
                  {shipFiles.map((f) => f.name).join(', ')}
                </small>
              )}
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : t('Simpan & tandai dikirim', 'Save & mark shipped')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'note' && (
        <AdminModal title={`${t('Ubah status', 'Change status')}: ${orderLabel(modal.status)[lang]}`} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitNote}>
            <p className="admin-field-hint">
              {modal.status === 'processing' && t('Order dibayar akan masuk tahap diproses/dikemas.', 'The paid order moves to processing/packing.')}
              {modal.status === 'delivered' && t('Tandai bahwa kiriman sudah diterima customer.', 'Mark that the shipment has been received by the customer.')}
              {modal.status === 'completed' && t('Order ditutup sebagai selesai.', 'The order is closed as completed.')}
            </p>
            <label>
              <span className="field-label">{t('Catatan (opsional)', 'Note (optional)')}</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : t('Ubah status', 'Change status')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'due' && (
        <AdminModal title={t('Perpanjang batas waktu pembayaran', 'Extend payment deadline')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitDue}>
            <p className="admin-field-hint">
              {t('Batas saat ini', 'Current deadline')}: <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
            </p>
            <div className="admin-form-row">
              <label className="cms-check">
                <input type="radio" name="dueMode" checked={dueMode === 'hours'} onChange={() => setDueMode('hours')} />
                <span>{t('Tambah jam', 'Add hours')}</span>
              </label>
              <label className="cms-check">
                <input type="radio" name="dueMode" checked={dueMode === 'date'} onChange={() => setDueMode('date')} />
                <span>{t('Tentukan tanggal', 'Set a date')}</span>
              </label>
            </div>
            {dueMode === 'hours' ? (
              <label>
                <span className="field-label">{t('Perpanjang selama', 'Extend by')}</span>
                <Select value={extendHours} onChange={(e) => setExtendHours(e.target.value)}>
                  {EXTEND_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {h} {t('jam', 'hours')}
                      {h >= 24 ? ` (${h / 24} ${t('hari', 'days')})` : ''}
                    </option>
                  ))}
                </Select>
                <small className="admin-field-hint">
                  {t('Dihitung dari batas saat ini (atau dari sekarang bila sudah lewat).', 'Counted from the current deadline (or from now if it has passed).')}
                </small>
              </label>
            ) : (
              <label>
                <span className="field-label">{t('Batas bayar baru', 'New deadline')}</span>
                <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
              </label>
            )}
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                {busy ? t('Menyimpan...', 'Saving...') : t('Simpan batas waktu', 'Save deadline')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

      {modal?.type === 'reject' && (
        <AdminModal title={t('Tolak bukti pembayaran', 'Reject payment proof')} onClose={() => setModal(null)} small>
          <form className="admin-form" onSubmit={submitReject}>
            <p className="admin-field-hint">
              {t('Pembayaran', 'Payment')} #{modal.payment.id} · {formatIDR(modal.payment.amount)} · {paymentMethodSummary(modal.payment, lang)}.{' '}
              {t('Order kembali ke "Menunggu Pembayaran" dan customer diminta mengunggah ulang.', 'The order returns to "Awaiting Payment" and the customer is asked to upload again.')}
            </p>
            <label>
              <span className="field-label">{t('Alasan penolakan', 'Rejection reason')} *</span>
              <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </label>
            {actionError && <p className="admin-form-error">{actionError}</p>}
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setModal(null)}>
                {t('Batal', 'Cancel')}
              </button>
              <button type="submit" className="btn btn-danger btn-sm" disabled={busy}>
                {busy ? t('Memproses...', 'Processing...') : t('Tolak bukti', 'Reject proof')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
