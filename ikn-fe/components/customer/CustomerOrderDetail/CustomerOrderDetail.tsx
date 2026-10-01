'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import EmptyState from '@/components/EmptyState';
import OrderTracking from '@/components/OrderTracking';
import PaymentProof from '@/components/PaymentProof';
import PaymentInstructions from '@/components/PaymentInstructions';
import StatusBadge from '@/components/StatusBadge';
import StarInput from '@/components/StarInput';
import StarRating from '@/components/StarRating';
import SessionLoader from '@/components/SessionLoader';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, apiUpload, ApiError, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { activePayment, canCancel, canChangePaymentMethod, canComplete, canConfirmReceived, canReview, orderLabel, paymentLabel, shipmentMetricsText } from '@/lib/commerce';
import { formatAddressLines } from '@/components/customer/CustomerAddresses';
import { formatDate, formatDateTime, formatIDR } from '@/lib/format';
import { openChat, shopPaths } from '@/lib/shop';
import type { CommerceConfig, Order, Payment, ReviewInput } from '@/lib/types';
import styles from './CustomerOrderDetail.module.css';
import { confirmDialog } from '@/components/ConfirmDialog';
import OrderProgress, { orderNextStep } from '@/components/customer/OrderProgress';

const paths = shopPaths(true);
const RATING_LABELS_ID: [string, string, string, string, string] = ['Buruk', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];
const RATING_LABELS_EN: [string, string, string, string, string] = ['Bad', 'Poor', 'Average', 'Good', 'Excellent'];

