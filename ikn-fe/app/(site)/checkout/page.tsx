'use client';

// Checkout customer (hanya akun `active`): cara serah terima (GET /commerce/config deliveryTerms, ASUMSI A-85)
// → alamat → ongkir (POST /cart/quote dengan addressId; hanya term bertarif zona) → metode bayar → voucher/catatan
// → ringkasan → POST /customer/orders dengan header Idempotency-Key (UUID sekali per sesi checkout).
// Term Loco (ambil di pabrik) melewati langkah alamat dan ongkir: quote dan order hanya mengirim deliveryTermCode.
// Customer ekspor (ASUMSI A-86/A-87): term FOB (keluarga port, tanpa alamat/ongkir), semua angka USD dari quote,
// syarat pembayaran wajib (config.paymentTerms), hanya rekening USD, tanpa voucher dan kode unik, batas bayar ekspor.
// Term CIF (ASUMSI A-89, `requiresDestinationPort`): langkah "Pelabuhan tujuan" (PortPicker) di antara serah terima dan
// pembayaran; ongkir belum ada (warning `freight_quote_pending`), order lahir `awaiting_freight` dan admin menawarkan ongkir.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import AddressForm from '@/components/customer/AddressForm';
import AccountStatusBanner from '@/components/customer/AccountStatusBanner';
import PickupPointCard from '@/components/customer/PickupPointCard';
import PortPicker, { EMPTY_PORT, completeDestinationPort, type DestinationPortDraft } from '@/components/customer/PortPicker';
import { formatAddressLines } from '@/components/customer/CustomerAddresses';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage, fieldErrors } from '@/lib/api';
import { tr } from '@/lib/cms';
import { formatDate, formatMoney, isUsd } from '@/lib/format';
import { openCartDrawer, useShopPaths } from '@/lib/shop';
import type { AssignedVoucher, BankAccountInfo, CommerceConfig, Currency, CustomerAddress, FactoryPickupPoint, InsufficientStockItem, Order, QuoteResult } from '@/lib/types';
import { freightQuotePendingText, hasMultipleOrigins, joinNames, pickupItemNames, pickupPointName, shippingBreakdownText, shippingOriginText } from '@/lib/commerce';

type Step = 'term' | 'port' | 'address' | 'shipping' | 'payment' | 'review';

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
  currency: { id: 'Voucher tidak berlaku untuk pesanan dalam USD.', en: 'Vouchers do not apply to USD orders.' },
};

/** Rekening tujuan yang bisa dipakai untuk mata uang order (rekening lama tanpa `currency` = IDR). */
function banksFor(config: CommerceConfig | null, currency: Currency): BankAccountInfo[] {
  return (config?.bankAccounts || []).filter((bank) => (bank.currency || 'IDR') === currency);
}

