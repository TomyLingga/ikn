'use client';

import ExportDocument, { type ExportDocumentBaseProps } from '@/components/ExportDocument';

/**
 * Cetakan "PROFORMA INVOICE" berbahasa Inggris (ASUMSI A-88): nomor tetap `PI/{order}` + tanda revisi, tanggal terbit,
 * masa berlaku, penjual/pembeli, term serah terima, pelabuhan, kapal/jadwal, syarat bayar, rincian barang dalam mata
 * uang order, rekening USD, klausul biaya bank, catatan, dan tanda tangan. Dibuka dari /print/proforma/{number}.
 */
export default function ProformaDocument(props: ExportDocumentBaseProps) {
  return <ExportDocument {...props} kind="proforma" />;
}