// Detail pesanan customer: GET /customer/orders/{number}. Semua aksi memanggil API lalu memuat ulang
// order sehingga status dan flag (canX) selalu mengikuti state machine server.
export default function CustomerOrderDetail({ number }: { number: string }) {
  const { customer } = useAuth();
  const { lang } = useLang();
  const params = useSearchParams();
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
  const [reviewError, setReviewError] = useState('');
  const scrolled = useRef(false);

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

  const customerId = customer?.id;
  useEffect(() => {
    if (!customerId) return;
    void load();
    api<CommerceConfig>('/commerce/config').then(setConfig).catch(() => setConfig(null));
  }, [customerId, load]);

  // Tautan "Bayar sekarang" / "Beri ulasan" membawa #payment / #review. Isi halaman baru ada setelah order
  // dimuat, jadi gulir ke bagian itu sekali setelah data tampil.
  useEffect(() => {
    if (!order || scrolled.current) return;
    scrolled.current = true;
    const hash = window.location.hash.replace('#', '');
    if (!hash) return;
    window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [order]);

  // rethrow = true: pemanggil (mis. form unggah bukti) ikut tahu bila gagal, agar berkas pilihannya tidak dikosongkan.
  async function run(action: () => Promise<unknown>, okMessage?: string, rethrow = false) {
    if (busy) return;
    setBusy(true);
    setActionError('');
    setActionOk('');
    try {
      await action();
      setPayments(null); // riwayat pembayaran dimuat ulang saat dibuka lagi
      await load();
      if (okMessage) setActionOk(okMessage);
    } catch (err) {
      setActionError(errorMessage(err));
      if (rethrow) throw err;
    } finally {
      setBusy(false);
    }
  }

  const path = (suffix: string) => `/customer/orders/${encodeURIComponent(number)}${suffix}`;

  function loadPayments() {
    setShowPayments((v) => !v);
  }

  // Riwayat pembayaran dimuat saat dibuka, dan dimuat ulang setelah aksi (run() mengosongkan cache).
  useEffect(() => {
    if (!showPayments || payments !== null) return;
    let active = true;
    api<Payment[]>(`/customer/orders/${encodeURIComponent(number)}/payments`)
      .then((list) => active && setPayments(list))
      .catch((err) => active && setActionError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [showPayments, payments, number]);

  // Ulasan: bintang wajib, teks opsional. Hanya produk yang diberi bintang yang dikirim, sehingga customer
  // boleh mengulas sebagian produk dulu.
  async function submitReviews(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!order || busy) return;
    const reviews: ReviewInput[] = order.items
      .filter((item) => item.reviewed !== true && (ratings[item.productSlug] || 0) > 0)
      .map((item) => ({ productSlug: item.productSlug, rating: ratings[item.productSlug] ?? 0, body: (bodies[item.productSlug] || '').trim() || null }));
    if (reviews.length === 0) {
      setReviewError(t('Pilih jumlah bintang untuk minimal satu produk.', 'Choose a star rating for at least one product.'));
      return;
    }
    setBusy(true);
    setReviewError('');
    setActionOk('');
    try {
      await api(path('/reviews'), { method: 'POST', body: { reviews } });
      setRatings({});
      setBodies({});
      await load();
      setActionOk(t('Terima kasih, ulasan Anda sudah dikirim.', 'Thank you, your review has been submitted.'));
    } catch (err) {
      setReviewError(errorMessage(err));
    } finally {
      setBusy(false);
    }
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
  const reviewed = order.items.filter((item) => item.reviewed === true && item.review);
  const showInvoice = !!order.invoiceNumber || !!order.paidAt;
  const paymentMethods = config?.paymentMethods || [];
  const selectedMethod = paymentMethods.find((m) => m.code === newMethod) || null;
  const justPlaced = params.get('placed') === '1' && order.status === 'pending_payment';
  const ratingLabels = lang === 'en' ? RATING_LABELS_EN : RATING_LABELS_ID;
  const showReviews = order.status === 'completed' && (reviewable.length > 0 || reviewed.length > 0);
  const next = orderNextStep(order, lang);
  // Jump link to the section where the customer acts next (payment, tracking actions, review form).
  const nextAction =
    order.status === 'pending_payment' && order.canUploadProof
      ? { href: '#payment', label: t('Bayar sekarang', 'Pay now') }
      : canConfirmReceived(order) || canComplete(order)
        ? { href: '#tracking', label: canConfirmReceived(order) ? t('Konfirmasi diterima', 'Confirm receipt') : t('Selesaikan pesanan', 'Complete order') }
        : showReviews && reviewable.length > 0 && canReview(order)
          ? { href: '#review', label: t('Beri ulasan', 'Write a review') }
          : null;

  return (
    <div className={styles.page}>
      <Link href="/dashboard/pesanan" className={`${styles.back} no-print`}>
        <Icon name="chevronLeft" size={16} /> {t('Pesanan saya', 'My orders')}
      </Link>

      <header className={`${styles.head} no-print`}>
        <div>
          <span className={styles.headLabel}>{t('Nomor pesanan', 'Order number')}</span>
          <h1>{order.number}</h1>
          <p>
            {t('Dibuat', 'Placed')} {formatDateTime(order.date, lang)}
            {order.invoiceNumber ? ` · Invoice ${order.invoiceNumber}` : ''}
          </p>
        </div>
        <div className={styles.headSide}>
          <div className={styles.badges}>
            <StatusBadge label={st[lang]} tone={st.tone} />
            <StatusBadge label={pay[lang]} tone={pay.tone} />
          </div>
          <button type="button" className={styles.chatBtn} onClick={() => openChat({ type: 'order', number: order.number, label: order.number })}>
            <Icon name="chat" size={16} /> {t('Tanya penjual', 'Ask seller')}
          </button>
        </div>
      </header>

      {justPlaced && (
        <div className={`${styles.placed} no-print`} role="status">
          <span className={styles.placedIcon}>
            <Icon name="check" size={20} />
          </span>
          <div>
            <strong>{t('Pesanan berhasil dibuat', 'Your order has been placed')}</strong>
            <p>
              {t('Selesaikan pembayaran sebelum', 'Complete the payment before')} <b>{formatDateTime(order.paymentDueAt, lang)}</b>
              {t(', lalu unggah bukti transfer di bagian Pembayaran.', ', then upload the transfer proof in the Payment section.')}
            </p>
          </div>
        </div>
      )}

      {!justPlaced && (
        <section className={`${styles.nextCard} ${styles[`next_${next.tone}`]} no-print`} aria-label={t('Langkah berikutnya', 'Next step')}>
          <div className={styles.nextText}>
            <span className={styles.nextIcon}>
              <Icon name={next.icon} size={20} />
            </span>
            <div>
              <strong>{next.title}</strong>
              <p>{next.body}</p>
            </div>
            {nextAction && (
              <a href={nextAction.href} className={styles.primaryBtn}>
                {nextAction.label} <Icon name="arrowDown" size={16} />
              </a>
            )}
          </div>
          <OrderProgress status={order.status} lang={lang} />
        </section>
      )}

      {actionError && (
        <p className="form-error no-print" role="alert">
          {actionError}
        </p>
      )}
      {actionOk && (
        <p className={`${styles.ok} no-print`} role="status">
          <Icon name="check" size={18} /> {actionOk}
        </p>
      )}

      <div className={`acct-detail-grid ${styles.grid}`}>
        <div className="acct-detail-main">
          <section id="tracking" className={`${styles.card} no-print`}>
            <h2 className={styles.cardTitle}>{t('Lacak pesanan', 'Track order')}</h2>
            <div className={styles.cardBody}>
              {(order.courier || order.trackingNumber) && (
                <p className={styles.courier}>
                  <Icon name="truck" size={17} />
                  <span>
                    {order.courier && <strong>{order.courier}</strong>}
                    {order.trackingNumber && (
                      <>
                        {' '}
                        · {t('No. resi', 'Tracking no.')} <strong className="mono">{order.trackingNumber}</strong>
                      </>
                    )}
                  </span>
                </p>
              )}
              <OrderTracking order={order} />
              {order.cancelReason && (
                <p className={styles.muted}>
                  {t('Alasan pembatalan', 'Cancellation reason')}: {order.cancelReason}
                </p>
              )}
              {(canConfirmReceived(order) || canComplete(order)) && (
                <div className={styles.trackActions}>
                  {canConfirmReceived(order) && (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={busy}
                      onClick={async () => {
                        if (await confirmDialog(t('Konfirmasi bahwa pesanan sudah Anda terima?', 'Confirm that you have received this order?'))) {
                          void run(() => api(path('/confirm-received'), { method: 'POST' }), t('Pesanan ditandai diterima.', 'Order marked as received.'));
                        }
                      }}
                    >
                      <Icon name="check" size={17} /> {t('Pesanan sudah diterima', 'I have received the order')}
                    </button>
                  )}
                  {canComplete(order) && (
                    <button
                      type="button"
                      className={styles.primaryBtn}
                      disabled={busy}
                      onClick={() => void run(() => api(path('/complete'), { method: 'POST' }), t('Pesanan selesai. Bagikan ulasan Anda di bawah.', 'Order completed. Share your review below.'))}
                    >
                      <Icon name="checkCircle" size={17} /> {t('Selesaikan pesanan', 'Complete order')}
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              {t('Produk dipesan', 'Ordered products')} <small>{order.items.length}</small>
            </h2>
            <div className={styles.cardBody}>
              <ul className={styles.items}>
                {order.items.map((item) => (
                  <li key={item.productSlug} className={styles.item}>
                    <Link href={paths.product(item.productSlug)} className={styles.itemThumb} aria-hidden="true" tabIndex={-1}>
                      {item.image ? <Image src={item.image} alt="" width={64} height={64} /> : <Icon name="package" size={26} strokeWidth={1.4} />}
                    </Link>
                    <span className={styles.itemBody}>
                      <Link href={paths.product(item.productSlug)}>{tr(item.name, lang)}</Link>
                      <small>
                        {item.code} · {item.qty} {item.unit} × {formatIDR(item.unitPrice)}
                      </small>
                    </span>
                    <strong className={styles.itemTotal}>{formatIDR(item.lineTotal)}</strong>
                  </li>
                ))}
              </ul>

              <dl className={styles.summary}>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatIDR(order.subtotal)}</dd>
                </div>
                {order.discountTotal > 0 && (
                  <div>
                    <dt>
                      {t('Diskon', 'Discount')}
                      {order.voucherCode ? ` (${order.voucherCode})` : ''}
                    </dt>
                    <dd className={styles.minus}>−{formatIDR(order.discountTotal)}</dd>
                  </div>
                )}
                <div>
                  <dt>
                    {t('Ongkir', 'Shipping')}
                    {order.shippingMethod ? ` · ${tr(order.shippingMethod.label, lang)}` : ''}
                  </dt>
                  <dd>{formatIDR(order.shippingTotal)}</dd>
                </div>
                {(order.fees || []).map((fee) => (
                  <div key={fee.id}>
                    <dt>{tr(fee.name, lang)}</dt>
                    <dd>{formatIDR(fee.amount)}</dd>
                  </div>
                ))}
                {(order.fees || []).length === 0 && order.feeTotal > 0 && (
                  <div>
                    <dt>{t('Biaya', 'Fees')}</dt>
                    <dd>{formatIDR(order.feeTotal)}</dd>
                  </div>
                )}
                {order.taxTotal > 0 && (
                  <div className={styles.soft}>
                    <dt>{order.priceIncludesTax === false ? `PPN${order.taxRate != null ? ` ${order.taxRate}%` : ''}` : t('Termasuk PPN', 'Includes VAT')}</dt>
                    <dd>{formatIDR(order.taxTotal)}</dd>
                  </div>
                )}
                {order.uniqueCode > 0 && (
                  <div>
                    <dt>{t('Kode unik', 'Unique code')}</dt>
                    <dd>{formatIDR(order.uniqueCode)}</dd>
                  </div>
                )}
                <div className={styles.grand}>
                  <dt>Total</dt>
                  <dd>{formatIDR(order.grandTotal)}</dd>
                </div>
              </dl>
            </div>
          </section>

          {showReviews && (
            <section id="review" className={`${styles.card} no-print`}>
              <h2 className={styles.cardTitle}>{t('Ulasan produk', 'Product reviews')}</h2>
              <div className={styles.cardBody}>
                {canReview(order) && reviewable.length > 0 && (
                  <form className={styles.reviewForm} onSubmit={submitReviews}>
                    <p className={styles.muted}>
                      {t(
                        'Beri bintang untuk produk yang ingin Anda ulas. Tulisan ulasan boleh dikosongkan.',
                        'Give stars to the products you want to review. The written review is optional.',
                      )}
                    </p>
                    {reviewable.map((item) => (
                      <div key={item.productSlug} className={styles.reviewItem}>
                        <div className={styles.reviewProduct}>
                          <span className={styles.itemThumb}>
                            {item.image ? <Image src={item.image} alt="" width={48} height={48} /> : <Icon name="package" size={22} strokeWidth={1.4} />}
                          </span>
                          <strong>{tr(item.name, lang)}</strong>
                        </div>
                        <StarInput
                          name={`rating-${item.productSlug}`}
                          legend={`${t('Rating untuk', 'Rating for')} ${tr(item.name, lang)}`}
                          labels={ratingLabels}
                          value={ratings[item.productSlug] || 0}
                          onChange={(value) => {
                            setReviewError('');
                            setRatings((r) => ({ ...r, [item.productSlug]: value }));
                          }}
                          disabled={busy}
                        />
                        <label className={styles.reviewText}>
                          <span className="sr-only">
                            {t('Ulasan untuk', 'Review for')} {tr(item.name, lang)}
                          </span>
                          <textarea
                            rows={3}
                            maxLength={2000}
                            value={bodies[item.productSlug] || ''}
                            onChange={(e) => setBodies((b) => ({ ...b, [item.productSlug]: e.target.value }))}
                            placeholder={t('Ceritakan kualitas produk, pengemasan, dan pengirimannya (opsional).', 'Tell us about product quality, packaging, and delivery (optional).')}
                          />
                        </label>
                      </div>
                    ))}
                    {reviewError && (
                      <p className="form-error" role="alert">
                        {reviewError}
                      </p>
                    )}
                    <button type="submit" className={styles.primaryBtn} disabled={busy}>
                      <Icon name="star" size={17} /> {busy ? t('Mengirim…', 'Submitting…') : t('Kirim ulasan', 'Submit review')}
                    </button>
                  </form>
                )}

                {reviewed.length > 0 && (
                  <div className={styles.reviewed}>
                    <h3>{t('Ulasan Anda', 'Your reviews')}</h3>
                    {reviewed.map((item) => (
                      <div key={item.productSlug} className={styles.reviewedItem}>
                        <div className={styles.reviewedHead}>
                          <strong>{tr(item.name, lang)}</strong>
                          <StarRating value={item.review?.rating || 0} size={16} />
                        </div>
                        {item.review?.body && <p>{item.review.body}</p>}
                        {item.review?.date && <small>{formatDate(item.review.date, lang)}</small>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {showInvoice && (
            <section className={`${styles.card} no-print`}>
              <h2 className={styles.cardTitle}>Invoice</h2>
              <div className={styles.cardBody}>
                <div className={styles.invoiceRow}>
                  <span className={styles.invoiceMeta}>
                    <strong className="mono">{order.invoiceNumber || t('Terbit setelah pembayaran diverifikasi', 'Issued once the payment is verified')}</strong>
                    {order.paidAt && <small>{t('Dibayar', 'Paid')} {formatDateTime(order.paidAt, lang)}</small>}
                  </span>
                  <a href={`/print/invoice/${encodeURIComponent(order.number)}`} target="_blank" rel="noopener" className={styles.lineBtn}>
                    <Icon name="arrowDown" size={16} /> {t('Cetak / simpan PDF', 'Print / save PDF')}
                  </a>
                </div>
              </div>
            </section>
          )}

          {(order.attachments || []).length > 0 && (
            <section className={`${styles.card} no-print`}>
              <h2 className={styles.cardTitle}>
                {t('Dokumen dari penjual', 'Documents from the seller')} <small>{order.attachments?.length}</small>
              </h2>
              <div className={styles.cardBody}>
                <ul className={styles.files}>
                  {(order.attachments || []).map((file) => (
                    <li key={file.id}>
                      <a href={file.file?.url} target="_blank" rel="noopener" className={styles.fileLink}>
                        <span className={styles.fileIcon}>
                          <Icon name="orders" size={18} />
                        </span>
                        <span className={styles.fileBody}>
                          <strong>{file.label}</strong>
                          <small>
                            {file.file?.originalName}
                            {file.file ? ` · ${Math.max(1, Math.round(file.file.size / 1024))} KB` : ''} · {formatDateTime(file.at, lang)}
                          </small>
                        </span>
                        <Icon name="arrowDown" size={16} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>

        <aside className="acct-detail-side no-print">
          <section id="payment" className={styles.card}>
            <h2 className={styles.cardTitle}>{t('Pembayaran', 'Payment')}</h2>
            <div className={styles.cardBody}>
              {order.paymentStatus === 'paid' || order.paidAt ? (
                <p className={styles.ok}>
                  <Icon name="check" size={18} /> {t('Pembayaran telah diverifikasi.', 'Payment verified.')}
                  {order.paidAt && <> {formatDateTime(order.paidAt, lang)}</>}
                </p>
              ) : (
                <>
                  {(order.status === 'pending_payment' || order.status === 'payment_review') && <PaymentInstructions order={order} config={config} />}
                  <PaymentProof
                    order={order}
                    payment={payment}
                    onUpload={(file) => {
                      const fd = new FormData();
                      fd.append('file', file);
                      if (payment?.id && payment.status === 'pending') fd.append('paymentId', String(payment.id));
                      return run(() => apiUpload(path('/proof'), fd), t('Bukti pembayaran terkirim.', 'Payment proof submitted.'), true);
                    }}
                  />
                  {canChangePaymentMethod(order) && paymentMethods.length > 1 && (
                    <div className="pay-change">
                      {!changeMethod ? (
                        <button
                          type="button"
                          className={styles.textBtn}
                          onClick={() => {
                            setChangeMethod(true);
                            setNewMethod(paymentMethods.find((m) => m.code !== payment?.method)?.code || '');
                          }}
                        >
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
                              {(config?.bankAccounts || []).map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.bankName} · {b.accountNumber}
                                </option>
                              ))}
                            </select>
                          )}
                          <div className={styles.inlineActions}>
                            <button
                              type="button"
                              className={styles.primaryBtn}
                              disabled={busy || !newMethod}
                              onClick={() =>
                                void run(
                                  () => api(path('/payments'), { method: 'POST', body: { paymentMethodCode: newMethod, bankAccountId: newBank || undefined } }),
                                  t('Metode pembayaran diperbarui.', 'Payment method updated.'),
                                ).then(() => setChangeMethod(false))
                              }
                            >
                              {t('Simpan', 'Save')}
                            </button>
                            <button type="button" className={styles.textBtn} onClick={() => setChangeMethod(false)}>
                              {t('Batal', 'Cancel')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <button type="button" className={styles.textBtn} style={{ marginTop: 14 }} onClick={loadPayments} aria-expanded={showPayments}>
                {showPayments ? t('Sembunyikan riwayat pembayaran', 'Hide payment history') : t('Riwayat pembayaran', 'Payment history')}
              </button>
              {showPayments && (
                <ul className={`pay-history ${styles.payHistory}`}>
                  {(payments || order.payments || []).map((p) => {
                    const pl = paymentLabel(p.status);
                    return (
                      <li key={p.id}>
                        <div>
                          <strong>{tr(p.methodName, lang) || p.method}</strong> · {formatIDR(p.amount)}
                          {p.createdAt && <span className="acct-order-date">{formatDateTime(p.createdAt, lang)}</span>}
                          {p.rejectReason && (
                            <span className="acct-order-date">
                              {t('Alasan', 'Reason')}: {p.rejectReason}
                            </span>
                          )}
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
              <p className={styles.address}>
                <strong>{address.label}</strong>
                <br />
                {address.recipientName} · {address.phone}
                <br />
                {formatAddressLines({ ...address, id: 0, isDefault: false }).map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
                {address.note && <em>{address.note}</em>}
              </p>
              {order.shippingMethod && (
                <p className={styles.muted}>
                  {tr(order.shippingMethod.label, lang)}
                  {order.shippingMethod.eta ? ` · ${tr(order.shippingMethod.eta, lang)}` : ''}
                  {shipmentMetricsText(order.shippingMethod) ? ` · ${shipmentMetricsText(order.shippingMethod)}` : ''}
                </p>
              )}
              {order.note && (
                <p className={styles.muted}>
                  {t('Catatan', 'Note')}: {order.note}
                </p>
              )}
            </div>
          </section>

          {canCancel(order) && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>{t('Batalkan pesanan', 'Cancel order')}</h2>
              <div className={styles.cardBody}>
                <p className={styles.muted}>{t('Pesanan yang belum dibayar dapat dibatalkan; stok yang direservasi dikembalikan.', 'Unpaid orders can be cancelled; reserved stock is released.')}</p>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  disabled={busy}
                  onClick={async () => {
                    if (await confirmDialog(t('Batalkan pesanan ini?', 'Cancel this order?'))) {
                      void run(() => api(path('/cancel'), { method: 'POST' }), t('Pesanan dibatalkan.', 'Order cancelled.'));
                    }
                  }}
                >
                  <Icon name="close" size={16} /> {t('Batalkan pesanan', 'Cancel order')}
                </button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
