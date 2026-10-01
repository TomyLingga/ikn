import InvoiceDocument from '@/components/InvoiceDocument';
import { fetchCommerceConfig, fetchSite } from '@/lib/server-data';

export function generateMetadata({ params }: { params: { number: string } }) {
  return { title: `Invoice ${params.number}` };
}

// Data perusahaan (kop, kantor pusat) dan teks invoice diambil di server; order dimuat di klien dengan sesi
// pengguna (customer pemilik atau admin), sehingga halaman ini tidak pernah membocorkan order lewat URL.
export default async function InvoicePrintPage({ params }: { params: { number: string } }) {
  const [site, config] = await Promise.all([fetchSite(), fetchCommerceConfig()]);

  return <InvoiceDocument number={params.number} site={site} config={config} />;
}