/** Rincian rekening USD (SWIFT, alamat bank, bank koresponden) untuk pilihan rekening dan ringkasan. */
function BankDetails({ bank, t }: { bank: BankAccountInfo; t: (id: string, en: string) => string }) {
  if (!bank.swiftCode && !bank.bankAddress && !bank.correspondentBank) return null;
  return (
    <small className="co-bank-detail">
      {bank.swiftCode && <>SWIFT <b className="mono">{bank.swiftCode}</b></>}
      {bank.bankAddress && <><br />{t('Alamat bank', 'Bank address')}: {bank.bankAddress}</>}
      {bank.correspondentBank && <><br />{t('Bank koresponden', 'Correspondent bank')}: {bank.correspondentBank}</>}
    </small>
  );
}

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
  const { items, clear, ready, syncQuote } = useCart();
  const { customer, ready: authReady } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [step, setStep] = useState<Step>('term');
  const [addresses, setAddresses] = useState<CustomerAddress[] | null>(null);
  const [config, setConfig] = useState<CommerceConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [showAddressForm, setShowAddressForm] = useState(false);

  const [deliveryTermCode, setDeliveryTermCode] = useState('');
  const [paymentTermCode, setPaymentTermCode] = useState('');
  const [addressId, setAddressId] = useState<number | null>(null);
  const [shippingRateId, setShippingRateId] = useState<number | null>(null);
  const [paymentMethodCode, setPaymentMethodCode] = useState('');
  const [bankAccountId, setBankAccountId] = useState<number | null>(null);
  // Pelabuhan tujuan term CIF (ASUMSI A-89); `portTouched` menampilkan pesan bagian kosong setelah tombol lanjut ditekan.
  const [port, setPort] = useState<DestinationPortDraft>(EMPTY_PORT);
  const [portTouched, setPortTouched] = useState(false);
  // Pesan validasi 422 per field dari server (deliveryTermCode, paymentTermCode, bankAccountId, paymentMethodCode, destinationPort.*).
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
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

  // Cara serah terima: daftar aktif dari config; tanpa daftar (server lama) = alur zona seperti dulu tanpa deliveryTermCode.
  const terms = useMemo(() => config?.deliveryTerms || [], [config]);
  const selectedTerm = useMemo(() => terms.find((d) => d.code === deliveryTermCode) || null, [terms, deliveryTermCode]);
  const usesZone = !selectedTerm || selectedTerm.pricingMode === 'zone';
  const isPickup = selectedTerm?.family === 'pickup';
  const isPort = selectedTerm?.family === 'port';
  // Term CIF (ASUMSI A-89): ongkir ditawarkan admin setelah order dibuat; pelabuhan tujuan wajib lengkap (nama, negara, pin).
  const quotedFreight = selectedTerm?.pricingMode === 'quoted';
  const needsPort = !!selectedTerm?.requiresDestinationPort;
  const destinationPort = needsPort ? completeDestinationPort(port) : null;
  const portOk = !needsPort || !!destinationPort;
  // Mata uang: dari quote bila ada, selain itu dari config (pasar customer); tamu/lokal = IDR.
  const currency: Currency = (quote?.currency ?? config?.currency ?? customer?.currency ?? 'IDR') === 'USD' ? 'USD' : 'IDR';
  const usd = isUsd(currency);
  const exportMarket = config?.market === 'export' || customer?.market === 'export';
  const fmt = (value: number | null | undefined) => formatMoney(value, currency);
  // Order USD hanya transfer manual (ASUMSI A-86); rekening disaring per mata uang.
  const methods = useMemo(() => (config?.paymentMethods || []).filter((m) => !usd || m.type === 'manual_transfer'), [config, usd]);
  const banks = useMemo(() => banksFor(config, currency), [config, currency]);
  const paymentTerms = useMemo(() => config?.paymentTerms || [], [config]);
  const selectedPaymentTerm = useMemo(() => paymentTerms.find((p) => p.code === paymentTermCode) || null, [paymentTerms, paymentTermCode]);
  const needsPaymentTerm = paymentTerms.length > 0;

  // Data awal: alamat + konfigurasi commerce.
  useEffect(() => {
    if (!customer || !isActive) return;
    let active = true;
    Promise.all([api<CustomerAddress[]>('/customer/addresses'), api<CommerceConfig>('/commerce/config')])
      .then(([addr, cfg]) => {
        if (!active) return;
        const cfgCurrency: Currency = cfg.currency === 'USD' ? 'USD' : 'IDR';
        const cfgMethods = cfg.paymentMethods.filter((m) => cfgCurrency !== 'USD' || m.type === 'manual_transfer');
        setAddresses(addr);
        setConfig(cfg);
        setAddressId((current) => current ?? (addr.find((a) => a.isDefault) || addr[0])?.id ?? null);
        setDeliveryTermCode((current) => current || cfg.deliveryTerms?.[0]?.code || '');
        setPaymentTermCode((current) => current || cfg.paymentTerms?.[0]?.code || '');
        setPaymentMethodCode((current) => current || cfgMethods[0]?.code || '');
        setBankAccountId((current) => current ?? banksFor(cfg, cfgCurrency)[0]?.id ?? null);
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

  // Rekening/metode terpilih harus sesuai mata uang (mis. quote menyatakan USD): pindah ke pilihan pertama yang cocok.
  useEffect(() => {
    if (!config) return;
    if (bankAccountId && !banks.some((b) => b.id === bankAccountId)) setBankAccountId(banks[0]?.id ?? null);
    if (paymentMethodCode && !methods.some((m) => m.code === paymentMethodCode)) setPaymentMethodCode(methods[0]?.code || '');
  }, [config, banks, methods, bankAccountId, paymentMethodCode]);

  // Quote ulang setiap kali item/term/alamat/tarif/metode/voucher berubah. Menunggu config agar term awal ikut terkirim.
  useEffect(() => {
    if (!customer || !isActive || !ready || !config || items.length === 0 || (usesZone && !addressId)) return;
    let active = true;
    setQuoting(true);
    setQuoteError('');
    api<QuoteResult>('/cart/quote', {
      method: 'POST',
      body: {
        items: items.map((i) => ({ productSlug: i.slug, qty: i.qty })),
        deliveryTermCode: deliveryTermCode || undefined,
        paymentTermCode: paymentTermCode || undefined,
        addressId: usesZone ? addressId : undefined,
        shippingRateId: usesZone && shippingRateId ? shippingRateId : undefined,
        paymentMethodCode: paymentMethodCode || undefined,
        bankAccountId: bankAccountId || undefined,
        voucherCode: voucherCode || undefined,
      },
    })
      .then((res) => {
        if (!active) return;
        setQuote(res);
        syncQuote(res);
        setVoucherError('');
        setFormErrors({});
        if (!usesZone) return;
        // Tarif yang dipilih tidak lagi tersedia (mis. alamat berubah) → reset.
        if (shippingRateId && !res.availableShippingRates.some((r) => r.rateId === shippingRateId)) setShippingRateId(null);
        const only = res.availableShippingRates.length === 1 ? res.availableShippingRates[0] : undefined;
        if (!shippingRateId && only?.rateId) setShippingRateId(only.rateId);
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
        if (err instanceof ApiError && err.status === 422) setFormErrors(fieldErrors(err));
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
  }, [itemsKey, deliveryTermCode, paymentTermCode, usesZone, addressId, shippingRateId, paymentMethodCode, bankAccountId, voucherCode, customer?.id, isActive, ready, !!config]);

  const selectedAddress = useMemo(() => addresses?.find((a) => a.id === addressId) || null, [addresses, addressId]);
  const selectedMethod = useMemo(() => methods.find((m) => m.code === paymentMethodCode) || null, [methods, paymentMethodCode]);
  const selectedBank = useMemo(() => banks.find((b) => b.id === bankAccountId) || null, [banks, bankAccountId]);
  const rates = quote?.availableShippingRates || [];
  const selectedRate = rates.find((r) => r.rateId === shippingRateId) || null;
  const needsBank = selectedMethod?.type === 'manual_transfer';
  const termOk = terms.length === 0 || !!selectedTerm;
  const paymentTermOk = !needsPaymentTerm || !!selectedPaymentTerm;
  const shippingOk = !usesZone || (!!addressId && !!shippingRateId);
  const canReview = termOk && portOk && shippingOk && paymentTermOk && !!paymentMethodCode && (!needsBank || !!bankAccountId) && !!quote;
  const dueHours = exportMarket || usd ? config?.exportPaymentDueHours ?? config?.paymentDueHours ?? 120 : config?.paymentDueHours ?? 24;

  function applyVoucher() {
    setVoucherError('');
    setVoucherCode(voucherInput.trim().toUpperCase());
  }

  async function placeOrder() {
    if (!canReview || submitting || (usesZone && !addressId)) return;
    if (needsPort && !destinationPort) {
      // Server mewajibkan lat/lng; kembali ke langkah pelabuhan dengan pesan bagian yang kosong.
      setPortTouched(true);
      setStep('port');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    setFormErrors({});
    setStockIssues([]);
    const body = {
      items: items.map((i) => ({ productSlug: i.slug, qty: i.qty })),
      deliveryTermCode: deliveryTermCode || undefined,
      paymentTermCode: paymentTermCode || undefined,
      addressId: usesZone ? addressId : undefined,
      shippingRateId: usesZone ? shippingRateId : undefined,
      paymentMethodCode,
      bankAccountId: needsBank ? bankAccountId : undefined,
      voucherCode: usd ? undefined : voucherCode || undefined,
      note: note.trim() || undefined,
      destinationPort: needsPort ? destinationPort : undefined,
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
      } else if (err instanceof ApiError && err.status === 422) {
        // Pesan per field (paymentTermCode wajib untuk ekspor, rekening tidak se-mata-uang, metode tidak sah, dsb.).
        const errors = fieldErrors(err);
        setFormErrors(errors);
        setSubmitError(errorMessage(err));
        // Pelabuhan tujuan ditolak server (destinationPort.*): kembali ke langkahnya agar pesan tampil di isian terkait.
        if (Object.keys(errors).some((key) => key.startsWith('destinationPort'))) {
          setPortTouched(true);
          setStep('port');
        }
      } else {
        setSubmitError(errorMessage(err));
      }
      setSubmitting(false);
    }
  }

  const fieldError = (key: string) => (formErrors[key] ? <p className="form-error" role="alert">{formErrors[key]}</p> : null);

  // ---- Guard & state kosong ----
  if (!authReady || !ready) {
    return (
      <>
        <PageHead title="Checkout." t={t} />
        <section className="section-tight"><div className="container"><p className="form-note"><Spinner label={t('Memuat…', 'Loading…')} /></p></div></section>
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

  // Urutan langkah mengikuti term: Loco/FOB tanpa alamat dan ongkir; tanpa daftar term, langkah "Serah terima" tidak ada.
  // Term CIF menyisipkan langkah "Pelabuhan tujuan" setelah serah terima (ASUMSI A-89).
  const steps: Step[] = [...(terms.length > 0 ? (['term'] as Step[]) : []), ...(needsPort ? (['port'] as Step[]) : []), ...(usesZone ? (['address', 'shipping'] as Step[]) : []), 'payment', 'review'];
  const activeStep: Step = steps.includes(step) ? step : steps[0] ?? 'payment';
  const stepLabels: Record<Step, string> = {
    term: t('Serah terima', 'Delivery'),
    port: t('Pelabuhan tujuan', 'Destination port'),
    address: t('Alamat', 'Address'),
    shipping: t('Pengiriman', 'Shipping'),
    payment: t('Pembayaran', 'Payment'),
    review: t('Konfirmasi', 'Review'),
  };
  const stepIdx = steps.indexOf(activeStep);
  const stepDone: Record<Step, boolean> = {
    term: !!selectedTerm,
    port: portOk,
    address: !!addressId,
    shipping: !!shippingRateId,
    payment: !!paymentMethodCode && (!needsBank || !!bankAccountId) && paymentTermOk,
    review: false,
  };
  const nextStep = steps[stepIdx + 1];
  const prevStep = steps[stepIdx - 1];
  const nextLabel = nextStep ? `${t('Lanjut', 'Next')}: ${stepLabels[nextStep].toLowerCase()}` : '';
  const backButton = prevStep ? (
    <button type="button" className="btn btn-line" onClick={() => setStep(prevStep)}><Icon name="chevronLeft" size={16} /> {t('Kembali', 'Back')}</button>
  ) : null;
  // Loco beberapa pabrik (ASUMSI A-90): satu titik per pabrik asal dari quote; cadangan = pabrik bawaan di config.
  const pickupPoints: FactoryPickupPoint[] = quote?.pickupPoints?.length
    ? quote.pickupPoints
    : config?.pickup
      ? [{ code: null, name: null, label: config.pickup.label, address: config.pickup.address, lat: config.pickup.lat, lng: config.pickup.lng, items: [] }]
      : [];
  const pickupLabel = joinNames(pickupPoints.map((point) => pickupPointName(point, lang)), lang);
  const unsetFactoryNames = (() => {
    const meta = quote?.warningMeta as { factory_location_unset?: { factoryCodes?: string[] } } | undefined;
    const codes = meta?.factory_location_unset?.factoryCodes || [];
    return joinNames(codes.map((code) => {
      const factory = config?.factories?.find((f) => f.code === code);
      return factory ? tr(factory.name, lang) : code;
    }), lang);
  })();
  const shippingRowText = !usesZone && quote?.shipping
    ? quotedFreight ? t('Menunggu penawaran', 'To be quoted') : isPort ? t('Termasuk harga', 'Included in price') : fmt(0)
    : selectedRate
      ? selectedRate.amount === 0 ? t('Gratis', 'Free') : fmt(quote?.shippingTotal ?? selectedRate.amount)
      : '—';
  const termIcon = (family: string | undefined) => (family === 'pickup' ? 'factory' : family === 'port' ? 'globe' : 'truck');

  return (
    <>
      <PageHead title={t('Selesaikan pesanan.', 'Complete your order.')} t={t} />

      <section className="section-tight">
        <div className="container">
          <ol className="stepper co-stepper" aria-label={t('Langkah checkout', 'Checkout steps')}>
            {steps.map((s, i) => (
              <li key={s} className={`step ${s === activeStep ? 'is-active' : ''} ${stepDone[s] && i < stepIdx ? 'is-done' : ''}`}>
                <button type="button" className="step-btn" onClick={() => i <= stepIdx && setStep(s)} disabled={i > stepIdx && !steps.slice(0, i).every((p) => stepDone[p])}>
                  <span className="step-num">{stepDone[s] && i < stepIdx ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="step-label">{stepLabels[s]}</span>
                </button>
                {i < steps.length - 1 && <span className="step-line" />}
              </li>
            ))}
          </ol>

          {loadError && <p className="form-error" role="alert">{loadError}</p>}

          <div className="co-grid">
            <div className="co-main">
              {/* 0. Cara serah terima (hanya bila server memberi daftar term) */}
              {activeStep === 'term' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Cara serah terima', 'Delivery terms')}</h2>
                  {terms.length === 1 && selectedTerm ? (
                    <div className="co-addr-card is-active co-term-card">
                      <Icon name={termIcon(selectedTerm.family)} size={20} />
                      <span>
                        <strong>{tr(selectedTerm.name, lang)}</strong>
                        {tr(selectedTerm.description, lang) && (
                          <>
                            <br />
                            <small>{tr(selectedTerm.description, lang)}</small>
                          </>
                        )}
                        {selectedTerm.family === 'port' && selectedTerm.loadingPort && (
                          <>
                            <br />
                            <small>{t('Pelabuhan muat', 'Loading port')}: <b>{selectedTerm.loadingPort}</b></small>
                          </>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="co-address-list">
                      {terms.map((term) => (
                        <label key={term.code} className={`co-addr-card ${deliveryTermCode === term.code ? 'is-active' : ''}`}>
                          <input type="radio" name="term" value={term.code} checked={deliveryTermCode === term.code} onChange={() => { setDeliveryTermCode(term.code); setShippingRateId(null); }} />
                          <span>
                            <strong>{tr(term.name, lang)}</strong>
                            {tr(term.description, lang) && (
                              <>
                                <br />
                                <small>{tr(term.description, lang)}</small>
                              </>
                            )}
                            {term.family === 'port' && term.loadingPort && (
                              <>
                                <br />
                                <small>{t('Pelabuhan muat', 'Loading port')}: <b>{term.loadingPort}</b></small>
                              </>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {isPickup && pickupPoints.length === 0 && <PickupPointCard label={null} address={null} lat={null} lng={null} lang={lang} />}
                  {isPickup &&
                    pickupPoints.map((point, index) => (
                      <PickupPointCard
                        key={point.code || `point-${index}`}
                        label={pickupPointName(point, lang)}
                        address={point.address}
                        lat={point.lat}
                        lng={point.lng}
                        lang={lang}
                        title={pickupPoints.length > 1 ? `${t('Titik ambil', 'Pickup point')} ${index + 1}` : undefined}
                        items={pickupItemNames(point, quote?.items || [], lang)}
                      />
                    ))}
                  {isPickup && pickupPoints.length > 1 && (
                    <p className="form-note" style={{ marginTop: 10 }}>
                      {t('Produk di keranjang berasal dari beberapa pabrik, jadi barang diambil di tiap pabrik asalnya.', 'Products in the cart come from several factories, so goods are collected at each factory.')}
                    </p>
                  )}
                  {isPort && quotedFreight && (
                    <p className="form-note" style={{ marginTop: 14 }}>
                      {t(
                        `Barang dimuat di pelabuhan${selectedTerm?.loadingPort ? ` ${selectedTerm.loadingPort}` : ' muat'}; ongkos kapal dan asuransi sampai pelabuhan tujuan Anda ditawarkan tim kami setelah pesanan dibuat. Anda bisa menyetujui penawaran itu atau mengajukan harga lain; pembayaran menyusul setelah disepakati. Dokumen memakai alamat perusahaan di profil Anda.`,
                        `Goods are loaded at ${selectedTerm?.loadingPort || 'the loading port'}; ocean freight and insurance to your destination port are quoted by our team after the order is placed. You can accept the quote or propose another price; payment follows once agreed. Documents use the company address on your profile.`,
                      )}
                    </p>
                  )}
                  {isPort && !quotedFreight && (
                    <p className="form-note" style={{ marginTop: 14 }}>
                      {t(
                        `Barang diserahkan di atas kapal di pelabuhan muat${selectedTerm?.loadingPort ? ` ${selectedTerm.loadingPort}` : ''}; trucking ke pelabuhan dan biaya pelabuhan sudah termasuk harga. Pengangkutan laut dan asuransi diatur pembeli. Dokumen memakai alamat perusahaan di profil Anda.`,
                        `Goods are handed over on board at the loading port${selectedTerm?.loadingPort ? ` ${selectedTerm.loadingPort}` : ''}; trucking to the port and port charges are included in the price. Ocean freight and insurance are arranged by the buyer. Documents use the company address on your profile.`,
                      )}
                    </p>
                  )}
                  {!usesZone && !isPickup && !isPort && (
                    <p className="form-note" style={{ marginTop: 14 }}>{t('Cara ini tidak memakai alamat pengiriman dan ongkir terpisah.', 'This term uses no shipping address and no separate shipping charge.')}</p>
                  )}
                  {fieldError('deliveryTermCode')}
                  {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
                  <div className="co-nav">
                    <button type="button" className="btn btn-solid" disabled={!selectedTerm || !nextStep} onClick={() => nextStep && setStep(nextStep)}>
                      {nextLabel} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}

              {/* 0b. Pelabuhan tujuan (hanya term CIF, ASUMSI A-89) */}
              {activeStep === 'port' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Pelabuhan tujuan', 'Destination port')}</h2>
                  <p className="form-note" style={{ marginBottom: 14 }}>
                    {t(
                      'Tulis nama pelabuhan bongkar di negara Anda, pilih negaranya, lalu tandai lokasinya di peta. Ongkos kapal dan asuransi ditawarkan sampai titik ini.',
                      'Enter the discharge port in your country, pick the country, then mark its location on the map. Ocean freight and insurance are quoted up to this point.',
                    )}
                  </p>
                  <PortPicker value={port} onChange={setPort} lang={lang} showErrors={portTouched} serverErrors={formErrors} />
                  <div className="co-nav">
                    {backButton}
                    <button
                      type="button"
                      className="btn btn-solid"
                      onClick={() => {
                        setPortTouched(true);
                        if (portOk && nextStep) setStep(nextStep);
                      }}
                    >
                      {nextLabel} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}

              {/* 1. Alamat */}
              {activeStep === 'address' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Alamat pengiriman', 'Shipping address')}</h2>
                  {addresses === null ? (
                    <p className="form-note"><Spinner label={t('Memuat alamat…', 'Loading addresses…')} /></p>
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
                    {backButton}
                    <button type="button" className="btn btn-solid" disabled={!addressId} onClick={() => setStep('shipping')}>
                      {nextLabel} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Ongkir */}
              {activeStep === 'shipping' && (
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
                  {quote?.warnings.includes('factory_location_unset') && (
                    <p className="co-ship-warn" role="status">
                      {unsetFactoryNames
                        ? t(
                            `Sebagian tarif berbasis jarak belum bisa dihitung karena titik lokasi ${unsetFactoryNames} belum diatur penjual. Pilih tarif lain atau hubungi kami.`,
                            `Some distance-based rates are unavailable because the seller has not pinned the location of ${unsetFactoryNames} yet. Choose another rate or contact us.`,
                          )
                        : t(
                            'Sebagian tarif berbasis jarak belum bisa dihitung karena titik lokasi pabrik belum diatur penjual. Pilih tarif lain atau hubungi kami.',
                            'Some distance-based rates are unavailable because the seller has not pinned the factory location yet. Choose another rate or contact us.',
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
                        <input type="radio" name="ship" value={rate.rateId ?? ''} checked={shippingRateId === rate.rateId} onChange={() => setShippingRateId(rate.rateId)} />
                        <span className="co-ship-label">
                          {tr(rate.label, lang)}
                          {rate.eta && <small className="co-ship-eta"> · {tr(rate.eta, lang)}</small>}
                          {rate.type === 'calculated' && rate.breakdown && !rate.breakdown.free && !hasMultipleOrigins(rate) && (
                            <small className="co-ship-break">{shippingBreakdownText(rate.breakdown, lang)}</small>
                          )}
                          {hasMultipleOrigins(rate) &&
                            rate.origins?.map((origin, index) => (
                              <small key={origin.factory?.code || index} className="co-ship-break">
                                {shippingOriginText(origin, lang)}
                              </small>
                            ))}
                        </span>
                        <span className="co-ship-price">{rate.amount === 0 ? t('Gratis', 'Free') : fmt(rate.amount)}</span>
                      </label>
                    ))}
                    {!quoting && quote && rates.length === 0 && (
                      <p className="form-error">{t('Belum ada tarif pengiriman untuk alamat ini. Pilih alamat lain atau hubungi kami.', 'No shipping rate is available for this address. Choose another address or contact us.')}</p>
                    )}
                  </div>
                  <div className="co-nav">
                    {backButton}
                    <button type="button" className="btn btn-solid" disabled={!shippingRateId} onClick={() => setStep('payment')}>
                      {nextLabel} <Icon name="arrow" />
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Pembayaran + voucher + catatan */}
              {activeStep === 'payment' && (
                <>
                  {needsPaymentTerm && (
                    <div className="co-block">
                      <h2 className="h3 pd-sec-title">{t('Syarat pembayaran', 'Payment terms')}</h2>
                      <div className="co-ship">
                        {paymentTerms.map((term) => (
                          <label key={term.code} className={`co-ship-opt ${paymentTermCode === term.code ? 'is-active' : ''}`}>
                            <input type="radio" name="paymentTerm" value={term.code} checked={paymentTermCode === term.code} onChange={() => setPaymentTermCode(term.code)} />
                            <span className="co-ship-label">
                              {tr(term.name, lang)}
                              {tr(term.description, lang) && <small className="co-ship-eta"> · {tr(term.description, lang)}</small>}
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="qty-moq" style={{ marginTop: 10 }}>
                        {t('Syarat ini dicetak di proforma dan commercial invoice. Aplikasi mencatat satu pembayaran sebesar total pesanan; tahapan pembayaran dicocokkan tim keuangan.', 'These terms are printed on the proforma and commercial invoice. The app records one payment for the order total; instalments are matched by our finance team.')}
                      </p>
                      {fieldError('paymentTermCode')}
                    </div>
                  )}

                  <div className="co-block">
                    <h2 className="h3 pd-sec-title">{t('Metode pembayaran', 'Payment method')}</h2>
                    <div className="co-ship">
                      {methods.map((m) => (
                        <label key={m.code} className={`co-ship-opt ${paymentMethodCode === m.code ? 'is-active' : ''}`}>
                          <input type="radio" name="method" value={m.code} checked={paymentMethodCode === m.code} onChange={() => setPaymentMethodCode(m.code)} />
                          <span className="co-ship-label">
                            {tr(m.name, lang)}
                            <small className="co-ship-eta"> · {tr(m.instructions, lang)}</small>
                          </span>
                        </label>
                      ))}
                      {config && methods.length === 0 && <p className="form-error">{usd ? t('Belum ada metode transfer manual untuk pembayaran USD.', 'No manual transfer method is configured for USD payments.') : t('Metode pembayaran belum dikonfigurasi.', 'No payment method configured.')}</p>}
                    </div>
                    {fieldError('paymentMethodCode')}

                    {needsBank && (
                      <>
                        <h3 className="h3 pd-sec-title" style={{ marginTop: 22, fontSize: '1rem' }}>{t('Rekening tujuan', 'Destination bank account')}{usd ? ' (USD)' : ''}</h3>
                        <div className="co-ship">
                          {banks.map((bank) => (
                            <label key={bank.id} className={`co-ship-opt ${bankAccountId === bank.id ? 'is-active' : ''}`}>
                              <input type="radio" name="bank" value={bank.id} checked={bankAccountId === bank.id} onChange={() => setBankAccountId(bank.id)} />
                              <span className="co-ship-label">
                                {bank.bankName} · {bank.accountNumber}
                                <BankDetails bank={bank} t={t} />
                              </span>
                              <span className="co-ship-price">a.n. {bank.accountHolder}</span>
                            </label>
                          ))}
                          {config && banks.length === 0 && <p className="form-error">{t(`Belum ada rekening ${currency} yang aktif. Hubungi kami.`, `No active ${currency} bank account yet. Please contact us.`)}</p>}
                        </div>
                        {usd && (
                          <p className="pay-bank-note">{t('Biaya bank di luar negeri (termasuk bank koresponden) ditanggung pembeli; jumlah yang diterima dicatat saat verifikasi.', 'Bank charges abroad (including correspondent banks) are borne by the buyer; the amount received is recorded at verification.')}</p>
                        )}
                        {fieldError('bankAccountId')}
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
                    <h2 className="h3 pd-sec-title">{usd ? t('Catatan', 'Note') : t('Voucher & catatan', 'Voucher & note')}</h2>
                    {!usd && (
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
                    )}
                    {!usd && myVouchers.length > 0 && !quote?.voucher && (
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
                                {t('Potongan', 'Discount')} {v.type === 'percent' ? `${v.value}%` : fmt(v.value)}
                                {v.maxDiscount !== null && v.type === 'percent' ? ` (${t('maks.', 'max')} ${fmt(v.maxDiscount)})` : ''}
                                {v.minSubtotal > 0 ? `, ${t('min. belanja', 'min. spend')} ${fmt(v.minSubtotal)}` : ''}
                              </span>
                              {v.endsAt && <small>{t('Berlaku sampai', 'Valid until')} {formatDate(v.endsAt, lang)}</small>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {!usd && voucherError && <p className="form-error" role="alert">{voucherError}</p>}
                    {quote?.voucher && (
                      <p className="proof-done">
                        <Icon name="check" size={16} /> {t('Voucher', 'Voucher')} <strong>{quote.voucher.code}</strong> {t('dipakai', 'applied')}: −{fmt(quote.discountTotal)}
                      </p>
                    )}
                    <label className="co-full" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16 }}>
                      <span className="label">{t('Catatan pesanan (opsional)', 'Order note (optional)')}</span>
                      <textarea
                        className="co-textarea"
                        rows={2}
                        maxLength={500}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder={isPickup ? t('Rencana jam ambil, nama sopir, nomor kendaraan, dsb.', 'Planned pickup time, driver name, vehicle number, etc.') : t('Jam kirim, instruksi bongkar, dsb.', 'Delivery hours, unloading instructions, etc.')}
                      />
                    </label>
                    <div className="co-nav">
                      {backButton}
                      <button type="button" className="btn btn-solid" disabled={!stepDone.payment} onClick={() => setStep('review')}>
                        {nextLabel} <Icon name="arrow" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* 4. Konfirmasi */}
              {activeStep === 'review' && (
                <div className="co-block">
                  <h2 className="h3 pd-sec-title">{t('Periksa pesanan Anda', 'Review your order')}</h2>
                  <dl className="co-review">
                    {selectedTerm && (
                      <div>
                        <dt>{t('Serah terima', 'Delivery')}</dt>
                        <dd>
                          {tr(selectedTerm.name, lang)}
                          {isPickup && pickupLabel ? ` · ${pickupLabel}` : ''}
                          {isPickup && pickupPoints.length === 1 && pickupPoints[0]?.address ? <><br /><small>{pickupPoints[0]?.address}</small></> : null}
                          {isPickup && pickupPoints.length > 1
                            ? pickupPoints.map((point, index) => (
                                <span key={point.code || index}>
                                  <br />
                                  <small>
                                    {pickupPointName(point, lang)}: {pickupItemNames(point, quote?.items || [], lang).join(', ') || point.address}
                                  </small>
                                </span>
                              ))
                            : null}
                          {isPort && selectedTerm.loadingPort ? <><br /><small>{t('Pelabuhan muat', 'Loading port')}: {selectedTerm.loadingPort}</small></> : null}
                          {needsPort && destinationPort ? (
                            <>
                              <br />
                              <small>
                                {t('Pelabuhan tujuan', 'Destination port')}: {destinationPort.name}, {destinationPort.country}{' '}
                                <button type="button" className="link" onClick={() => setStep('port')}>{t('ubah', 'change')}</button>
                              </small>
                            </>
                          ) : null}
                          {isPort && customer.profile?.companyAddress ? <><br /><small>{customer.profile.company || customer.name} · {customer.profile.companyAddress}</small></> : null}
                          {' '}<button type="button" className="link" onClick={() => setStep('term')}>{t('ubah', 'change')}</button>
                        </dd>
                      </div>
                    )}
                    {selectedPaymentTerm && (
                      <div>
                        <dt>{t('Syarat pembayaran', 'Payment terms')}</dt>
                        <dd>
                          {tr(selectedPaymentTerm.name, lang)}
                          {tr(selectedPaymentTerm.description, lang) ? <><br /><small>{tr(selectedPaymentTerm.description, lang)}</small></> : null}
                          {' '}<button type="button" className="link" onClick={() => setStep('payment')}>{t('ubah', 'change')}</button>
                        </dd>
                      </div>
                    )}
                    {usesZone && (
                      <div>
                        <dt>{t('Alamat', 'Address')}</dt>
                        <dd>{selectedAddress ? <>{selectedAddress.recipientName} · {selectedAddress.phone}<br />{formatAddressLines(selectedAddress).join(', ')}</> : '—'} <button type="button" className="link" onClick={() => setStep('address')}>{t('ubah', 'change')}</button></dd>
                      </div>
                    )}
                    <div>
                      <dt>{t('Pengiriman', 'Shipping')}</dt>
                      <dd>
                        {usesZone ? (
                          <>{selectedRate ? <>{tr(selectedRate.label, lang)}{selectedRate.eta ? ` · ${tr(selectedRate.eta, lang)}` : ''} · {fmt(selectedRate.amount)}</> : '—'} <button type="button" className="link" onClick={() => setStep('shipping')}>{t('ubah', 'change')}</button></>
                        ) : (
                          quotedFreight ? (
                            <>{t('Ongkir CIF ditawarkan admin setelah pesanan dibuat; belum masuk total ini.', 'CIF freight is quoted by our team after the order is placed; not yet in this total.')}</>
                          ) : (
                            <>{isPickup ? t('Ambil di pabrik', 'Pickup at the factory') : isPort ? t('Termasuk harga (FOB)', 'Included in price (FOB)') : t('Tanpa ongkir terpisah', 'No separate shipping charge')} · {fmt(0)}</>
                          )
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('Pembayaran', 'Payment')}</dt>
                      <dd>
                        {selectedMethod ? tr(selectedMethod.name, lang) : '—'}
                        {needsBank && selectedBank ? ` · ${selectedBank.bankName} ${selectedBank.accountNumber}` : ''}
                        {needsBank && selectedBank && usd ? <><br /><BankDetails bank={selectedBank} t={t} /></> : null}
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
                  {usesZone && quote?.warnings.includes('no_shipping_rate') && (
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
                  {Object.entries(formErrors).filter(([key]) => !['deliveryTermCode', 'paymentTermCode', 'paymentMethodCode', 'bankAccountId'].includes(key)).map(([key, message]) => (
                    <p key={key} className="form-error" role="alert">{message}</p>
                  ))}
                  {fieldError('deliveryTermCode')}
                  {fieldError('paymentTermCode')}
                  {fieldError('paymentMethodCode')}
                  {fieldError('bankAccountId')}
                  <p className="qty-moq" style={{ marginTop: 14 }}>
                    {quotedFreight
                      ? t(
                          `Dengan membuat pesanan, stok direservasi untuk Anda. Tim kami mengirim penawaran ongkir CIF yang bisa Anda setujui atau balas; instruksi pembayaran dan batas bayar ${dueHours} jam menyusul setelah penawaran disetujui.`,
                          `By placing the order, stock is reserved for you. Our team sends a CIF freight quote you can accept or counter; payment instructions and the ${dueHours}-hour payment window follow once the quote is accepted.`,
                        )
                      : t(
                          `Dengan membuat pesanan, stok direservasi untuk Anda dan pembayaran harus diselesaikan dalam ${dueHours} jam.`,
                          `By placing the order, stock is reserved for you and payment must be completed within ${dueHours} hours.`,
                        )}
                  </p>
                  <div className="co-nav">
                    {backButton}
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
                    <span>{fmt(item.lineTotal)}</span>
                  </div>
                ))}
              </div>
              <div className="summary-row"><span>Subtotal</span><span>{fmt(quote?.subtotal ?? items.reduce((n, i) => n + (i.unitPrice || 0) * i.qty, 0))}</span></div>
              {quote && quote.discountTotal > 0 && <div className="summary-row"><span>{t('Diskon', 'Discount')}{quote.voucher ? ` (${quote.voucher.code})` : ''}</span><span>−{fmt(quote.discountTotal)}</span></div>}
              <div className="summary-row">
                <span>{t('Ongkir', 'Shipping')}{isPickup && quote?.shipping ? ` · ${t('Ambil di pabrik', 'Pickup at factory')}` : ''}{isPort && quote?.shipping ? ` · ${quotedFreight ? 'CIF' : selectedTerm?.loadingPort ? `FOB ${selectedTerm.loadingPort}` : 'FOB'}` : ''}</span>
                <span>{shippingRowText}</span>
              </div>
              {quote?.warnings.includes('freight_quote_pending') && (
                <p className="co-freight-note" role="status">{freightQuotePendingText[lang]}.</p>
              )}
              {(quote?.fees || []).map((fee) => (
                <div key={fee.id} className="summary-row"><span>{tr(fee.name, lang)}</span><span>{fmt(fee.amount)}</span></div>
              ))}
              {quote && (
                <div className="summary-row summary-muted">
                  <span>{quote.priceIncludesTax ? t(`Termasuk PPN ${quote.taxRate}%`, `Includes VAT ${quote.taxRate}%`) : `PPN ${quote.taxRate}%`}</span>
                  <span>{fmt(quote.taxTotal)}</span>
                </div>
              )}
              {quote && quote.uniqueCodeRequired && !usd && (
                <div className="summary-row co-summary-unique">
                  <span>{t('Kode unik transfer', 'Transfer unique code')}</span>
                  <span>{quote.uniqueCode > 0 ? `+${quote.uniqueCode}` : '—'}</span>
                </div>
              )}
              <div className="summary-row summary-total">
                <span>Total{quote?.uniqueCodeRequired && !usd ? '*' : ''}{usd ? ' (USD)' : ''}</span>
                <span>{quoting ? '…' : fmt(quote?.grandTotal ?? 0)}</span>
              </div>
              {quote?.uniqueCodeRequired && !usd && (
                <p className="qty-moq">* {t('Kode unik final (≤ 999) ditetapkan saat pesanan dibuat.', 'The final unique code (≤ 999) is assigned when the order is placed.')}</p>
              )}
              {usd && (
                <p className="qty-moq">
                  {quotedFreight
                    ? t('Harga FOB Belawan; ongkos kapal dan asuransi sampai pelabuhan tujuan ditambahkan setelah penawaran ongkir disepakati.', 'FOB Belawan prices; ocean freight and insurance to the destination port are added once the freight quote is agreed.')
                    : t('Harga FOB Belawan; pengangkutan laut dan asuransi di luar total ini.', 'FOB Belawan prices; ocean freight and insurance are not part of this total.')}
                </p>
              )}
              {quoteError && <p className="form-error" role="alert">{quoteError}</p>}
              {activeStep !== 'review' && (
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
