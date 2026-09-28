'use client';

// Halaman sukses checkout: nomor order, total (kode unik disorot), rekening/QRIS, instruksi,
// hitung mundur batas waktu, dan tombol unggah bukti (ke detail order).
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import PaymentInstructions from '@/components/PaymentInstructions';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { tr } from '@/lib/cms';
import { formatIDR } from '@/lib/format';
import type { CommerceConfig, Order } from '@/lib/types';

export default function CheckoutSuccess({ number }: { number: string }) {
  const { customer, ready } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [order, setOrder] = useState<Order | null>(null);
  const [config, setConfig] = useState<CommerceConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready || !customer) return;
    let active = true;
    Promise.all([api<Order>(`/customer/orders/${encodeURIComponent(number)}`), api<CommerceConfig>('/commerce/config').catch(() => null)])
      .then(([o, c]) => {
        if (!active) return;
        setOrder(o);
        setConfig(c);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [ready, customer, number]);

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={[{ label: t('Beranda', 'Home'), href: '/' }, { label: 'Checkout', href: '/checkout' }, { label: t('Selesai', 'Done') }]} />
        </div>
      </section>
      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          {ready && !customer ? (
            <EmptyState icon="bag" title={t('Login diperlukan', 'Login required')} body={t('Masuk untuk melihat pesanan ini.', 'Log in to view this order.')} action={{ href: `/login?next=/checkout/success/${encodeURIComponent(number)}`, label: 'Login' }} />
          ) : error ? (
            <EmptyState icon="close" title={t('Pesanan tidak ditemukan', 'Order not found')} body={error} action={{ href: '/dashboard/pesanan', label: t('Semua pesanan', 'All orders') }} />
          ) : !order ? (
            <p className="form-note">{t('Memuat pesanan…', 'Loading order…')}</p>
          ) : (
            <div className="co-done">
              <div className="vm-icon co-done-icon"><Icon name="check" size={40} /></div>
              <h1 className="h2">{t('Pesanan dibuat', 'Order placed')}</h1>
              <p className="co-done-num">{t('No. Pesanan', 'Order no.')}: <strong>{order.number}</strong></p>
              <p className="pd-quote-note">
                {t(
                  'Stok sudah direservasi untuk Anda. Selesaikan pembayaran sebelum batas waktu, lalu unggah bukti pembayaran agar tim kami dapat memverifikasi.',
                  'Stock has been reserved for you. Complete the payment before the deadline, then upload the payment proof so our team can verify it.',
                )}
              </p>

              <div style={{ textAlign: 'left', margin: '24px 0' }}>
                <PaymentInstructions order={order} config={config} />
              </div>

              <div className="co-items" style={{ textAlign: 'left' }}>
                {order.items.map((item) => (
                  <div key={item.productSlug} className="co-item">
                    <span className="co-item-name">{tr(item.name, lang)} <small>×{item.qty} {item.unit}</small></span>
                    <span>{formatIDR(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="co-done-actions">
                <Link href={`/dashboard/pesanan/${encodeURIComponent(order.number)}#payment`} className="btn btn-solid">
                  {t('Unggah bukti pembayaran', 'Upload payment proof')} <Icon name="arrow" />
                </Link>
                <Link href="/dashboard/pesanan" className="btn btn-line">{t('Semua pesanan', 'All orders')}</Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
