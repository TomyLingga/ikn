import ProformaDocument from '@/components/ProformaDocument';
import { fetchCommerceConfig, fetchSite } from '@/lib/server-data';

export function generateMetadata({ params }: { params: { number: string } }) {
  return { title: `Proforma ${params.number}` };
}

// Cetakan proforma invoice berbahasa Inggris (ASUMSI A-88). Sama dengan rute invoice: kop, kantor pusat, dan
// penanda tangan diambil di server; order (beserta `proforma`) dimuat di klien dengan sesi customer pemilik atau admin.
export default async function ProformaPrintPage({ params }: { params: { number: string } }) {
  const [site, config] = await Promise.all([fetchSite(), fetchCommerceConfig()]);

  return <ProformaDocument number={params.number} site={site} config={config} />;
}
