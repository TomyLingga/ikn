'use client';

import { useLang } from '@/components/LanguageProvider';
import ExportInvoiceDocument from '@/components/ExportInvoiceDocument';
import ProformaDocument from '@/components/ProformaDocument';
import type { SiteData } from '@/lib/cms';
import type { CommerceConfig } from '@/lib/types';
import InvoiceDocument from './InvoiceDocument';
import { useOrderForPrint } from './useOrderForPrint';
import styles from './InvoiceDocument.module.css';

interface InvoicePrintProps {
  number: string;
  site: SiteData;
  config: CommerceConfig | null;
}

/**
 * Pemilih dokumen rute /print/invoice/{number} (ASUMSI A-88). Order dimuat sekali di sini dengan sesi pengguna lalu
 * diteruskan ke dokumen agar tidak diambil dua kali:
 * - order IDR: InvoiceDocument (format dokumen klien, tidak berubah);
 * - order USD yang belum dibayar dan sudah punya proforma: ProformaDocument (dokumen yang berlaku sebelum lunas);
 * - order USD lainnya: ExportInvoiceDocument (commercial invoice berbahasa Inggris; tanda UNPAID bila belum lunas).
 */
export default function InvoicePrint({ number, site, config }: InvoicePrintProps) {
  const { lang } = useLang();
  const { order, error } = useOrderForPrint(number);

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
        <p>{lang === 'en' ? 'Preparing the invoice…' : 'Menyiapkan invoice…'}</p>
      </div>
    );
  }
  if (order.currency !== 'USD') {
    return <InvoiceDocument number={number} site={site} config={config} order={order} />;
  }
  if (!order.paidAt && order.proforma) {
    return <ProformaDocument number={number} site={site} config={config} order={order} />;
  }
  return <ExportInvoiceDocument number={number} site={site} config={config} order={order} />;
}
