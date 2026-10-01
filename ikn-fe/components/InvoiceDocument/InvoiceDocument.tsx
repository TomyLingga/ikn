'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { tr, type SiteData } from '@/lib/cms';
import { formatIDR } from '@/lib/format';
import { terbilangRupiah } from '@/lib/terbilang';
import type { CommerceConfig, Order } from '@/lib/types';
import styles from './InvoiceDocument.module.css';

const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

interface InvoiceDocumentProps {
  number: string;
  site: SiteData;
  config: CommerceConfig | null;
}

function longDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;
}

// Cetakan invoice mengikuti format dokumen klien (doc/Invoice): kop perusahaan, "I N V O I C E" + nomor
// PMS/X/INV/RA/{urut}/{bulan Romawi}/{tahun}, "Kepada Yth", tabel JUMLAH BARANG / URAIAN / HARGA SATUAN /
// JUMLAH HARGA, blok Pembayaran (rekening tujuan), Jumlah / PPN / TOTAL, Terbilang, tembusan, tanda tangan,
// dan kaki halaman nilai AKHLAK + alamat kantor pusat. Dibuka customer (order miliknya) maupun admin.
export default function InvoiceDocument({ number, site, config }: InvoiceDocumentProps) {
  const { customer, admin, ready } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!customer && !admin) {
      setError(t('Login dulu untuk membuka invoice.', 'Please log in to open the invoice.'));
      return;
    }
    const path = admin ? `/admin/orders/${encodeURIComponent(number)}` : `/customer/orders/${encodeURIComponent(number)}`;
    api<Order>(path)
      .then(setOrder)
      .catch((err) => setError(err instanceof ApiError && err.status === 404 ? t('Pesanan tidak ditemukan.', 'Order not found.') : errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, customer, admin, number]);

  const office = site.contact?.locations?.[0];
  const officePhones = (office?.phones || []).map((p) => p.number).filter(Boolean);
  const officeEmail = site.contact?.emails?.[0]?.address || '';
  const companyName = (site.settings.company?.name || 'PT Industri Karet Nusantara').replace(/^PT\.?\s+/i, 'PT. ').toUpperCase();
  const invoice = config?.invoice;

  if (error) {
    return (
      <div className={styles.state}>
        <p>{error}</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className={styles.state}>
        <p>{t('Menyiapkan invoice…', 'Preparing the invoice…')}</p>
      </div>
    );
  }

  const paidPayment = order.payments.find((p) => p.status === 'paid') || order.activePayment || order.payment || null;
  const bank = paidPayment?.bankAccount || null;
  const address = order.shippingAddress;
  const region = [address.region?.village, address.region?.district, address.region?.regency, address.region?.province].filter(Boolean).join(', ');
  const issuedAt = order.paidAt || order.date;
  const city = (site.settings.company?.location || 'Medan').split(',')[0] || 'Medan';
  const invoiceNumber = order.invoiceNumber || '—';
  // Bagian nomor dipisah visual seperti dokumen klien: PMS/X/INV/RA/  77  / IV / 2026
  const numberParts = invoiceNumber.match(/^(.*\/)(\d+)\/([IVX]+)\/(\d{4})$/);
  const taxLabel = order.priceIncludesTax === false ? `PPN ${order.taxRate ?? ''}%` : `PPN ${order.taxRate ?? ''}% (termasuk)`;
  // "Jumlah" = total sebelum PPN (PPN ditambahkan di baris berikutnya seperti format klien; bila harga sudah termasuk PPN, PPN hanya informasi).
  const beforeTax = order.priceIncludesTax === false ? order.grandTotal - order.taxTotal : order.grandTotal;
  const notPaid = !order.paidAt;
  const cancelled = order.status === 'cancelled' || order.status === 'expired';

  return (
    <div className={styles.sheetWrap}>
      <div className={`${styles.toolbar} no-print`}>
        <button type="button" className={styles.printBtn} onClick={() => window.print()}>
          <Icon name="arrowDown" size={16} /> {t('Cetak / simpan PDF', 'Print / save PDF')}
        </button>
        <span>{t('Pastikan ukuran kertas A4, potret.', 'Use A4 paper, portrait.')}</span>
      </div>

      <article className={styles.sheet}>
        <header className={styles.head}>
          <div className={styles.headLeft}>
            <Image src="/img/rubin-logo.png" alt="" width={74} height={74} priority />
            <div>
              <h1>{companyName}</h1>
              <p>(NUSANTARA RUBBER INDUSTRY)</p>
            </div>
          </div>
          <div className={styles.headRight}>
            <strong>{site.settings.company?.parent || 'PTPN III (Persero)'}</strong>
            <span>{tr(site.settings.site?.subsidiary_note, lang) || t('Anak Perusahaan PTPN III (Persero)', 'Subsidiary of PTPN III (Persero)')}</span>
          </div>
        </header>
        <div className={styles.rule} />

        <p className={styles.dateline}>
          {city}, {longDate(issuedAt)}
        </p>

        <div className={styles.titleBlock}>
          <h2>I N V O I C E</h2>
          <p className={styles.number}>
            NO.{' '}
            {numberParts ? (
              <>
                {numberParts[1]}
                <b>{numberParts[2]}</b> / {numberParts[3]} / {numberParts[4]}
              </>
            ) : (
              invoiceNumber
            )}
          </p>
          {cancelled ? (
            <p className={styles.proforma}>{order.status === 'expired' ? t('Kedaluwarsa — tidak berlaku', 'Expired — void') : t('Dibatalkan — tidak berlaku', 'Cancelled — void')}</p>
          ) : (
            notPaid && <p className={styles.proforma}>{t('Belum dibayar — pro forma', 'Unpaid — pro forma')}</p>
          )}
        </div>

        <div className={styles.parties}>
          <div className={styles.toBlock}>
            <span>Kepada Yth :</span>
            <strong>{order.customer.company || order.customer.name}</strong>
            <p>
              {address.addressLine}
              {region ? `, ${region}` : ''}
              {address.postalCode ? ` ${address.postalCode}` : ''}
            </p>
            <p>
              u.p. {order.customer.pic || order.customer.name}
              {order.customer.phone ? ` · ${order.customer.phone}` : ''}
            </p>
          </div>
          <p className={styles.intro}>
            Berhutang kepada {companyName}
            <br />
            dengan rincian sebagai berikut:
          </p>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colQty}>
                JUMLAH
                <br />
                BARANG
              </th>
              <th className={styles.colDesc}>U R A I A N</th>
              <th className={styles.colPrice}>
                HARGA
                <br />
                SATUAN
              </th>
              <th className={styles.colTotal}>
                JUMLAH
                <br />
                HARGA
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className={styles.refRow}>
              <td />
              <td>
                <u>Sesuai Order No. {order.number} Tgl. {longDate(order.date)}</u>
                {order.shippingMethod && (
                  <>
                    <br />
                    Pengiriman: {tr(order.shippingMethod.label, lang)}
                    {order.courier ? ` · ${order.courier}` : ''}
                    {order.trackingNumber ? ` · Resi ${order.trackingNumber}` : ''}
                  </>
                )}
              </td>
              <td />
              <td />
            </tr>
            {order.items.map((item) => (
              <tr key={item.productSlug} className={styles.itemRow}>
                <td className={styles.qty}>
                  {item.qty.toLocaleString('id-ID')} <small>{(item.unit || '').toUpperCase()}</small>
                </td>
                <td>
                  {tr(item.name, lang)}
                  {item.code ? <small> ({item.code})</small> : null}
                </td>
                <td className={styles.money}>
                  <span>Rp.</span>
                  <span>{formatIDR(item.unitPrice).replace(/^Rp\s?/, '')}</span>
                </td>
                <td className={styles.money}>
                  <span>Rp.</span>
                  <span>{formatIDR(item.lineTotal).replace(/^Rp\s?/, '')}</span>
                </td>
              </tr>
            ))}
            {order.discountTotal > 0 && (
              <tr className={styles.itemRow}>
                <td />
                <td>Diskon{order.voucherCode ? ` (${order.voucherCode})` : ''}</td>
                <td />
                <td className={styles.money}>
                  <span>Rp.</span>
                  <span>−{formatIDR(order.discountTotal).replace(/^Rp\s?/, '')}</span>
                </td>
              </tr>
            )}
            {order.shippingTotal > 0 && (
              <tr className={styles.itemRow}>
                <td />
                <td>Ongkos kirim{order.shippingMethod ? ` · ${tr(order.shippingMethod.label, lang)}` : ''}</td>
                <td />
                <td className={styles.money}>
                  <span>Rp.</span>
                  <span>{formatIDR(order.shippingTotal).replace(/^Rp\s?/, '')}</span>
                </td>
              </tr>
            )}
            {(order.fees || []).map((fee) => (
              <tr key={fee.id} className={styles.itemRow}>
                <td />
                <td>{tr(fee.name, lang)}</td>
                <td />
                <td className={styles.money}>
                  <span>Rp.</span>
                  <span>{formatIDR(fee.amount).replace(/^Rp\s?/, '')}</span>
                </td>
              </tr>
            ))}
            {order.uniqueCode > 0 && (
              <tr className={styles.itemRow}>
                <td />
                <td>Kode unik transfer</td>
                <td />
                <td className={styles.money}>
                  <span>Rp.</span>
                  <span>{order.uniqueCode.toLocaleString('id-ID')}</span>
                </td>
              </tr>
            )}
            <tr className={styles.spacer}>
              <td colSpan={4} />
            </tr>
            <tr className={styles.payRow}>
              <td rowSpan={4} colSpan={2} className={styles.payCell}>
                <u>Pembayaran</u>
                <br />
                {bank ? (
                  <>
                    Pembayaran di transfer ke rekening {companyName} pada {bank.bankName} AC No. {bank.accountNumber} a.n. {bank.accountHolder}
                  </>
                ) : (
                  <>Pembayaran melalui {paidPayment ? tr(paidPayment.methodName, lang) || paidPayment.method : 'metode yang dipilih saat checkout'}.</>
                )}
                {order.paidAt && (
                  <>
                    <br />
                    <em>{cancelled ? `Dibayar ${longDate(order.paidAt)} · order dibatalkan` : `Lunas ${longDate(order.paidAt)}`}</em>
                  </>
                )}
              </td>
              <td className={styles.sumLabel}>Jumlah</td>
              <td className={styles.money}>
                <span>Rp.</span>
                <span>{formatIDR(beforeTax).replace(/^Rp\s?/, '')}</span>
              </td>
            </tr>
            <tr className={styles.payRow}>
              <td className={styles.sumLabel}>{taxLabel}</td>
              <td className={styles.money}>
                <span>Rp.</span>
                <span>{formatIDR(order.taxTotal).replace(/^Rp\s?/, '')}</span>
              </td>
            </tr>
            <tr className={`${styles.payRow} ${styles.totalRow}`}>
              <td className={styles.sumLabel}>TOTAL</td>
              <td className={styles.money}>
                <span>Rp.</span>
                <span>{formatIDR(order.grandTotal).replace(/^Rp\s?/, '')}</span>
              </td>
            </tr>
            <tr className={styles.payRow}>
              <td colSpan={2} className={styles.words}>
                Terbilang :<br />
                <em>{terbilangRupiah(order.grandTotal)}</em>
              </td>
            </tr>
          </tbody>
        </table>

        <div className={styles.foot}>
          <div className={styles.cc}>
            {(invoice?.cc || '')
              .split(/[,;]/)
              .map((c) => c.trim())
              .filter(Boolean)
              .map((c, i) => (
                <span key={c}>
                  {i === 0 ? 'cc. : ' : ''}
                  {c}
                </span>
              ))}
          </div>
          <div className={styles.sign}>
            <strong>{companyName}</strong>
            <span className={styles.signSpace} />
            {invoice?.signerName && <u>{invoice.signerName}</u>}
            {invoice?.signerTitle && <small>{invoice.signerTitle}</small>}
          </div>
        </div>

        <footer className={styles.pageFoot}>
          <span className={styles.values}>– Amanah, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif</span>
          <div className={styles.office}>
            <strong>Head Office :</strong>
            <span>{office?.address || 'Jl. Medan – Tg. Morawa Km. 9,5 Medan 20148'}</span>
            {officePhones.length > 0 && <span>Telp. {officePhones.join(' – ')}</span>}
            {officeEmail && <span>Email : {officeEmail}</span>}
          </div>
        </footer>
      </article>
    </div>
  );
}
