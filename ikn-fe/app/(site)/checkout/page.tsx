'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import { useCart } from '@/components/CartProvider';
import { useAuth } from '@/components/AuthProvider';
import { useTransactions } from '@/components/TransactionProvider';
import { api, errorMessage } from '@/lib/api';
import { formatIDR, formatDateTime } from '@/lib/format';
import type { CommerceConfig } from '@/lib/server-data';
import type { CustomerProfile, Order } from '@/lib/types';

export default function CheckoutPage() {
  const { items, subtotal, count, clear, ready } = useCart();
  const { customer, ready: authReady } = useAuth();
  const { checkout } = useTransactions();

  const [config, setConfig] = useState<CommerceConfig | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [ship, setShip] = useState('');
  const [bankId, setBankId] = useState('');
  const [placed, setPlaced] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Konfigurasi commerce (rekening, ongkir, biaya) datang dari admin — bukan hardcode.
  useEffect(() => {
    api<CommerceConfig>('/commerce/config')
      .then((data) => {
        setConfig(data);
        setShip((current) => current || data.shippingMethods[0]?.id || '');
        setBankId((current) => current || data.bankAccounts[0]?.id || '');
      })
      .catch(() => setConfig(null));
  }, []);

  // Prefill alamat utama dari profil customer.
  useEffect(() => {
    if (!customer) return;
    api<CustomerProfile>('/customer/profile')
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [customer]);

  const shipping = useMemo(
    () => config?.shippingMethods.find((method) => method.id === ship) || null,
    [config, ship],
  );
  const adminFee = useMemo(
    () =>
      (config?.additionalFees || [])
        .filter((fee) => fee.type === 'admin')
        .reduce((total, fee) => total + fee.amount, 0),
    [config],
  );
  const total = subtotal + (shipping?.amount || 0) + adminFee;
  const primaryAddress = profile?.addresses.find((address) => address.primary) || profile?.addresses[0];

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipping || !bankId || submitting) return;
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const order = await checkout({
        items: items.map((item) => ({ slug: item.slug, qty: item.qty })),
        bankId,
        shippingMethodId: shipping.id,
        address: {
          label: String(form.get('label') || 'Alamat checkout'),
          recipient: String(form.get('recipient') || ''),
          phone: String(form.get('phone') || ''),
          line: String(form.get('address') || ''),
        },
        note: String(form.get('note') || ''),
      });
      setPlaced(order);
      clear();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // Checkout hanya untuk customer terautentikasi.
  if (authReady && !customer && !placed) {
    return (
      <>
        <section className="pagehead commerce-head">
          <div className="container">
            <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Checkout' }]} />
            <h1 className="display pagehead-title">Checkout.</h1>
          </div>
        </section>
        <section className="section-tight">
          <div className="container">
            <EmptyState
              icon="bag"
              title="Login diperlukan"
              body="Masuk atau daftar sebagai customer untuk menyelesaikan pemesanan. Keranjang Anda tetap tersimpan."
              action={{ href: '/login?next=/checkout', label: 'Login / Daftar' }}
            />
          </div>
        </section>
      </>
    );
  }

  if (ready && items.length === 0 && !placed) {
    return (
      <>
        <section className="pagehead commerce-head">
          <div className="container">
            <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Checkout' }]} />
            <h1 className="display pagehead-title">Checkout.</h1>
          </div>
        </section>
        <section className="section-tight">
          <div className="container">
            <EmptyState
              icon="drop"
              title="Tidak ada yang di-checkout"
              body="Keranjang Anda kosong."
              action={{ href: '/catalog', label: 'Lihat katalog' }}
            />
          </div>
        </section>
      </>
    );
  }

  if (placed) {
    const bank = config?.bankAccounts.find((item) => item.id === placed.bank);
    return (
      <>
        <section className="pagehead commerce-head">
          <div className="container">
            <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Checkout' }, { label: 'Selesai' }]} />
          </div>
        </section>
        <section className="section-tight" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="co-done">
              <div className="vm-icon co-done-icon"><Icon name="check" size={40} /></div>
              <h1 className="h2">Pesanan dibuat</h1>
              <p className="co-done-num">No. Pesanan: <strong>{placed.number}</strong></p>
              <p>
                Transfer <strong>{formatIDR(placed.total)}</strong> ke rekening tujuan berikut,
                lalu unggah bukti transfer dari halaman pesanan.
                {placed.dueAt && (
                  <> Batas waktu pembayaran: <strong>{formatDateTime(placed.dueAt)}</strong>.</>
                )}
              </p>

              <div className="co-banks">
                {(bank ? [bank] : config?.bankAccounts || []).map((item) => (
                  <div key={item.id} className="co-bank">
                    <span className="co-bank-name">{item.bank}</span>
                    <span className="co-bank-no">{item.number}</span>
                    <span className="co-bank-holder">a.n. {item.holder}</span>
                  </div>
                ))}
              </div>

              <div className="co-done-actions">
                <Link href={`/dashboard/pesanan/${placed.number}`} className="btn btn-solid">
                  Unggah bukti pembayaran <Icon name="arrow" />
                </Link>
                <Link href="/dashboard/pesanan" className="btn btn-line">Semua pesanan</Link>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Keranjang', href: '/cart' }, { label: 'Checkout' }]} />
          <span className="label label-amber">/ Checkout</span>
          <h1 className="display pagehead-title">Selesaikan pesanan.</h1>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <form className="co-grid" onSubmit={placeOrder}>
            <div className="co-main">
              <div className="co-block">
                <h2 className="h3 pd-sec-title">Alamat pengiriman</h2>
                <div className="co-fields">
                  <label>
                    <span className="label">Label alamat</span>
                    <input name="label" defaultValue={primaryAddress?.label || 'Alamat utama'} placeholder="Gudang / kantor" />
                  </label>
                  <label>
                    <span className="label">Nama penerima</span>
                    <input name="recipient" required defaultValue={primaryAddress?.recipient || customer?.name || ''} placeholder="Nama lengkap / PIC" />
                  </label>
                  <label>
                    <span className="label">Telepon</span>
                    <input name="phone" required defaultValue={primaryAddress?.phone || profile?.phone || ''} placeholder="+62 ..." />
                  </label>
                  <label className="co-full">
                    <span className="label">Alamat lengkap</span>
                    <textarea name="address" rows={3} required defaultValue={primaryAddress?.line || ''} placeholder="Jalan, kota, provinsi, kode pos" />
                  </label>
                  <label className="co-full">
                    <span className="label">Catatan (opsional)</span>
                    <input name="note" placeholder="Catatan untuk tim kami" />
                  </label>
                </div>
              </div>

              <div className="co-block">
                <h2 className="h3 pd-sec-title">Metode pengiriman</h2>
                <div className="co-ship">
                  {(config?.shippingMethods || []).map((method) => (
                    <label key={method.id} className={`co-ship-opt ${ship === method.id ? 'is-active' : ''}`}>
                      <input type="radio" name="ship" value={method.id} checked={ship === method.id} onChange={() => setShip(method.id)} />
                      <span className="co-ship-label">{method.label}</span>
                      <span className="co-ship-price">{formatIDR(method.amount)}</span>
                    </label>
                  ))}
                  {config && config.shippingMethods.length === 0 && (
                    <p className="pd-quote-note">Metode pengiriman belum dikonfigurasi admin.</p>
                  )}
                </div>
              </div>

              <div className="co-block">
                <h2 className="h3 pd-sec-title">Rekening tujuan</h2>
                <div className="co-ship">
                  {(config?.bankAccounts || []).map((bank) => (
                    <label key={bank.id} className={`co-ship-opt ${bankId === bank.id ? 'is-active' : ''}`}>
                      <input type="radio" name="bank" value={bank.id} checked={bankId === bank.id} onChange={() => setBankId(bank.id)} />
                      <span className="co-ship-label">{bank.bank} · {bank.number}</span>
                      <span className="co-ship-price">a.n. {bank.holder}</span>
                    </label>
                  ))}
                </div>
                <p className="pd-quote-note" style={{ marginTop: 12 }}>
                  Pembayaran via transfer bank manual. Unggah bukti transfer setelah pesanan dibuat;
                  tim kami memverifikasi sebelum pesanan diproses.
                </p>
              </div>
            </div>

            <aside className="summary">
              <h2 className="summary-title">Ringkasan pesanan</h2>
              <div className="co-items">
                {items.map((item) => (
                  <div key={item.slug} className="co-item">
                    <span className="co-item-name">{item.name} <small>×{item.qty}</small></span>
                    <span>{formatIDR((item.price || 0) * item.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="summary-row"><span>Subtotal ({count})</span><span>{formatIDR(subtotal)}</span></div>
              <div className="summary-row"><span>Ongkir</span><span>{shipping ? formatIDR(shipping.amount) : '—'}</span></div>
              <div className="summary-row"><span>Biaya admin</span><span>{formatIDR(adminFee)}</span></div>
              <div className="summary-row summary-total"><span>Total</span><span>{formatIDR(total)}</span></div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button
                type="submit"
                className="btn btn-solid btn-block"
                style={{ marginTop: 18 }}
                disabled={submitting || !shipping || !bankId}
              >
                {submitting ? 'Memproses…' : 'Buat pesanan'} <Icon name="arrow" />
              </button>
            </aside>
          </form>
        </div>
      </section>
    </>
  );
}
