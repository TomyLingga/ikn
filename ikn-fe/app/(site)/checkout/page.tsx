'use client';

// Checkout customer (hanya akun `active`): alamat → ongkir (POST /cart/quote dengan addressId)
// → metode bayar (GET /commerce/config) → voucher/catatan → ringkasan → POST /customer/orders
// dengan header Idempotency-Key (UUID sekali per sesi checkout).
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import AddressForm from '@/components/customer/AddressForm';
import AccountStatusBanner from '@/components/customer/AccountStatusBanner';
import { formatAddressLines } from '@/components/customer/CustomerAddresses';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { formatDate, formatIDR } from '@/lib/format';
import { openCartDrawer, useShopPaths } from '@/lib/shop';
import type { AssignedVoucher, CommerceConfig, CustomerAddress, InsufficientStockItem, Order, QuoteResult } from '@/lib/types';
import { shippingBreakdownText } from '@/lib/commerce';

type Step = 'address' | 'shipping' | 'payment' | 'review';
const STEPS: Step[] = ['address', 'shipping', 'payment', 'review'];

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const voucherReasons: Record<string, { id: string; en: string }> = {
  not_found: { id: 'Kode voucher tidak ditemukan.', en: 'Voucher code not found.' },
  inactive: { id: 'Voucher tidak aktif.', en: 'Voucher is inactive.' },
  expired: { id: 'Voucher sudah kedaluwarsa.', en: 'Voucher has expired.' },
  not_started: { id: 'Voucher belum berlaku.', en: 'Voucher is not valid yet.' },
  quota: { id: 'Kuota voucher sudah habis.', en: 'Voucher quota is exhausted.' },
  not_eligible: { id: 'Voucher ini tidak berlaku untuk akun Anda.', en: 'This voucher is not available for your account.' },
  per_user_limit: { id: 'Batas pemakaian voucher untuk akun Anda sudah tercapai.', en: 'You have reached the usage limit for this voucher.' },
  min_subtotal: { id: 'Subtotal belum memenuhi minimum belanja voucher.', en: 'Subtotal does not meet the voucher minimum.' },
  scope: { id: 'Voucher tidak berlaku untuk produk di keranjang.', en: 'Voucher does not apply to the products in your cart.' },
};

