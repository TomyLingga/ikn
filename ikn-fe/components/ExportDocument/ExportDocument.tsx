'use client';

import Image from 'next/image';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { useOrderForPrint } from '@/components/InvoiceDocument/useOrderForPrint';
import sheet from '@/components/InvoiceDocument/InvoiceDocument.module.css';
import { tr, type SiteData } from '@/lib/cms';
import { isPortAddress } from '@/lib/commerce';
import { countryName, useCountries } from '@/lib/countries';
import { formatMoney } from '@/lib/format';
import type { CommerceConfig, Order } from '@/lib/types';
import styles from './ExportDocument.module.css';

export type ExportDocumentKind = 'proforma' | 'commercial';

export interface ExportDocumentBaseProps {
  number: string;
  site: SiteData;
  config: CommerceConfig | null;
  /** Order yang sudah dimuat pemanggil (pemilih dokumen InvoicePrint); tanpa ini komponen memuat sendiri. */
  order?: Order | null;
}

export interface ExportDocumentProps extends ExportDocumentBaseProps {
  kind: ExportDocumentKind;
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "03 November 2026" dari ISO ber-offset atau tanggal polos YYYY-MM-DD (tanggal polos dibaca apa adanya, tanpa geser zona). */
function longDateEn(value: string | null | undefined): string {
  if (!value) return '';
  const plain = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plain) return `${plain[3]} ${MONTHS_EN[Number(plain[2]) - 1]} ${plain[1]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getDate().toString().padStart(2, '0')} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Dokumen ekspor berbahasa Inggris (ASUMSI A-88) untuk order customer ekspor: `kind = 'proforma'` mencetak PROFORMA
 * INVOICE dari `order.proforma` (nomor PI/{order} tetap + tanda revisi), `kind = 'commercial'` mencetak COMMERCIAL
 * INVOICE dari `order.invoiceNumber` (seri yang sama dengan invoice lokal). Keduanya: kop/kaki gambar dari Pengaturan
 * Situs (A-83), penjual dari pengaturan situs, pembeli dari snapshot order, term serah terima + pelabuhan, kapal/B/L,
 * syarat bayar, rincian barang dalam mata uang order, baris ongkos kapal/asuransi bila backend mengirim
 * `shippingMethod.lines` (Phase E5), pajak ekspor, rekening USD, klausul biaya bank, dan tanda tangan.
 * Teks dokumen selalu Inggris; hanya pesan status (memuat/galat) mengikuti bahasa antarmuka.
 */
export default function ExportDocument({ number, site, config, order: preloaded, kind }: ExportDocumentProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const { order, error } = useOrderForPrint(number, preloaded);
  const { countries } = useCountries();

  const office = site.contact?.locations?.[0];
  const officePhones = (office?.phones || []).map((p) => p.number).filter(Boolean);
  const officeEmail = site.contact?.emails?.[0]?.address || '';
  const companyName = (site.settings.company?.name || 'PT Industri Karet Nusantara').toUpperCase();
  const invoice = config?.invoice;
  // Kop & kaki dari gambar (Pengaturan Situs, A-83); tanpa gambar = dirender dari teks seperti invoice lokal.
  const headerImage = site.settings.invoice?.header_image?.url || '';
  const footerImage = site.settings.invoice?.footer_image?.url || '';
  const city = (site.settings.company?.location || 'Medan').split(',')[0] || 'Medan';
  const isProforma = kind === 'proforma';

  if (error) {
    return (
      <div className={sheet.state}>
        <p>{error}</p>
      </div>
    );
  }
  if (!order) {
    return (
      <div className={sheet.state}>
        <p>{t('Menyiapkan dokumen…', 'Preparing the document…')}</p>
      </div>
    );
  }
  const proforma = order.proforma || null;
  if (isProforma && !proforma) {
    return (
      <div className={sheet.state}>
        <p>{t('Proforma invoice belum dibuat untuk pesanan ini.', 'No proforma invoice has been issued for this order yet.')}</p>
      </div>
    );
  }

  const portAddress = isPortAddress(order.shippingAddress) ? order.shippingAddress : null;
  const paidPayment = order.payments.find((p) => p.status === 'paid') || order.activePayment || order.payment || null;
  // awaiting_freight belum punya payment (A-89): rekening diambil dari metode yang ditunda lewat daftar rekening config.
  const pendingBankId = order.pendingPaymentMethod?.bankAccountId ?? null;
  const bank = paidPayment?.bankAccount || (pendingBankId != null ? config?.bankAccounts?.find((b) => b.id === pendingBankId) || null : null);
  const currency = order.currency;
  // Angka tanpa kode mata uang; kolom menampilkan kodenya sendiri.
  const money = (value: number | null | undefined) => formatMoney(value, currency).replace(/^[−-]?(Rp|USD|IDR)\s?/, (m) => (m.startsWith('−') || m.startsWith('-') ? '−' : ''));
  const cancelled = order.status === 'cancelled' || order.status === 'expired';
  const unpaid = !order.paidAt;

  const title = isProforma ? 'PROFORMA INVOICE' : 'COMMERCIAL INVOICE';
  const docNumber = isProforma ? proforma!.number : order.invoiceNumber || `(pending) ${order.number}`;
  const docDate = isProforma ? proforma!.issuedAt || proforma!.updatedAt : order.paidAt || order.date;
  const revision = proforma?.revision ?? 1;

  // Term serah terima dan pelabuhan: proforma memakai isian admin, commercial invoice memakai snapshot order.
  const destination = order.destinationPort ? [order.destinationPort.name, order.destinationPort.country].filter(Boolean).join(', ') : '';
  // Term CIF (ASUMSI A-89): teks term memuat pelabuhan tujuan, "CIF Port Klang", seperti lazimnya di dokumen ekspor.
  const quotedFreight = order.deliveryTerm?.pricingMode === 'quoted' || order.shippingMethod?.type === 'quoted';
  const termName = quotedFreight && order.destinationPort
    ? `CIF ${order.destinationPort.name}`
    : tr(order.deliveryTerm?.name ?? portAddress?.label, 'en') || order.deliveryTerm?.code || '';
  const portOfLoading = (isProforma ? proforma!.portOfLoading : null) || portAddress?.loadingPort || order.deliveryTerm?.loadingPort || '';
  const portOfDischarge = (isProforma ? proforma!.portOfDischarge : null) || destination;
  const vessel = isProforma ? proforma!.vesselName : order.shipmentDetails?.vessel ?? null;
  const voyage = isProforma ? proforma!.voyage : order.shipmentDetails?.voyage ?? null;
  const paymentTerms = (isProforma ? proforma!.paymentTerms : null) || tr(order.paymentTerm?.description, 'en') || tr(order.paymentTerm?.name, 'en') || '';
  const buyerName = portAddress?.companyName || order.customer.company || order.customer.name;
  const buyerAddress = portAddress?.companyAddress || order.customer.companyAddress || '';
  const buyerCountry = countryName(portAddress?.countryCode || order.customer.countryCode, 'en', countries);

  // Baris ongkos kapal/asuransi (Phase E5): dicetak per baris bila ada; tanpa rincian, total ongkir > 0 jadi satu baris "Freight".
  const freightLines = (order.shippingMethod?.lines || []).map((line) => ({ label: typeof line.label === 'string' ? line.label : tr(line.label, 'en'), amount: line.amount }));
  const showFreightTotal = freightLines.length === 0 && order.shippingTotal > 0;
  // CIF sebelum penawaran ongkir diterima: ongkos kapal belum masuk total, jadi total diberi label "goods" agar tidak menyesatkan.
  const freightPending = quotedFreight && (order.status === 'awaiting_freight' || (freightLines.length === 0 && !(order.shippingTotal > 0)));
  const taxRate = order.taxRate ?? 0;
  const taxLabel = taxRate === 0 ? 'VAT 0% (export)' : `VAT ${taxRate}%${order.priceIncludesTax ? ' (included)' : ''}`;
  const blDateText = longDateEn(order.shipmentDetails?.blDate);

  return (
    <div className={sheet.sheetWrap}>
      <div className={`${sheet.toolbar} no-print`}>
        <button type="button" className={sheet.printBtn} onClick={() => window.print()}>
          <Icon name="arrowDown" size={16} /> {t('Cetak / simpan PDF', 'Print / save PDF')}
        </button>
        <span>{t('Pastikan ukuran kertas A4, potret.', 'Use A4 paper, portrait.')}</span>
      </div>

      <article className={sheet.sheet}>
        {headerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={headerImage} alt={companyName} className={sheet.headImage} />
        ) : (
          <>
            <header className={sheet.head}>
              <div className={sheet.headLeft}>
                <Image src="/img/rubin-logo.png" alt="" width={74} height={74} priority />
                <div>
                  <h1>{companyName}</h1>
                  <p>(NUSANTARA RUBBER INDUSTRY)</p>
                </div>
              </div>
              <div className={sheet.headRight}>
                <strong>{site.settings.company?.parent || 'PTPN III (Persero)'}</strong>
                <span>{tr(site.settings.site?.subsidiary_note, 'en') || 'Subsidiary of PTPN III (Persero)'}</span>
              </div>
            </header>
            <div className={sheet.rule} />
          </>
        )}

        <p className={sheet.dateline}>
          {city}, {longDateEn(docDate)}
        </p>

        <div className={sheet.titleBlock}>
          <h2>{title}</h2>
          <p className={sheet.number}>
            No. <b>{docNumber}</b>
          </p>
          <div className={styles.stamps}>
            {cancelled ? (
              <p className={sheet.proforma}>{order.status === 'expired' ? 'Expired, void' : 'Cancelled, void'}</p>
            ) : isProforma ? (
              revision > 1 && <p className={sheet.proforma}>Revision {revision}</p>
            ) : (
              unpaid && <p className={sheet.proforma}>Unpaid</p>
            )}
          </div>
        </div>

        <div className={styles.meta}>
          <div className={styles.metaRow}>
            <span>Order No.</span>
            <strong>{order.number}</strong>
          </div>
          <div className={styles.metaRow}>
            <span>Order date</span>
            <span>{longDateEn(order.date)}</span>
          </div>
          {isProforma ? (
            <>
              <div className={styles.metaRow}>
                <span>Date issued</span>
                <span>{longDateEn(proforma!.issuedAt)}</span>
              </div>
              <div className={styles.metaRow}>
                <span>Valid until</span>
                <span>{proforma!.validUntil ? longDateEn(proforma!.validUntil) : 'Not stated'}</span>
              </div>
              {revision > 1 && (
                <div className={styles.metaRow}>
                  <span>Revised</span>
                  <span>
                    {longDateEn(proforma!.updatedAt)} (Rev.{revision})
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.metaRow}>
                <span>Invoice date</span>
                <span>{order.paidAt ? longDateEn(order.paidAt) : 'Issued on payment'}</span>
              </div>
              {proforma && (
                <div className={styles.metaRow}>
                  <span>Proforma ref.</span>
                  <span>{proforma.label}</span>
                </div>
              )}
            </>
          )}
          <div className={styles.metaRow}>
            <span>Currency</span>
            <span>{currency}</span>
          </div>
        </div>

        <div className={styles.parties}>
          <div className={styles.party}>
            <h3>Seller</h3>
            <p>
              <strong>{companyName}</strong>
              {office?.address || 'Jl. Medan – Tg. Morawa Km. 9,5 Medan 20148'}
              <br />
              Indonesia
              {officePhones.length > 0 && (
                <>
                  <br />
                  Tel. {officePhones.join(' / ')}
                </>
              )}
              {officeEmail && (
                <>
                  <br />
                  {officeEmail}
                </>
              )}
            </p>
          </div>
          <div className={styles.party}>
            <h3>Buyer</h3>
            <p>
              <strong>{buyerName}</strong>
              {buyerAddress && (
                <>
                  {buyerAddress}
                  <br />
                </>
              )}
              {buyerCountry && (
                <>
                  {buyerCountry}
                  <br />
                </>
              )}
              Attn. {portAddress?.recipientName || order.customer.pic || order.customer.name}
              {order.customer.email && (
                <>
                  <br />
                  {order.customer.email}
                </>
              )}
              {(portAddress?.phone || order.customer.phone) && (
                <>
                  <br />
                  {portAddress?.phone || order.customer.phone}
                </>
              )}
            </p>
          </div>
        </div>

        <section className={styles.section}>
          <h3>Delivery and payment</h3>
          <div className={styles.kvTwo}>
            <dl className={styles.kv}>
              <dt>Delivery term</dt>
              <dd>{termName || 'As agreed'}</dd>
              <dt>Port of loading</dt>
              <dd>{portOfLoading || 'As agreed'}</dd>
              <dt>Port of discharge</dt>
              <dd>{portOfDischarge || (isProforma ? 'To be advised' : 'As agreed')}</dd>
              {!isProforma && destination && portOfDischarge !== destination && (
                <>
                  <dt>Destination</dt>
                  <dd>{destination}</dd>
                </>
              )}
            </dl>
            <dl className={styles.kv}>
              {isProforma ? (
                <>
                  <dt>Vessel / voyage</dt>
                  <dd>{vessel ? `${vessel}${voyage ? ` / ${voyage}` : ''}` : 'To be advised'}</dd>
                  <dt>ETD</dt>
                  <dd>{proforma!.etd ? longDateEn(proforma!.etd) : 'To be advised'}</dd>
                  <dt>ETA</dt>
                  <dd>{proforma!.eta ? longDateEn(proforma!.eta) : 'To be advised'}</dd>
                </>
              ) : order.shipmentDetails ? (
                <>
                  <dt>Vessel / voyage</dt>
                  <dd>{vessel ? `${vessel}${voyage ? ` / ${voyage}` : ''}` : 'As per B/L'}</dd>
                  <dt>B/L No.</dt>
                  <dd>{order.shipmentDetails.blNumber || 'As per B/L'}</dd>
                  <dt>B/L date</dt>
                  <dd>{blDateText || (order.shippedAt ? longDateEn(order.shippedAt) : 'As per B/L')}</dd>
                </>
              ) : (
                <>
                  <dt>Shipment</dt>
                  <dd>Vessel and B/L details follow when the goods are shipped on board.</dd>
                </>
              )}
              <dt>Payment terms</dt>
              <dd>{paymentTerms || 'As agreed'}</dd>
            </dl>
          </div>
        </section>

        <section className={styles.section}>
          <h3>Goods</h3>
          <table className={sheet.table}>
            <thead>
              <tr>
                <th className={styles.colNo}>No.</th>
                <th className={styles.colItem}>Description</th>
                <th className={styles.colQty}>Quantity</th>
                <th className={styles.colPrice}>
                  Unit price
                  <br />({currency})
                </th>
                <th className={styles.colAmount}>
                  Amount
                  <br />({currency})
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={item.id ?? item.productSlug} className={styles.itemRow}>
                  <td className={styles.center}>{index + 1}</td>
                  <td>
                    {tr(item.name, 'en')}
                    {item.code ? <small>Product code {item.code}</small> : null}
                  </td>
                  <td className={styles.num}>
                    {item.qty.toLocaleString('en-US')} {item.unit || ''}
                  </td>
                  <td className={styles.num}>{money(item.unitPrice)}</td>
                  <td className={styles.num}>{money(item.lineTotal)}</td>
                </tr>
              ))}
              <tr className={styles.sumRow}>
                <td colSpan={4}>Subtotal</td>
                <td className={styles.num}>{money(order.subtotal)}</td>
              </tr>
              {order.discountTotal > 0 && (
                <tr className={styles.sumRow}>
                  <td colSpan={4}>Discount{order.voucherCode ? ` (${order.voucherCode})` : ''}</td>
                  <td className={styles.num}>−{money(order.discountTotal)}</td>
                </tr>
              )}
              {freightLines.map((line, index) => (
                <tr key={`${line.label}-${index}`} className={styles.sumRow}>
                  <td colSpan={4}>{line.label}</td>
                  <td className={styles.num}>{money(line.amount)}</td>
                </tr>
              ))}
              {freightPending && (
                <tr className={`${styles.sumRow} ${styles.sumMuted}`}>
                  <td colSpan={4}>Ocean freight and insurance</td>
                  <td className={styles.num}>To be quoted</td>
                </tr>
              )}
              {showFreightTotal && (
                <tr className={styles.sumRow}>
                  <td colSpan={4}>Freight{order.shippingMethod?.label ? ` (${tr(order.shippingMethod.label, 'en')})` : ''}</td>
                  <td className={styles.num}>{money(order.shippingTotal)}</td>
                </tr>
              )}
              {(order.fees || []).map((fee) => (
                <tr key={fee.id} className={styles.sumRow}>
                  <td colSpan={4}>{tr(fee.name, 'en')}</td>
                  <td className={styles.num}>{money(fee.amount)}</td>
                </tr>
              ))}
              {(!order.fees || order.fees.length === 0) && order.feeTotal > 0 && (
                <tr className={styles.sumRow}>
                  <td colSpan={4}>Other charges</td>
                  <td className={styles.num}>{money(order.feeTotal)}</td>
                </tr>
              )}
              <tr className={`${styles.sumRow} ${order.priceIncludesTax ? styles.sumMuted : ''}`}>
                <td colSpan={4}>{taxLabel}</td>
                <td className={styles.num}>{order.priceIncludesTax ? `(${money(order.taxTotal)})` : money(order.taxTotal)}</td>
              </tr>
              <tr className={`${styles.sumRow} ${styles.totalRow}`}>
                <td colSpan={4}>{freightPending ? `TOTAL, GOODS ONLY (${currency})` : `TOTAL (${currency})`}</td>
                <td className={styles.num}>{money(order.grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h3>Payment</h3>
          {bank ? (
            <dl className={styles.bank}>
              <dt>Beneficiary</dt>
              <dd>{bank.accountHolder}</dd>
              <dt>Bank</dt>
              <dd>{bank.bankName}</dd>
              <dt>Account No.</dt>
              <dd>
                {bank.accountNumber}
                {bank.currency ? ` (${bank.currency})` : ''}
              </dd>
              {bank.swiftCode && (
                <>
                  <dt>SWIFT code</dt>
                  <dd>{bank.swiftCode}</dd>
                </>
              )}
              {bank.bankAddress && (
                <>
                  <dt>Bank address</dt>
                  <dd>{bank.bankAddress}</dd>
                </>
              )}
              {bank.correspondentBank && (
                <>
                  <dt>Correspondent bank</dt>
                  <dd>{bank.correspondentBank}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className={styles.notes}>Bank transfer to the {currency} account stated in the order{paidPayment?.methodName ? ` (${tr(paidPayment.methodName, 'en')})` : ''}.</p>
          )}
          <p className={styles.clause}>All bank charges outside Indonesia are for the buyer&apos;s account.</p>
          {order.paidAt && (
            <p className={styles.paidNote}>
              {cancelled ? `Paid on ${longDateEn(order.paidAt)}; order cancelled.` : `Paid in full on ${longDateEn(order.paidAt)}.`}
            </p>
          )}
        </section>

        {isProforma && proforma!.notes && (
          <section className={styles.section}>
            <h3>Notes</h3>
            <p className={styles.notes}>{proforma!.notes}</p>
          </section>
        )}

        <div className={sheet.foot}>
          <div className={sheet.cc}>
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
          <div className={sheet.sign}>
            <strong>{companyName}</strong>
            <span className={sheet.signSpace} />
            {invoice?.signerName && <u>{invoice.signerName}</u>}
            {invoice?.signerTitle && <small>{invoice.signerTitle}</small>}
          </div>
        </div>

        {footerImage ? (
          <footer className={`${sheet.pageFoot} ${sheet.pageFootImage}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={footerImage} alt="" />
          </footer>
        ) : (
          <footer className={sheet.pageFoot}>
            <span className={sheet.values}>– Amanah, Kompeten, Harmonis, Loyal, Adaptif, Kolaboratif</span>
            <div className={sheet.office}>
              <strong>Head Office :</strong>
              <span>{office?.address || 'Jl. Medan – Tg. Morawa Km. 9,5 Medan 20148'}</span>
              {officePhones.length > 0 && <span>Tel. {officePhones.join(' – ')}</span>}
              {officeEmail && <span>Email : {officeEmail}</span>}
            </div>
          </footer>
        )}
      </article>
    </div>
  );
}
