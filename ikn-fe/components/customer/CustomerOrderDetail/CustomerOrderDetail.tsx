'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import EmptyState from '@/components/EmptyState';
import OrderTracking from '@/components/OrderTracking';
import PaymentProof from '@/components/PaymentProof';
import StatusBadge from '@/components/StatusBadge';
import SessionLoader from '@/components/SessionLoader';
import { useAuth } from '@/components/AuthProvider';
import { useTransactions } from '@/components/TransactionProvider';
import { useLang } from '@/components/LanguageProvider';
import { orderStatus, paymentStatus } from '@/lib/commerce';
import { errorMessage } from '@/lib/api';
import { formatDate, formatIDR } from '@/lib/format';
import styles from './CustomerOrderDetail.module.css';

export default function CustomerOrderDetail({ number }: { number: string }) {
  const { customer } = useAuth();
  const { ready, getOrder, uploadProof, confirmReceived, submitReview, cancelOrder } = useTransactions();
  const { lang } = useLang();
  const order = getOrder(number);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!customer) return null;
  if (!ready) {
    return <SessionLoader message={lang === 'en' ? 'Loading order…' : 'Memuat pesanan…'} />;
  }
  if (!order) {
    return (
      <EmptyState
        icon="close"
        title={lang === 'en' ? 'Order not found' : 'Pesanan tidak ditemukan'}
        body={
          lang === 'en'
            ? 'Order is unavailable or does not belong to your account.'
            : 'Pesanan tidak tersedia atau bukan milik akun Anda.'
        }
        action={{
          href: '/dashboard/pesanan',
          label: lang === 'en' ? 'Back to orders' : 'Kembali ke pesanan',
        }}
      />
    );
  }

  const statusLabel = orderStatus[order.status]?.[lang] || orderStatus[order.status]?.id || order.status;
  const paymentLabel = paymentStatus[order.payment]?.[lang] || paymentStatus[order.payment]?.id || order.payment;
  const canConfirm = order.status === 'shipped';
  const canReview = ['delivered', 'completed'].includes(order.status) && !order.reviewed;
  const canCancel = order.status === 'awaiting_payment' && ['unpaid', 'rejected'].includes(order.payment);

  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function onSubmitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void run(() =>
      submitReview(order!.number, Number(form.get('rating') || 5), String(form.get('review') || '')),
    );
  }

  return (
    <div>
      <Link href="/dashboard/pesanan" className="link acct-back-link">
        <Icon name="chevronLeft" size={16} /> {lang === 'en' ? 'Back to list' : 'Kembali ke daftar'}
      </Link>

      <div className="acct-detail-head">
        <div>
          <span className="acct-order-no">{order.number}</span>
          <span className="acct-order-date">
            {lang === 'en' ? 'Created on' : 'Dibuat'} {formatDate(order.date)}
          </span>
        </div>
        <div className="acct-order-badges">
          <StatusBadge label={statusLabel} tone={orderStatus[order.status]?.tone} />
          <StatusBadge label={paymentLabel} tone={paymentStatus[order.payment]?.tone} />
        </div>
      </div>

      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <div className="acct-detail-grid">
        <div className="acct-detail-main">
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{lang === 'en' ? 'Order Items' : 'Item pesanan'}</h2>
            <div className={styles.cardBody}>
              {order.items.map((item) => (
                <div key={item.slug} className="co-item">
                  <span className="co-item-name">
                    {item.name} <small>({item.code}) ×{item.qty} {item.unit}</small>
                  </span>
                  <span>{formatIDR(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="summary-row order-summary-first">
                <span>Subtotal</span>
                <span>{formatIDR(order.subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>
                  {lang === 'en' ? 'Shipping' : 'Ongkir'} · {order.shippingMethod}
                </span>
                <span>{formatIDR(order.shipping)}</span>
              </div>
              <div className="summary-row">
                <span>{lang === 'en' ? 'Admin fee' : 'Biaya admin'}</span>
                <span>{formatIDR(order.adminFee)}</span>
              </div>
              <div className="summary-row summary-total">
                <span>Total</span>
                <span>{formatIDR(order.total)}</span>
              </div>
            </div>
          </section>

          <section id="tracking" className={styles.card}>
            <h2 className={styles.cardTitle}>{lang === 'en' ? 'Track Order' : 'Lacak pesanan'}</h2>
            <div className={styles.cardBody}>
              <OrderTracking order={order} />
              {order.trackingNo && (
                <p className="acct-track-no">
                  {lang === 'en' ? 'Tracking No.:' : 'No. resi:'} <strong>{order.trackingNo}</strong>
                </p>
              )}
              {canConfirm && (
                <button
                  type="button"
                  className="btn btn-solid btn-sm order-action"
                  disabled={busy}
                  onClick={() => void run(() => confirmReceived(order!.number))}
                >
                  {lang === 'en' ? 'Confirm item received' : 'Konfirmasi barang diterima'} <Icon name="check" />
                </button>
              )}
              {['delivered', 'completed'].includes(order.status) && (
                <p className="proof-done order-action">
                  <Icon name="check" size={18} />{' '}
                  {lang === 'en' ? 'Delivery confirmed.' : 'Penerimaan barang sudah dikonfirmasi.'}
                </p>
              )}
            </div>
          </section>

          {order.payment === 'paid' && (
            <section className="invoice" aria-labelledby="invoice-title">
              <div className="invoice-top">
                <div>
                  <span className="invoice-brand">PT IKN</span>
                  <h2 id="invoice-title" className="h3">Invoice</h2>
                </div>
                <div>
                  <span className="acct-order-no">INV-{order.number}</span>
                  <span className="acct-order-date">{formatDate(order.date)}</span>
                </div>
              </div>
              <p>
                <strong>{lang === 'en' ? 'Billed to:' : 'Ditagihkan kepada:'}</strong><br />
                {order.customer.name}<br />
                PIC: {order.customer.pic}
              </p>
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>{lang === 'en' ? 'Product' : 'Produk'}</th>
                    <th>{lang === 'en' ? 'Qty' : 'Qty'}</th>
                    <th className="num">{lang === 'en' ? 'Amount' : 'Jumlah'}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.slug}>
                      <td>{item.name}</td>
                      <td>{item.qty} {item.unit}</td>
                      <td className="num">{formatIDR(item.price * item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2}>Subtotal</td>
                    <td className="num">{formatIDR(order.subtotal)}</td>
                  </tr>
                  <tr>
                    <td colSpan={2}>{lang === 'en' ? 'Shipping + Admin fee' : 'Ongkir + biaya admin'}</td>
                    <td className="num">{formatIDR(order.shipping + order.adminFee)}</td>
                  </tr>
                  <tr>
                    <th colSpan={2}>Total</th>
                    <th className="num">{formatIDR(order.total)}</th>
                  </tr>
                </tfoot>
              </table>
              <button
                type="button"
                className="btn btn-line btn-sm no-print"
                onClick={() => window.print()}
              >
                {lang === 'en' ? 'Print / Save PDF' : 'Cetak / simpan PDF'} <Icon name="arrowDown" />
              </button>
            </section>
          )}

          {(canReview || order.reviewed) && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{lang === 'en' ? 'Product Review' : 'Ulasan produk'}</h2>
              <div className={styles.cardBody}>
                {order.reviewed ? (
                  <p className="proof-done">
                    <Icon name="check" size={18} />{' '}
                    {lang === 'en'
                      ? 'Thank you! Your review for this order has been submitted.'
                      : 'Terima kasih, ulasan untuk pesanan ini sudah dikirim.'}
                  </p>
                ) : (
                  <form className="form review-form" onSubmit={onSubmitReview}>
                    <label>
                      <span className="label">Rating</span>
                      <select name="rating" className="cat-sort" defaultValue="5">
                        <option value="5">{lang === 'en' ? '5 — Excellent' : '5 — Sangat baik'}</option>
                        <option value="4">{lang === 'en' ? '4 — Good' : '4 — Baik'}</option>
                        <option value="3">{lang === 'en' ? '3 — Average' : '3 — Cukup'}</option>
                        <option value="2">{lang === 'en' ? '2 — Poor' : '2 — Kurang'}</option>
                        <option value="1">{lang === 'en' ? '1 — Bad' : '1 — Buruk'}</option>
                      </select>
                    </label>
                    <label>
                      <span className="label">{lang === 'en' ? 'Review' : 'Ulasan'}</span>
                      <textarea
                        name="review"
                        rows={4}
                        required
                        placeholder={
                          lang === 'en'
                            ? 'Share your experience using PT IKN products.'
                            : 'Bagikan pengalaman Anda menggunakan produk PT IKN.'
                        }
                      />
                    </label>
                    <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                      {lang === 'en' ? 'Submit review' : 'Kirim ulasan'} <Icon name="arrow" />
                    </button>
                  </form>
                )}
              </div>
            </section>
          )}
        </div>

        <aside className="acct-detail-side">
          <section id="payment" className={styles.card}>
            <h2 className={styles.cardTitle}>{lang === 'en' ? 'Payment' : 'Pembayaran'}</h2>
            <div className={styles.cardBody}>
              {order.bankInfo && (
                <div className="co-bank payment-bank">
                  <span className="co-bank-name">{order.bankInfo.bank}</span>
                  <span className="co-bank-no">{order.bankInfo.number}</span>
                  <span className="co-bank-holder">a.n. {order.bankInfo.holder}</span>
                </div>
              )}
              {order.payment === 'paid' ? (
                <p className="proof-done">
                  <Icon name="check" size={18} />{' '}
                  {lang === 'en' ? 'Payment verified by admin.' : 'Pembayaran telah diverifikasi admin.'}
                </p>
              ) : (
                <PaymentProof order={order} onUpload={(file) => uploadProof(order.number, file)} />
              )}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{lang === 'en' ? 'Shipping Address' : 'Alamat pengiriman'}</h2>
            <div className={styles.cardBody}>
              <p className="acct-addr">
                <strong>{order.address.label}</strong><br />
                {order.address.recipient}<br />
                {order.address.phone}<br />
                {order.address.line}
              </p>
            </div>
          </section>

          {canCancel && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{lang === 'en' ? 'Cancel Order' : 'Batalkan pesanan'}</h2>
              <div className={styles.cardBody}>
                <p className="pd-quote-note">
                  {lang === 'en' ? 'Unpaid orders can be cancelled.' : 'Pesanan yang belum dibayar dapat dibatalkan.'}
                </p>
                <button
                  type="button"
                  className="btn btn-line btn-sm btn-block order-action"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(lang === 'en' ? 'Cancel this order?' : 'Batalkan pesanan ini?')) {
                      void run(() => cancelOrder(order!.number));
                    }
                  }}
                >
                  {lang === 'en' ? 'Cancel order' : 'Batalkan pesanan'} <Icon name="close" />
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