function PageHead({ title, t }: { title: string; t: (id: string, en: string) => string }) {
  const shop = useShopPaths();

  // Di portal customer (/dashboard/checkout) kepala halaman ringkas; navbar situs tidak ada di sana.
  if (shop.portal) {
    return (
      <header className="portal-head">
        <Link href={shop.catalog} className="portal-back">
          <Icon name="chevronLeft" size={16} /> {t('Kembali belanja', 'Back to shopping')}
        </Link>
        <h1>{title.replace(/\.$/, '')}</h1>
      </header>
    );
  }

  return (
    <section className="pagehead commerce-head">
      <div className="container">
        <Breadcrumb items={[{ label: t('Beranda', 'Home'), href: '/' }, { label: t('Keranjang', 'Cart'), href: '/cart' }, { label: 'Checkout' }]} />
        <span className="label label-amber">/ Checkout</span>
        <h1 className="display pagehead-title">{title}</h1>
      </div>
    </section>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const shop = useShopPaths();
  const { items, clear, ready } = useCart();
  const { customer, ready: authReady } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [step, setStep] = useState<Step>('address');
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [config, setConfig] = useState<CommerceConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [addressId, setAddressId] = useState<number | null>(null);
  const [shippingRateId, setShippingRateId] = useState<number | null>(null);
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  const [voucherInput, setVoucherInput] = useState('');
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherError, setVoucherError] = useState('');
  // Voucher yang ditujukan khusus ke customer ini (GET /customer/vouchers); voucher umum tetap diketik manual.
  const [myVouchers, setMyVouchers] = useState<AssignedVoucher[]>([]);
  const [note, setNote] = useState('');

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stockIssues, setStockIssues] = useState<InsufficientStockItem[]>([]);
  const idempotencyKey = useRef<string>(newIdempotencyKey());
  // Kunci dipakai ulang hanya untuk isi pesanan yang sama (retry); isi berubah → kunci baru agar server tidak memutar ulang order lama.
  const idempotencyBody = useRef<string>('');

  const isActive = customer?.status === 'active';
  const itemsKey = items.map((i) => `${i.slug}:${i.qty}`).join('|');

  // Data awal: alamat + konfigurasi commerce.
  useEffect(() => {
    if (!customer || !isActive) return;
    let active = true;
    Promise.all([api<CustomerAddress[]>('/customer/addresses'), api<CommerceConfig>('/commerce/config')])
      .then(([addr, cfg]) => {
        if (!active) return;
        setAddresses(addr);
        setConfig(cfg);
        setAddressId((current) => current ?? (addr.find((a) => a.isDefault) || addr[0])?.id ?? null);
        setPaymentMethodCode((current) => current || cfg.paymentMethods[0]?.code || '');
        setBankAccountId((current) => current ?? cfg.bankAccounts[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [customer, isActive]);

  // Voucher khusus akun ini; gagal memuat tidak menghalangi checkout.
  useEffect(() => {
    if (!customer || !isActive) return;
    let active = true;
    api<AssignedVoucher[]>('/customer/vouchers')
      .then((rows) => {
        if (active) setMyVouchers(rows);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [customer, isActive]);

  // Quote ulang setiap kali item/alamat/tarif/metode/voucher berubah.
  useEffect(() => {
    if (!customer || !isActive || !ready || items.length === 0 || !addressId) return;
    let active = true;
    setQuoting(true);
    setQuoteError('');
    api<QuoteResult>('/cart/quote', {
      method: 'POST',
      body: {
        items: items.map((i) => ({ productSlug: i.slug, qty: i.qty })),
        addressId,
        shippingRateId: shippingRateId || undefined,
        paymentMethodCode: paymentMethodCode || undefined,
        bankAccountId: bankAccountId || undefined,
        voucherCode: voucherCode || undefined,
      },
    })
      .then((res) => {
        if (!active) return;
        setQuote(res);
        setVoucherError('');
        // Tarif yang dipilih tidak lagi tersedia (mis. alamat berubah) → reset.
        if (shippingRateId && !res.availableShippingRates.some((r) => r.rateId === shippingRateId)) setShippingRateId(null);
        const only = res.availableShippingRates.length === 1 ? res.availableShippingRates[0] : undefined;
        if (!shippingRateId && only) setShippingRateId(only.rateId);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && err.code === 'VOUCHER_INVALID') {
          const reason = String(err.meta?.reason || '');
          const mapped = voucherReasons[reason];
          setVoucherError(mapped ? mapped[lang] : err.message);
          setVoucherCode('');
          return;
        }
        // Tarif terpilih tidak berlaku lagi (dinonaktifkan admin / alamat pindah zona) → kosongkan agar quote diulang.
        if (err instanceof ApiError && err.status === 422 && err.errors?.shippingRateId && shippingRateId) {
          setShippingRateId(null);
          return;
        }
        setQuote(null);
        setQuoteError(errorMessage(err));
      })
      .finally(() => {
        if (active) setQuoting(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, addressId, shippingRateId, paymentMethodCode, bankAccountId, voucherCode, customer?.id, isActive, ready]);

  const selectedAddress = useMemo(() => addresses?.find((a) => a.id === addressId) || null, [addresses, addressId]);
  const selectedMethod = useMemo(() => config?.paymentMethods.find((m) => m.code === paymentMethodCode) || null, [config, paymentMethodCode]);
  const rates = quote?.availableShippingRates || [];
  const selectedRate = rates.find((r) => r.rateId === shippingRateId) || null;
  const needsBank = selectedMethod?.type === 'manual_transfer';
  const canReview = !!addressId && !!shippingRateId && !!paymentMethodCode && (!needsBank || !!bankAccountId) && !!quote;

  function applyVoucher() {
    setVoucherError('');
    setVoucherCode(voucherInput.trim().toUpperCase());
  }

  async function placeOrder() {
    if (!canReview || submitting || !addressId) return;
    setSubmitting(true);
    setSubmitError('');
    setStockIssues([]);
    const body = {
      items: items.map((i) => ({ productSlug: i.slug, qty: i.qty })),
      addressId,
      shippingRateId,
      paymentMethodCode,
      bankAccountId: needsBank ? bankAccountId : undefined,
      voucherCode: voucherCode || undefined,
      note: note.trim() || undefined,
    };
    const signature = JSON.stringify(body);
    if (idempotencyBody.current && idempotencyBody.current !== signature) idempotencyKey.current = newIdempotencyKey();
    idempotencyBody.current = signature;
    try {
      const order = await api<Order>('/customer/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey.current },
        body,
      });
      clear();
      idempotencyKey.current = newIdempotencyKey();
      idempotencyBody.current = '';
      // Di portal langsung ke detail pesanan (instruksi bayar + unggah bukti ada di sana); di situs publik ke halaman sukses.
      router.push(shop.portal ? `${shop.order(order.number)}?placed=1` : `/checkout/success/${encodeURIComponent(order.number)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INSUFFICIENT_STOCK') {
        const list = (err.meta?.items as InsufficientStockItem[] | undefined) || [];
        setStockIssues(list);
        setSubmitError(err.message || t('Stok tidak mencukupi.', 'Insufficient stock.'));
      } else if (err instanceof ApiError && err.code === 'VOUCHER_INVALID') {
        const reason = String(err.meta?.reason || '');
        setVoucherError(voucherReasons[reason]?.[lang] || err.message);
        setVoucherCode('');
        setSubmitError(err.message);
      } else if (err instanceof ApiError && err.code === 'ACCOUNT_NOT_APPROVED') {
        setSubmitError(t('Akun Anda belum disetujui untuk melakukan checkout.', 'Your account is not yet approved for checkout.'));
      } else {
        setSubmitError(errorMessage(err));
      }
      setSubmitting(false);
    }
  }

  // ---- Guard & state kosong ----
  if (!authReady || !ready) {
    return (
      <>
        <PageHead title="Checkout." t={t} />
        <section className="section-tight"><div className="container"><p className="form-note">{t('Memuat…', 'Loading…')}</p></div></section>
      </>
    );
  }

  if (!customer) {
    return (
      <>
        <PageHead title="Checkout." t={t} />
        <section className="section-tight">
          <div className="container">
            <EmptyState
              icon="bag"
              title={t('Login diperlukan', 'Login required')}
              body={t('Masuk atau daftar sebagai customer untuk menyelesaikan pemesanan. Keranjang Anda tetap tersimpan.', 'Log in or register as a customer to complete your order. Your cart is kept.')}
              action={{ href: '/login?next=/checkout', label: t('Login / Daftar', 'Login / Register') }}
            />
          </div>
        </section>
      </>
    );
  }

  if (!isActive) {
    return (
      <>
        <PageHead title="Checkout." t={t} />
        <section className="section-tight">
          <div className="container" style={{ maxWidth: 720 }}>
            <AccountStatusBanner context="checkout" />
            <div className="co-done-actions" style={{ marginTop: 22, justifyContent: 'flex-start' }}>
              <Link href={shop.cart} className="btn btn-line">{shop.portal ? t('Kembali belanja', 'Back to shopping') : t('Kembali ke keranjang', 'Back to cart')}</Link>
              <Link href="/dashboard" className="btn btn-solid">{t('Ke dashboard', 'Go to dashboard')} <Icon name="arrow" /></Link>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <PageHead title="Checkout." t={t} />
        <section className="section-tight">
          <div className="container">
            <EmptyState
              icon="drop"
              title={t('Tidak ada yang di-checkout', 'Nothing to check out')}
              body={t('Keranjang Anda kosong.', 'Your cart is empty.')}
              action={{ href: shop.catalog, label: t('Lihat katalog', 'View catalog') }}
            />
          </div>
        </section>
      </>
    );
  }

  const stepLabels: Record<Step, string> = {
    address: t('Alamat', 'Address'),
    shipping: t('Pengiriman', 'Shipping'),
    payment: t('Pembayaran', 'Payment'),
    review: t('Konfirmasi', 'Review'),
  };
  const stepIdx = STEPS.indexOf(step);
  const stepDone: Record<Step, boolean> = {
    address: !!addressId,
    shipping: !!shippingRateId,
    payment: !!paymentMethodCode && (!needsBank || !!bankAccountId),
    review: false,
  };

  return (
    <>
      <PageHead title={t('Selesaikan pesanan.', 'Complete your order.')} t={t} />

      <section className="section-tight">
        <div className="container">
          <ol className="stepper co-stepper" aria-label={t('Langkah checkout', 'Checkout steps')}>
            {STEPS.map((s, i) => (
              <li key={s} className={`step ${s === step ? 'is-active' : ''} ${stepDone[s] && i < stepIdx ? 'is-done' : ''}`}>
                <button type="button" className="step-btn" onClick={() => i <= stepIdx && setStep(s)} disabled={i > stepIdx && !STEPS.slice(0, i).every((p) => stepDone[p])}>
                  <span className="step-num">{stepDone[s] && i < stepIdx ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="step-label">{stepLabels[s]}</span>
                </button>
                {i < STEPS.length - 1 && <span className="step-line" />}
              </li>
            ))}
          </ol>

          {loadError && <p className="form-error" role="alert">{loadError}</p>}

          <div className="co-grid">
            <div className="co-main">
              {/* 1. Alamat */}
              {step === 'address' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Alamat pengiriman', 'Shipping address')}</h2>
                  {addresses === null ? (
                    <p className="form-note">{t('Memuat alamat…', 'Loading addresses…')}</p>
                  ) : (
                    <>
                      <div className="co-address-list">
                        {addresses.map((a) => (
                          <label key={a.id} className={`co-addr-card ${addressId === a.id ? 'is-active' : ''}`}>
                            <input type="radio" name="address" value={a.id} checked={addressId === a.id} onChange={() => { setAddressId(a.id); setShippingRateId(null); }} />
                            <span>
                              <strong>{a.label}</strong>{a.isDefault && <span className="badge badge-ok badge-sm" style={{ marginLeft: 8 }}>{t('Utama', 'Default')}</span>}<br />
                              {a.recipientName} · {a.phone}<br />
                              <small>{formatAddressLines(a).join(', ')}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      {addresses.length === 0 && !showAddressForm && (
                        <p className="form-note">{t('Belum ada alamat tersimpan. Tambahkan alamat untuk melanjutkan.', 'No saved address yet. Add one to continue.')}</p>
                      )}
                      {showAddressForm ? (
                        <AddressForm
                          defaults={{ recipientName: customer.name, phone: customer.profile?.phone || '' }}
                          onSaved={(saved) => {
                            setAddresses((prev) => [...(prev || []).filter((a) => a.id !== saved.id), saved].map((a) => (saved.isDefault && a.id !== saved.id ? { ...a, isDefault: false } : a)));
                            setAddressId(saved.id);
                            setShippingRateId(null);
                            setShowAddressForm(false);
                          }}
                          onCancel={() => setShowAddressForm(false)}
                          submitLabel={t('Simpan & pakai alamat ini', 'Save & use this address')}
                        />
                      ) : (
                        <button type="button" className="btn btn-line btn-sm" style={{ marginTop: 14 }} onClick={() => setShowAddressForm(true)}>
                          <Icon name="plus" size={16} /> {t('Tambah alamat baru', 'Add a new address')}
                        </button>
                      )}
                    </>
                  )}
                  <div className="co-nav">
                    <button type="button" className="btn btn-solid" disabled={!addressId} onClick={() => setStep('shipping')}>
                      {t('Lanjut: pengiriman', 'Next: shipping')} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Ongkir */}
              {step === 'shipping' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Metode pengiriman', 'Shipping method')}</h2>
                  {selectedAddress && (
                    <p className="form-note" style={{ marginBottom: 14 }}>
                      {t('Dikirim ke', 'Ship to')}: <strong>{selectedAddress.label}</strong> — {formatAddressLines(selectedAddress).join(', ')}
                    </p>
                  )}
                  {quote && (
                    <div className="co-ship-metrics">
                      {rates.find((r) => r.distanceKm) && (
                        <span>
                          <Icon name="pin" size={14} /> {t('Jarak', 'Distance')} ±{rates.find((r) => r.distanceKm)?.distanceKm?.toLocaleString('id-ID')} km
                        </span>
                      )}
                      <span>
                        <Icon name="package" size={14} /> {t('Berat', 'Weight')} {(quote.weightGram / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg
                      </span>
                      {!!quote.volumeCm3 && (
                        <span>
                          <Icon name="ruler" size={14} /> {t('Volume', 'Volume')} {(quote.volumeCm3 / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 3 })} m³
                        </span>
                      )}
                    </div>
                  )}
                  {quote?.warnings.includes('shipping_origin_unset') && (
                    <p className="co-ship-warn" role="status">
                      {t(
                        'Sebagian tarif berbasis jarak belum bisa dihitung karena titik asal pengiriman belum diatur penjual. Pilih tarif lain atau hubungi kami.',
                        'Some distance-based rates are unavailable because the seller has not set a shipping origin yet. Choose another rate or contact us.',
                      )}
                    </p>
                  )}
                  {quote?.warnings.includes('distance_unavailable') && (
                    <p className="co-ship-warn" role="status">
                      {t(
                        'Sebagian tarif dihitung dari jarak dan baru muncul setelah alamat ini punya titik lokasi di peta. ',
                        'Some rates are distance-based and appear once this address has a map pin. ',
                      )}
                      <Link href="/dashboard/alamat">{t('Tandai lokasi alamat', 'Pin the address location')}</Link>
                    </p>
                  )}
                  {quoting && rates.length === 0 && <p className="form-note">{t('Menghitung ongkir…', 'Calculating shipping…')}</p>}
                  {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
                  <div className="co-ship">
                    {rates.map((rate) => (
                      <label key={rate.rateId} className={`co-ship-opt ${shippingRateId === rate.rateId ? 'is-active' : ''}`}>
                        <input type="radio" name="ship" value={rate.rateId} checked={shippingRateId === rate.rateId} onChange={() => setShippingRateId(rate.rateId)} />
                        <span className="co-ship-label">
                          {tr(rate.label, lang)}
                          {rate.eta && <small className="co-ship-eta"> · {tr(rate.eta, lang)}</small>}
                          {rate.type === 'calculated' && rate.breakdown && !rate.breakdown.free && (
                            <small className="co-ship-break">{shippingBreakdownText(rate.breakdown, lang)}</small>
                          )}
                        </span>
                        <span className="co-ship-price">{rate.amount === 0 ? t('Gratis', 'Free') : formatIDR(rate.amount)}</span>
                      </label>
                    ))}
                    {!quoting && quote && rates.length === 0 && (
                      <p className="form-error">{t('Belum ada tarif pengiriman untuk alamat ini. Pilih alamat lain atau hubungi kami.', 'No shipping rate is available for this address. Choose another address or contact us.')}</p>
                    )}
                  </div>
                  <div className="co-nav">
                    <button type="button" className="btn btn-line" onClick={() => setStep('address')}><Icon name="chevronLeft" size={16} /> {t('Kembali', 'Back')}</button>
                    <button type="button" className="btn btn-solid" disabled={!shippingRateId} onClick={() => setStep('payment')}>
                      {t('Lanjut: pembayaran', 'Next: payment')} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Pembayaran + voucher + catatan */}
              {step === 'payment' && (
                <>
                  <div className="co-block">
                    <h2 className="h3 pd-sec-title">{t('Metode pembayaran', 'Payment method')}</h2>
                    <div className="co-ship">
                      {(config?.paymentMethods || []).map((m) => (
                        <label key={m.code} className={`co-ship-opt ${paymentMethodCode === m.code ? 'is-active' : ''}`}>
                          <input type="radio" name="method" value={m.code} checked={paymentMethodCode === m.code} onChange={() => setPaymentMethodCode(m.code)} />
                          <span className="co-ship-label">
                            {tr(m.name, lang)}
                            <small className="co-ship-eta"> · {tr(m.instructions, lang)}</small>
                          </span>
                        </label>
                      ))}
                      {config && config.paymentMethods.length === 0 && <p className="form-error">{t('Metode pembayaran belum dikonfigurasi.', 'No payment method configured.')}</p>}
                    </div>

                    {needsBank && (
                      <>
                        <h3 className="h3 pd-sec-title" style={{ marginTop: 22, fontSize: '1rem' }}>{t('Rekening tujuan', 'Destination bank account')}</h3>
                        <div className="co-ship">
                          {(config?.bankAccounts || []).map((bank) => (
                            <label key={bank.id} className={`co-ship-opt ${bankAccountId === bank.id ? 'is-active' : ''}`}>
                              <input type="radio" name="bank" value={bank.id} checked={bankAccountId === bank.id} onChange={() => setBankAccountId(bank.id)} />
                              <span className="co-ship-label">{bank.bankName} · {bank.accountNumber}</span>
                              <span className="co-ship-price">a.n. {bank.accountHolder}</span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}

                    {selectedMethod?.type === 'qris_static' && selectedMethod.qrisImageUrl && (
                      <div className="co-qris">
                        <Image src={selectedMethod.qrisImageUrl} alt="QRIS" width={200} height={200} unoptimized />
                        <span className="qty-moq">{t('Kode QRIS ditampilkan lagi setelah pesanan dibuat.', 'The QRIS code is shown again after the order is placed.')}</span>
                      </div>
                    )}
                  </div>

                  <div className="co-block">
                    <h2 className="h3 pd-sec-title">{t('Voucher & catatan', 'Voucher & note')}</h2>
                    <div className="co-voucher">
                      <input
                        value={voucherInput}
                        onChange={(e) => setVoucherInput(e.target.value)}
                        placeholder={t('Kode voucher (opsional)', 'Voucher code (optional)')}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyVoucher(); } }}
                        aria-label="Voucher"
                      />
                      {quote?.voucher ? (
                        <button type="button" className="btn btn-line btn-sm" onClick={() => { setVoucherCode(''); setVoucherInput(''); }}>
                          <Icon name="close" size={14} /> {t('Hapus', 'Remove')}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-line btn-sm" onClick={applyVoucher} disabled={!voucherInput.trim() || quoting}>
                          {t('Pakai', 'Apply')}
                        </button>
                      )}
                    </div>
                    {myVouchers.length > 0 && !quote?.voucher && (
                      <div className="co-my-vouchers">
                        <span className="label">{t('Voucher untuk Anda', 'Vouchers for you')}</span>
                        <div className="co-my-voucher-list">
                          {myVouchers.map((v) => (
                            <button
                              key={v.code}
                              type="button"
                              className="co-my-voucher"
                              disabled={quoting}
                              onClick={() => {
                                setVoucherError('');
                                setVoucherInput(v.code);
                                setVoucherCode(v.code);
                              }}
                            >
                              <strong>{v.code}</strong>
                              <span>
                                {t('Potongan', 'Discount')} {v.type === 'percent' ? `${v.value}%` : formatIDR(v.value)}
                                {v.maxDiscount !== null && v.type === 'percent' ? ` (${t('maks.', 'max')} ${formatIDR(v.maxDiscount)})` : ''}
                                {v.minSubtotal > 0 ? `, ${t('min. belanja', 'min. spend')} ${formatIDR(v.minSubtotal)}` : ''}
                              </span>
                              {v.endsAt && <small>{t('Berlaku sampai', 'Valid until')} {formatDate(v.endsAt, lang)}</small>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {voucherError && <p className="form-error" role="alert">{voucherError}</p>}
                    {quote?.voucher && (
                      <p className="proof-done">
                        <Icon name="check" size={16} /> {t('Voucher', 'Voucher')} <strong>{quote.voucher.code}</strong> {t('dipakai', 'applied')}: −{formatIDR(quote.discountTotal)}
                      </p>
                    )}
                    <label className="co-full" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                      <span className="label">{t('Catatan pesanan (opsional)', 'Order note (optional)')}</span>
                      <textarea className="co-textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Jam kirim, instruksi bongkar, dsb.', 'Delivery hours, unloading instructions, etc.')} />
                    </label>
                    <div className="co-nav">
                      <button type="button" className="btn btn-line" onClick={() => setStep('shipping')}><Icon name="chevronLeft" size={16} /> {t('Kembali', 'Back')}</button>
                      <button type="button" className="btn btn-solid" disabled={!stepDone.payment} onClick={() => setStep('review')}>
                        {t('Lanjut: konfirmasi', 'Next: review')} <Icon name="arrow" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 4. Konfirmasi */}
              {step === 'review' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Periksa pesanan Anda', 'Review your order')}</h2>
                  <dl className="co-review">
                    <div>
                      <dt>{t('Alamat', 'Address')}</dt>
                      <dd>{selectedAddress ? <>{selectedAddress.recipientName} · {selectedAddress.phone}<br />{formatAddressLines(selectedAddress).join(', ')}</> : '—'} <button type="button" className="link" onClick={() => setStep('address')}>{t('ubah', 'change')}</button></dd>
                    </div>
                    <div>
                      <dt>{t('Pengiriman', 'Shipping')}</dt>
                      <dd>{selectedRate ? <>{tr(selectedRate.label, lang)}{selectedRate.eta ? ` · ${tr(selectedRate.eta, lang)}` : ''} · {formatIDR(selectedRate.amount)}</> : '—'} <button type="button" className="link" onClick={() => setStep('shipping')}>{t('ubah', 'change')}</button></dd>
                    </div>
                    <div>
                      <dt>{t('Pembayaran', 'Payment')}</dt>
                      <dd>
                        {selectedMethod ? tr(selectedMethod.name, lang) : '—'}
                        {needsBank && bankAccountId && config && (() => { const b = config.bankAccounts.find((x) => x.id === bankAccountId); return b ? ` · ${b.bankName} ${b.accountNumber}` : ''; })()}
                        {' '}<button type="button" className="link" onClick={() => setStep('payment')}>{t('ubah', 'change')}</button>
                      </dd>
                    </div>
                    {note.trim() && (
                      <div>
                        <dt>{t('Catatan', 'Note')}</dt>
                        <dd>{note}</dd>
                      </div>
                    )}
                  </dl>
                  {quote?.warnings.includes('no_shipping_rate') && (
                    <p className="form-error">{t('Tarif pengiriman belum dipilih.', 'Shipping rate not selected.')}</p>
                  )}
                  {stockIssues.length > 0 && (
                    <div className="form-error co-stock-issues" role="alert">
                      <strong>{t('Stok tidak mencukupi', 'Insufficient stock')}:</strong>
                      <ul>
                        {stockIssues.map((s) => {
                          const item = items.find((i) => i.slug === s.productSlug);
                          return (
                            <li key={s.productSlug}>
                              {item ? tr(item.name, lang) : s.productSlug}: {t('diminta', 'requested')} {s.requested}, {t('tersedia', 'available')} {s.available}
                            </li>
                          );
                        })}
                      </ul>
                      {shop.portal ? (
                        <button type="button" className="link" onClick={openCartDrawer}>{t('Sesuaikan keranjang', 'Adjust cart')}</button>
                      ) : (
                        <Link href="/cart" className="link">{t('Sesuaikan keranjang', 'Adjust cart')}</Link>
                      )}
                    </div>
                  )}
                  {submitError && stockIssues.length === 0 && <p className="form-error" role="alert">{submitError}</p>}
                  <p className="qty-moq" style={{ marginTop: 14 }}>
                    {t(
                      `Dengan membuat pesanan, stok direservasi untuk Anda dan pembayaran harus diselesaikan dalam ${config?.paymentDueHours ?? 24} jam.`,
                      `By placing the order, stock is reserved for you and payment must be completed within ${config?.paymentDueHours ?? 24} hours.`,
                    )}
                  </p>
                  <div className="co-nav">
                    <button type="button" className="btn btn-line" onClick={() => setStep('payment')}><Icon name="chevronLeft" size={16} /> {t('Kembali', 'Back')}</button>
                    <button type="button" className="btn btn-solid" disabled={!canReview || submitting || quoting} onClick={placeOrder}>
                      {submitting ? t('Memproses…', 'Processing…') : t('Buat pesanan', 'Place order')} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <aside className="summary">
              <h2 className="summary-title">{t('Ringkasan pesanan', 'Order summary')}</h2>
              <div className="co-items">
                {(quote?.items.length ? quote.items : items.map((i) => ({ productSlug: i.slug, name: i.name, qty: i.qty, unit: i.unit, lineTotal: (i.unitPrice || 0) * i.qty, promoApplied: false }))).map((item) => (
                  <div key={item.productSlug} className="co-item">
                    <span className="co-item-name">
                      {tr(item.name, lang)} <small>×{item.qty} {item.unit}</small>
                      {item.promoApplied && <span className="pcard-promo-inline">{t('Promo', 'Promo')}</span>}
                    </span>
                    <span>{formatIDR(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="summary-row"><span>Subtotal</span><span>{formatIDR(quote?.subtotal ?? items.reduce((n, i) => n + (i.unitPrice || 0) * i.qty, 0))}</span></div>
              {quote && quote.discountTotal > 0 && <div className="summary-row"><span>{t('Diskon', 'Discount')}{quote.voucher ? ` (${quote.voucher.code})` : ''}</span><span>−{formatIDR(quote.discountTotal)}</span></div>}
              <div className="summary-row"><span>{t('Ongkir', 'Shipping')}</span><span>{selectedRate ? (selectedRate.amount === 0 ? t('Gratis', 'Free') : formatIDR(quote?.shippingTotal ?? selectedRate.amount)) : '—'}</span></div>
              {(quote?.fees || []).map((fee) => (
                <div key={fee.id} className="summary-row"><span>{tr(fee.name, lang)}</span><span>{formatIDR(fee.amount)}</span></div>
              ))}
              {quote && (
                <div className="summary-row summary-muted">
                  <span>{quote.priceIncludesTax ? t(`Termasuk PPN ${quote.taxRate}%`, `Includes VAT ${quote.taxRate}%`) : `PPN ${quote.taxRate}%`}</span>
                  <span>{formatIDR(quote.taxTotal)}</span>
                </div>
              )}
              {quote && quote.uniqueCodeRequired && (
                <div className="summary-row co-summary-unique">
                  <span>{t('Kode unik transfer', 'Transfer unique code')}</span>
                  <span>{quote.uniqueCode > 0 ? `+${quote.uniqueCode}` : '—'}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total{quote?.uniqueCodeRequired ? '*' : ''}</span>
                <span>{quoting ? '…' : formatIDR(quote?.grandTotal ?? 0)}</span>
              </div>
              {quote?.uniqueCodeRequired && (
                <p className="qty-moq">* {t('Kode unik final (≤ 999) ditetapkan saat pesanan dibuat.', 'The final unique code (≤ 999) is assigned when the order is placed.')}</p>
              )}
              {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
              {step !== 'review' && (
                <button type="button" className="btn btn-solid btn-block" style={{ marginTop: 18 }} disabled={!canReview} onClick={() => setStep('review')}>
                  {t('Ke konfirmasi', 'Go to review')} <Icon name="arrow" />
                </button>
              )}
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
