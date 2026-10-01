// Data daftar untuk section CMS yang isinya berasal dari menu admin (berita, galeri, sertifikat, brosur, logo).
// Halaman RSC memanggil fetchSectionExtra(page.sections) lalu meneruskannya ke <SectionRenderer extra>,
// sehingga tipe section tersebut bisa dipakai di halaman mana pun (termasuk halaman buatan admin)
// tanpa menambah fetch khusus per halaman. Hanya data yang tipenya ada di halaman yang diambil.

import type { PageSection } from '@/lib/cms';
import type { SectionExtra } from '@/components/cms/SectionRenderer';
import { fetchBrochures, fetchCertificates, fetchCustomerLogos, fetchGallery, fetchNews } from '@/lib/server-data';

export async function fetchSectionExtra(sections: PageSection[]): Promise<SectionExtra> {
  const types = new Set(sections.filter((s) => s.isVisible !== false).map((s) => s.type));
  const when = <T>(type: string, load: () => Promise<T>): Promise<T | undefined> => (types.has(type) ? load() : Promise.resolve(undefined));

  const [news, latestNews, gallery, certificates, brochures, customerLogos] = await Promise.all([
    when('news', () => fetchNews()),
    when('latest_news', () => fetchNews()),
    when('gallery', fetchGallery),
    when('certificates', fetchCertificates),
    when('brochures', fetchBrochures),
    when('customer_logos', fetchCustomerLogos),
  ]);

  return { news, latestNews, gallery, certificates, brochures, customerLogos };
}
