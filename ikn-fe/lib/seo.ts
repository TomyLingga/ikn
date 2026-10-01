// SEO bersama: URL situs kanonik, metadata OpenGraph/Twitter, dan data terstruktur schema.org (JSON-LD) untuk Google.
// URL situs dari NEXT_PUBLIC_SITE_URL (mis. https://ikn.co.id); dipakai metadataBase, canonical, sitemap, dan JSON-LD.
import type { Metadata } from 'next';
import type { PostDetail, SiteData } from '@/lib/cms';
import type { ProductDetail } from '@/lib/types';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ikn.co.id').replace(/\/+$/, '');
export const DEFAULT_OG_IMAGE = '/img/pabrik-2-1.png';

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

/** Ringkas teks untuk meta description (maks. ±160 karakter, tanpa HTML). */
export function metaDescription(text: string | null | undefined, max = 160): string {
  const clean = (text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

/** Metadata halaman publik lengkap: judul, deskripsi, canonical, OpenGraph, Twitter card. */
export function buildMetadata(options: {
  title: string;
  /** true = judul tanpa template " · PT IKN" (beranda memakai judul lengkapnya sendiri). */
  absoluteTitle?: boolean;
  description?: string;
  path: string;
  image?: string | null;
  type?: 'website' | 'article';
  publishedTime?: string | null;
  noindex?: boolean;
}): Metadata {
  const description = metaDescription(options.description);
  const image = absoluteUrl(options.image || DEFAULT_OG_IMAGE);
  return {
    title: options.absoluteTitle ? { absolute: options.title } : options.title,
    ...(description ? { description } : {}),
    alternates: { canonical: absoluteUrl(options.path) },
    openGraph: {
      type: options.type || 'website',
      url: absoluteUrl(options.path),
      title: options.title,
      ...(description ? { description } : {}),
      siteName: 'PT Industri Karet Nusantara',
      locale: 'id_ID',
      images: [{ url: image }],
      ...(options.publishedTime ? { publishedTime: options.publishedTime } : {}),
    },
    twitter: { card: 'summary_large_image', title: options.title, ...(description ? { description } : {}), images: [image] },
    ...(options.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

type JsonLd = Record<string, unknown>;

/** Organisasi (Google Knowledge Panel): nama, logo, alamat, telepon, email, media sosial. */
export function organizationJsonLd(site: SiteData): JsonLd {
  const company = site.settings.company;
  const location = site.contact?.locations?.[0];
  const phones = (site.contact?.locations ?? []).flatMap((l) => l.phones.map((p) => p.number)).filter(Boolean);
  const sameAs = (site.contact?.social ?? []).map((s) => s.url).filter((u) => /^https?:\/\//.test(u));
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: company?.name || 'PT Industri Karet Nusantara',
    alternateName: company?.short || 'PT IKN',
    url: SITE_URL,
    logo: absoluteUrl('/img/rubin-logo.png'),
    foundingDate: company?.since || '1965',
    ...(company?.parent ? { parentOrganization: { '@type': 'Organization', name: company.parent } } : {}),
    ...(location
      ? {
          address: { '@type': 'PostalAddress', streetAddress: location.address, addressLocality: 'Medan', addressRegion: 'Sumatera Utara', addressCountry: 'ID' },
          ...(location.geo?.lat != null && location.geo?.lng != null ? { location: { '@type': 'Place', geo: { '@type': 'GeoCoordinates', latitude: location.geo.lat, longitude: location.geo.lng } } } : {}),
        }
      : {}),
    ...(phones.length ? { telephone: phones[0], contactPoint: phones.map((telephone) => ({ '@type': 'ContactPoint', telephone, contactType: 'sales', areaServed: 'ID', availableLanguage: ['id', 'en'] })) } : {}),
    ...(site.contact?.emails?.[0]?.address ? { email: site.contact.emails[0].address } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** Situs + kotak pencarian (sitelinks search box) mengarah ke katalog. */
export function websiteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'PT Industri Karet Nusantara',
    inLanguage: 'id-ID',
    publisher: { '@id': `${SITE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/catalog?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: absoluteUrl(item.path) })),
  };
}

/** Produk: harga rupiah, ketersediaan, merek, rating ulasan (rich result harga & bintang di Google). */
export function productJsonLd(product: ProductDetail): JsonLd {
  const images = (product.images ?? []).filter((img) => img.type !== 'video').map((img) => absoluteUrl(img.url));
  const price = product.effectivePrice ?? product.price;
  const availability =
    product.stockStatus === 'made_to_order'
      ? 'https://schema.org/PreOrder'
      : product.available > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name.id,
    sku: product.code,
    mpn: product.code,
    ...(images.length ? { image: images } : product.image ? { image: [absoluteUrl(product.image)] } : {}),
    description: metaDescription(product.summary?.id || product.name.id, 300),
    brand: { '@type': 'Brand', name: 'PT Industri Karet Nusantara' },
    ...(product.category ? { category: product.category.name?.id } : {}),
    ...(price != null && product.priceMode === 'fixed'
      ? {
          offers: {
            '@type': 'Offer',
            url: absoluteUrl(`/catalog/${product.slug}`),
            priceCurrency: 'IDR',
            price,
            availability,
            itemCondition: 'https://schema.org/NewCondition',
            seller: { '@id': `${SITE_URL}/#organization` },
          },
        }
      : {}),
    ...(product.reviewCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.reviewCount } } : {}),
  };
}

export function articleJsonLd(post: PostDetail): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: post.title.id,
    ...(post.cover?.url ? { image: [absoluteUrl(post.cover.url)] } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.author ? { author: { '@type': 'Person', name: post.author } } : { author: { '@id': `${SITE_URL}/#organization` } }),
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: absoluteUrl(`/berita/${post.slug}`),
    description: metaDescription(post.excerpt?.id),
  };
}
