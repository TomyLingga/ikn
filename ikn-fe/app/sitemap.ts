import type { MetadataRoute } from 'next';
import { fetchCategories, fetchNews, fetchProducts, fetchSite } from '@/lib/server-data';
import type { MenuNode } from '@/lib/cms';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

// Halaman bawaan + halaman CMS yang ada di menu + kategori & produk katalog + berita. Dibuat ulang tiap jam.
const STATIC_PAGES: [string, number, MetadataRoute.Sitemap[number]['changeFrequency']][] = [
  ['/', 1, 'weekly'],
  ['/bisnis', 0.9, 'weekly'],
  ['/catalog', 0.9, 'daily'],
  ['/tentang', 0.7, 'monthly'],
  ['/keberlanjutan', 0.6, 'monthly'],
  ['/berita', 0.7, 'daily'],
  ['/media', 0.5, 'monthly'],
  ['/galeri', 0.5, 'monthly'],
  ['/kontak', 0.7, 'yearly'],
];

function menuPaths(nodes: MenuNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.url && node.url.startsWith('/') && !node.url.startsWith('//') ? [node.url.split('#')[0]!.split('?')[0]!] : []),
    ...menuPaths(node.children ?? []),
  ]);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [site, categories, news, products] = await Promise.all([
    fetchSite(),
    fetchCategories(),
    fetchNews(),
    fetchProducts({ perPage: 100 }, { cached: true }),
  ]);

  const entries = new Map<string, MetadataRoute.Sitemap[number]>();
  const add = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], lastModified: Date = now) => {
    if (!path || entries.has(path)) return;
    entries.set(path, { url: `${SITE_URL}${path === '/' ? '' : path}`, lastModified, changeFrequency, priority });
  };

  STATIC_PAGES.forEach(([path, priority, freq]) => add(path, priority, freq));
  menuPaths([...(site.menus.header.items ?? []), ...(site.menus.footer.items ?? [])])
    .filter((path) => !/^\/(admin|dashboard|login|register|cart|checkout|print)/.test(path))
    .forEach((path) => add(path, 0.5, 'monthly'));
  categories.forEach((cat) => add(`/catalog/kategori/${cat.slug}`, 0.7, 'weekly'));
  products.items.forEach((product) => add(`/catalog/${product.slug}`, 0.8, 'weekly'));
  news.forEach((post) => add(`/berita/${post.slug}`, 0.6, 'monthly', post.publishedAt ? new Date(post.publishedAt) : now));

  return [...entries.values()];
}
