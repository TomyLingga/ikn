import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// robots.txt: situs publik boleh dirayapi; area login, portal customer, admin, keranjang/checkout, dan cetakan tidak.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard', '/login', '/register', '/forgot-password', '/reset-password', '/cart', '/checkout', '/print', '/cache'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
