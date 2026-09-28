'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import EmptyState from '@/components/EmptyState';
import OrderTracking from '@/components/OrderTracking';
import PaymentProof from '@/components/PaymentProof';
import PaymentInstructions from '@/components/PaymentInstructions';
import StatusBadge from '@/components/StatusBadge';
import SessionLoader from '@/components/SessionLoader';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, apiUpload, ApiError, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { activePayment, canCancel, canChangePaymentMethod, canComplete, canConfirmReceived, canReview, orderLabel, paymentLabel } from '@/lib/commerce';
import { formatAddressLines } from '@/components/customer/CustomerAddresses';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import type { CommerceConfig, Order, Payment, ReviewInput } from '@/lib/types';
import styles from './CustomerOrderDetail.module.css';

// Detail pesanan customer: GET /customer/orders/{number}. Semua aksi memanggil API lalu memuat ulang
// order sehingga status dan flag (canX) selalu mengikuti state machine server.
export default function CustomerOrderDetail({ number }: { number: string }) {
  const { customer } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [order, setOrder] = useState<Order | null>(null);
  const [config, setConfig] = useState<CommerceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionOk, setActionOk] = useState('');
  const [busy, setBusy] = useState(false);

  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [showPayments, setShowPayments] = useState(false);
  const [changeMethod, setChangeMethod] = useState(false);
  const [newMethod, setNewMethod] = useState('');
  const [newBank, setNewBank] = useState<number | ''>('');

  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const data = await api<Order>(`/customer/orders/${encodeURIComponent(number)}`);
      setOrder(data);
      setLoadError('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true);
      else setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [number]);

  useEffect(() => {
    if (!customer) return;
    void load();
    api<CommerceConfig>('/commerce/config').then(setConfig).catch(() => setConfig(null));
  }, [customer, load]);

  async function run(action: () => Promise<unknown>, okMessage?: string) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      await action();
      await load();
      if (okMessage) setActionOk(okMessage);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const path = (suffix: string) => `/customer/orders/${encodeURIComponent(number)}${suffix}`;

  async function loadPayments() {
    setShowPayments((v) => !v);
    if (payments) return;
    try {
      setPayments(await api<Payment[]>(path('/payments')));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  function submitReviews(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order) return;
    const reviews: ReviewInput[] = order.items
      .filter((item) => item.reviewed !== true)
      .map((item) => ({ productSlug: item.productSlug, rating: ratings[item.productSlug] || 5, body: (bodies[item.productSlug] || '').trim() }))
      .filter((r) => r.body.length > 0);
    if (reviews.length === 0) {
      setActionError(t('Tulis ulasan minimal untuk satu produk.', 'Write a review for at least one product.'));
      return;
    }
    void run(() => api(path('/reviews'), { method: 'POST', body: reviews }), t('Terima kasih, ulasan Anda sudah dikirim.', 'Thank you, your review has been submitted.'));
  }

  if (!customer) return null;
  if (loading) return <SessionLoader message={t('Memuat pesanan…', 'Loading order…')} />;
  if (notFound || !order) {
    return (
      <EmptyState
        icon="close"
        title={t('Pesanan tidak ditemukan', 'Order not found')}
        body={loadError || t('Pesanan tidak tersedia atau bukan milik akun Anda.', 'Order is unavailable or does not belong to your account.')}
        action={{ href: '/dashboard/pesanan', label: t('Kembali ke pesanan', 'Back to orders') }}
      />
    );
  }

  const st = orderLabel(order.status);
  const pay = paymentLabel(order.paymentStatus);
  const payment = activePayment(order);
  const address = order.shippingAddress;
  const reviewable = order.items.filter((item) => item.reviewed !== true);
  const showInvoice = !!order.invoiceNumber || !!order.paidAt;
  const paymentMethods = config?.paymentMethods || [];
  const selectedMethod = paymentMethods.find((m) => m.code === newMethod) || null;

  return (
    <div>
      <Link href="/dashboard/pesanan" className="link acct-back-link no-print">
        <Icon name="chevronLeft" size={16} /> {t('Kembali ke daftar', 'Back to list')}
      </Link>

      <div className="acct-detail-head no-print">
        <div>
          <span className="acct-order-no">{order.number}</span>
          <span className="acct-order-date">{t('Dibuat', 'Created')} {formatDateTime(order.date, lang)}</span>
        </div>
        <div className="acct-order-badges">
          <StatusBadge label={st[lang]} tone={st.tone} />
          <StatusBadge label={pay[lang]} tone={pay.tone} />
        </div>
      </div>

      {actionError && <p className="form-error no-print" role="alert">{actionError}</p>}
      {actionOk && <p className="proof-done no-print" role="status"><Icon name="check" size={18} /> {actionOk}</p>}

      <div className="acct-detail-grid">
        <div className="acct-detail-main">
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('Item pesanan', 'Order items')}</h2>
            <div className={styles.cardBody}>
              {order.items.map((item) => (
                <div key={item.productSlug} className="co-item">
                  <span className="co-item-name">
                    <Link href={`/catalog/${item.productSlug}`}>{tr(item.name, lang)}</Link>{' '}
                    <small>({item.code}) {item.qty} {item.unit} × {formatIDR(item.unitPrice)}</small>
                  </span>
                  <span>{formatIDR(item.lineTotal)}</span>
                </div>
              ))}
              <div className="summary-row order-summary-first"><span>Subtotal</span><span>{formatIDR(order.subtotal)}</span></div>
              {order.discountTotal > 0 && (
                <div className="summary-row"><span>{t('Diskon', 'Discount')}{order.voucherCode ? ` (${order.voucherCode})` : ''}</span><span>−{formatIDR(order.discountTotal)}</span></div>
              )}
              <div className="summary-row">
                <span>{t('Ongkir', 'Shipping')}{order.shippingMethod ? ` · ${tr(order.shippingMethod.label, lang)}` : ''}</span>
                <span>{formatIDR(order.shippingTotal)}</span>
              </div>
              {order.feeTotal > 0 && <div className="summary-row"><span>{t('Biaya', 'Fees')}</span><span>{formatIDR(order.feeTotal)}</span></div>}
              {order.taxTotal > 0 && (
                <div className="summary-row summary-muted">
                  <span>{order.priceIncludesTax === false ? `PPN${order.taxRate != null ? ` ${order.taxRate}%` : ''}` : t('Termasuk PPN', 'Includes VAT')}</span>
                  <span>{formatIDR(order.taxTotal)}</span>
                </div>
              )}
              {order.uniqueCode > 0 && <div className="summary-row"><span>{t('Kode unik', 'Unique code')}</span><span>{formatIDR(order.uniqueCode)}</span></div>}
              <div className="summary-row summary-total"><span>Total</span><span>{formatIDR(order.grandTotal)}</span></div>
            </div>
          </section>

          <section id="tracking" className={`${styles.card} no-print`}>
            <h2 className={styles.cardTitle}>{t('Lacak pesanan', 'Track order')}</h2>
            <div className={styles.cardBody}>
              <OrderTracking order={order} />
              {order.cancelReason && <p className="qty-moq" style={{ marginTop: 10 }}>{t('Alasan pembatalan', 'Cancellation reason')}: {order.cancelReason}</p>}
              {(order.courier || order.trackingNumber) && (
                <p className="acct-track-no">
                  <Icon name="truck" size={16} /> {order.courier && <strong>{order.courier}</strong>}
                  {order.trackingNumber && <> · {t('No. resi', 'Tracking no.')}: <strong>{order.trackingNumber}</strong></>}
                </p>
              )}
              {canConfirmReceived(order) && (
                <button type="button" className="btn btn-solid btn-sm order-action" disabled={busy} onClick={() => void run(() => api(path('/confirm-received'), { method: 'POST' }))}>
                  {t('Konfirmasi barang diterima', 'Confirm goods received')} <Icon name="check" />
                </button>
              )}
              {canComplete(order) && (
                <button type="button" className="btn btn-line btn-sm order-action" disabled={busy} onClick={() => void run(() => api(path('/complete'), { method: 'POST' }))}>
                  {t('Selesaikan pesanan', 'Complete order')} <Icon name="checkCircle" />
                </button>
              )}
            </div>
          </section>

          {showInvoice && (
            <section className="invoice" aria-labelledby="invoice-title">
              <div className="invoice-top">
                <div>
                  <span className="invoice-brand">PT IKN</span>
                  <h2 id="invoice-title" className="h3">Invoice</h2>
                  <span className="acct-order-date">PT Industri Karet Nusantara</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="acct-order-no">{order.invoiceNumber || order.number}</span>
                  <span className="acct-order-date">{t('Order', 'Order')} {order.number} · {formatDate(order.date, lang)}</span>
                  {order.paidAt && <span className="acct-order-date">{t('Dibayar', 'Paid')} {formatDateTime(order.paidAt, lang)}</span>}
                </div>
              </div>
              <div className="invoice-parties">
                <p>
                  <strong>{t('Ditagihkan kepada', 'Billed to')}:</strong><br />
                  {order.customer.name}<br />
                  PIC: {order.customer.pic}<br />
                  {order.customer.email}
                  {order.customer.taxId && <><br />NPWP: {order.customer.taxId}</>}
                </p>
                <p>
                  <strong>{t('Dikirim ke', 'Ship to')}:</strong><br />
                  {address.recipientName} · {address.phone}<br />
                  {formatAddressLines({ ...address, id: 0, isDefault: false }).map((line) => <span key={line}>{line}<br /></span>)}
                </p>
              </div>
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>{t('Produk', 'Product')}</th>
                    <th>Qty</th>
                    <th className="num">{t('Harga', 'Price')}</th>
                    <th className="num">{t('Jumlah', 'Amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.productSlug}>
                      <td>{tr(item.name, lang)} <small>({item.code})</small></td>
                      <td>{item.qty} {item.unit}</td>
                      <td className="num">{formatIDR(item.unitPrice)}</td>
                      <td className="num">{formatIDR(item.lineTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={3}>Subtotal</td><td className="num">{formatIDR(order.subtotal)}</td></tr>
                  {order.discountTotal > 0 && <tr><td colSpan={3}>{t('Diskon', 'Discount')}</td><td className="num">−{formatIDR(order.discountTotal)}</td></tr>}
                  <tr><td colSpan={3}>{t('Ongkir', 'Shipping')}</td><td className="num">{formatIDR(order.shippingTotal)}</td></tr>
                  {order.feeTotal > 0 && <tr><td colSpan={3}>{t('Biaya', 'Fees')}</td><td className="num">{formatIDR(order.feeTotal)}</td></tr>}
                  {order.taxTotal > 0 && <tr><td colSpan={3}>{order.priceIncludesTax === false ? 'PPN' : t('PPN (termasuk)', 'VAT (included)')}</td><td className="num">{formatIDR(order.taxTotal)}</td></tr>}
                  {order.uniqueCode > 0 && <tr><td colSpan={3}>{t('Kode unik', 'Unique code')}</td><td className="num">{formatIDR(order.uniqueCode)}</td></tr>}
                  <tr><th colSpan={3}>Total</th><th className="num">{formatIDR(order.grandTotal)}</th></tr>
                </tfoot>
              </table>
              <button type="button" className="btn btn-line btn-sm no-print" onClick={() => window.print()}>
                {t('Cetak / simpan PDF', 'Print / save PDF')} <Icon name="arrowDown" />
              </button>
            </section>
          )}

          {canReview(order) && reviewable.length > 0 && (
            <section id="review" className={`${styles.card} no-print`}>
              <h2 className={styles.cardTitle}>{t('Ulasan produk', 'Product review')}</h2>
              <div className={styles.cardBody}>
                <form className="form review-form" onSubmit={submitReviews}>
                  {reviewable.map((item) => (
                    <fieldset key={item.productSlug} className="review-fieldset">
                      <legend>{tr(item.name, lang)}</legend>
                      <label>
                        <span className="label">Rating</span>
                        <select className="cat-sort" value={ratings[item.productSlug] || 5} onChange={(e) => setRatings((r) => ({ ...r, [item.productSlug]: Number(e.target.value) }))}>
                          <option value={5}>{t('5 — Sangat baik', '5 — Excellent')}</option>
                          <option value={4}>{t('4 — Baik', '4 — Good')}</option>
                          <option value={3}>{t('3 — Cukup', '3 — Average')}</option>
                          <option value={2}>{t('2 — Kurang', '2 — Poor')}</option>
                          <option value={1}>{t('1 — Buruk', '1 — Bad')}</option>
                        </select>
                      </label>
                      <label>
                        <span className="label">{t('Ulasan', 'Review')}</span>
                        <textarea rows={3} maxLength={2000} value={bodies[item.productSlug] || ''} onChange={(e) => setBodies((b) => ({ ...b, [item.productSlug]: e.target.value }))} placeholder={t('Bagikan pengalaman Anda menggunakan produk ini.', 'Share your experience with this product.')} />
                      </label>
                    </fieldset>
                  ))}
                  <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
                    {t('Kirim ulasan', 'Submit review')} <Icon name="arrow" />
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>

        <aside className="acct-detail-side no-print">
          <section id="payment" className={styles.card}>
            <h2 className={styles.cardTitle}>{t('Pembayaran', 'Payment')}</h2>
            <div className={styles.cardBody}>
              {order.paymentStatus === 'paid' || order.paidAt ? (
                <p className="proof-done">
                  <Icon name="check" size={18} /> {t('Pembayaran telah diverifikasi.', 'Payment verified.')}{order.paidAt && <> {formatDateTime(order.paidAt, lang)}</>}
                </p>
              ) : (
                <>
                  {(order.status === 'pending_payment' || order.status === 'payment_review') && (
                    <PaymentInstructions order={order} config={config} />
                  )}
                  <PaymentProof
                    order={order}
                    payment={payment}
                    onUpload={(file) => {
                      const fd = new FormData();
                      fd.append('file', file);
                      if (payment?.id && payment.status === 'pending') fd.append('paymentId', String(payment.id));
                      return run(() => apiUpload(path('/proof'), fd), t('Bukti pembayaran terkirim.', 'Payment proof submitted.'));
                    }}
                  />
                  {canChangePaymentMethod(order) && paymentMethods.length > 1 && (
                    <div className="pay-change">
                      {!changeMethod ? (
                        <button type="button" className="link" onClick={() => { setChangeMethod(true); setNewMethod(paymentMethods.find((m) => m.code !== payment?.method)?.code || ''); }}>
                          {t('Ganti metode pembayaran', 'Change payment method')}
                        </button>
                      ) : (
                        <div className="co-ship">
                          {paymentMethods.map((m) => (
                            <label key={m.code} className={`co-ship-opt ${newMethod === m.code ? 'is-active' : ''}`}>
                              <input type="radio" name="newMethod" value={m.code} checked={newMethod === m.code} onChange={() => setNewMethod(m.code)} />
                              <span className="co-ship-label">{tr(m.name, lang)}</span>
                            </label>
                          ))}
                          {selectedMethod?.type === 'manual_transfer' && (config?.bankAccounts || []).length > 0 && (
                            <select className="cat-sort" value={newBank} onChange={(e) => setNewBank(e.target.value ? Number(e.target.value) : '')}>
                              <option value="">{t('Pilih rekening tujuan', 'Choose bank account')}</option>
                              {(config?.bankAccounts || []).map((b) => <option key={b.id} value={b.id}>{b.bankName} · {b.accountNumber}</option>)}
                            </select>
                          )}
                          <div className="address-actions" style={{ borderTop: 0, paddingTop: 0, marginTop: 6 }}>
                            <button
                              type="button"
                              className="btn btn-solid btn-sm"
                              disabled={busy || !newMethod}
                              onClick={() => void run(
                                () => api(path('/payments'), { method: 'POST', body: { paymentMethodCode: newMethod, bankAccountId: newBank || undefined } }),
                                t('Metode pembayaran diperbarui.', 'Payment method updated.'),
                              ).then(() => setChangeMethod(false))}
                            >
                              {t('Simpan', 'Save')}
                            </button>
                            <button type="button" className="link" onClick={() => setChangeMethod(false)}>{t('Batal', 'Cancel')}</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <button type="button" className="link" style={{ marginTop: 14 }} onClick={loadPayments}>
                {showPayments ? t('Sembunyikan riwayat pembayaran', 'Hide payment history') : t('Riwayat pembayaran', 'Payment history')}
              </button>
              {showPayments && (
                <ul className="pay-history">
                  {(payments || order.payments || []).map((p) => {
                    const pl = paymentLabel(p.status);
                    return (
                      <li key={p.id}>
                        <div>
                          <strong>{tr(p.methodName, lang) || p.method}</strong> · {formatIDR(p.amount)}
                          {p.createdAt && <span className="acct-order-date">{formatDateTime(p.createdAt, lang)}</span>}
                          {p.rejectReason && <span className="acct-order-date">{t('Alasan', 'Reason')}: {p.rejectReason}</span>}
                        </div>
                        <StatusBadge label={pl[lang]} tone={pl.tone} small />
                      </li>
                    );
                  })}
                  {(payments || order.payments || []).length === 0 && <li className="form-note">{t('Belum ada percobaan pembayaran.', 'No payment attempts yet.')}</li>}
                </ul>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>{t('Alamat pengiriman', 'Shipping address')}</h2>
            <div className={styles.cardBody}>
              <p className="acct-addr">
                <strong>{address.label}</strong><br />
                {address.recipientName}<br />
                {address.phone}<br />
                {formatAddressLines({ ...address, id: 0, isDefault: false }).map((line) => <span key={line}>{line}<br /></span>)}
                {address.note && <em>{address.note}</em>}
              </p>
              {order.shippingMethod && (
                <p className="qty-moq">
                  {tr(order.shippingMethod.label, lang)}{order.shippingMethod.eta ? ` · ${tr(order.shippingMethod.eta, lang)}` : ''}
                </p>
              )}
              {order.note && <p className="qty-moq">{t('Catatan', 'Note')}: {order.note}</p>}
            </div>
          </section>

          {canCancel(order) && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{t('Batalkan pesanan', 'Cancel order')}</h2>
              <div className={styles.cardBody}>
                <p className="pd-quote-note">{t('Pesanan yang belum dibayar dapat dibatalkan; stok yang direservasi dikembalikan.', 'Unpaid orders can be cancelled; reserved stock is released.')}</p>
                <button
                  type="button"
                  className="btn btn-line btn-sm btn-block order-action"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t('Batalkan pesanan ini?', 'Cancel this order?'))) {
                      void run(() => api(path('/cancel'), { method: 'POST' }));
                    }
                  }}
                >
                  {t('Batalkan pesanan', 'Cancel order')} <Icon name="close" />
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
