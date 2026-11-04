'use client';

import ExportDocument, { type ExportDocumentBaseProps } from '@/components/ExportDocument';

/**
 * Cetakan "COMMERCIAL INVOICE" berbahasa Inggris untuk order USD (ASUMSI A-88): nomor invoice dari seri yang sama
 * dengan invoice lokal, tanggal lunas, penjual/pembeli, term + pelabuhan muat/tujuan, kapal/voyage/B/L setelah dimuat,
 * syarat bayar, rincian barang, baris ongkos kapal/asuransi bila ada, pajak ekspor 0%, rekening USD, klausul biaya
 * bank, dan tanda tangan. Rute /print/invoice/{number} memilihnya lewat InvoicePrint untuk order bermata uang USD.
 */
export default function ExportInvoiceDocument(props: ExportDocumentBaseProps) {
  return <ExportDocument {...props} kind="commercial" />;
}
