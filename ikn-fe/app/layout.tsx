import './globals.css';
import './shared.css';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { LanguageProvider } from '@/components/LanguageProvider';
import { CartProvider } from '@/components/CartProvider';
import { AuthProvider } from '@/components/AuthProvider';
import Script from 'next/script';
import { fetchSite } from '@/lib/server-data';
import { themeStyle } from '@/lib/theme';
import NavProgress from '@/components/NavProgress';
import ConfirmHost from '@/components/ConfirmDialog';
import type { Metadata, Viewport } from 'next';
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/seo';

// Pasangan huruf industrial: Archivo (grotesque) untuk teks & display,
// IBM Plex Mono untuk label teknis — identitas "lembar data pabrik".
// Satu-satunya sumber font: next/font (di-host sendiri, di-preload). globals.css memakai variabelnya lewat
// --font-sans / --font-mono; jangan menambah <link>/@import Google Fonts lagi (unduhan ganda + memblokir render).
const archivo = Archivo({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-archivo',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-plex-mono',
});

export const dynamic = 'force-dynamic';

const FALLBACK_TITLE = 'PT Industri Karet Nusantara — Hilir Karet Berkualitas';
const FALLBACK_DESCRIPTION =
  'PT Industri Karet Nusantara (PT IKN) adalah perusahaan hilir karet berpengalaman sejak 1965, memproduksi Resiprene 35 dan aneka barang karet dari Medan, Sumatera Utara.';

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1220' },
  ],
};

// Metadata bawaan seluruh situs: judul & deskripsi dari Pengaturan Situs → SEO bawaan, OpenGraph/Twitter untuk
// pratinjau tautan (WhatsApp, LinkedIn, Facebook), dan metadataBase dari NEXT_PUBLIC_SITE_URL (lib/seo.ts).
export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await fetchSite();
  const title = settings.seo?.default_title?.id?.trim() || FALLBACK_TITLE;
  const description = settings.seo?.default_description?.id?.trim() || FALLBACK_DESCRIPTION;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: '%s · PT IKN' },
    description,
    applicationName: 'PT Industri Karet Nusantara',
    keywords: [
      'karet', 'pabrik karet Medan', 'barang karet industri', 'rubber products Indonesia', 'Resiprene 35', 'cyclised natural rubber',
      'karet siklis', 'sarung egrek', 'sepatu boots karet', 'rubber membrane', 'PT IKN', 'PT Industri Karet Nusantara', 'PTPN III', 'hilir karet',
    ],
    authors: [{ name: 'PT Industri Karet Nusantara' }],
    creator: 'PT Industri Karet Nusantara',
    publisher: 'PT Industri Karet Nusantara',
    formatDetection: { telephone: true, email: true, address: true },
    openGraph: {
      type: 'website',
      siteName: 'PT Industri Karet Nusantara',
      locale: 'id_ID',
      alternateLocale: ['en_US'],
      title,
      description,
      images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: 'PT Industri Karet Nusantara' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: [DEFAULT_OG_IMAGE] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Analitik dari Pengaturan Situs (kosong = tidak dipasang). fetchSite di-cache per request (React cache).
  const { settings } = await fetchSite();
  const gaId = settings.analytics?.ga_measurement_id?.trim() || '';
  const gscToken = settings.analytics?.gsc_verification?.trim() || '';
  // Warna tema dari Pengaturan Situs; hanya hex valid yang disuntik (lib/theme.ts), kosong = bawaan globals.css.
  const themeCss = themeStyle(settings.theme);

  return (
    <html lang="id" className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        {gscToken && <meta name="google-site-verification" content={gscToken} />}
        {themeCss && <style id="site-theme" dangerouslySetInnerHTML={{ __html: themeCss }} />}
        {/* Anti-flash: pasang tema tersimpan sebelum paint pertama */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('lang')||'id';document.documentElement.setAttribute('lang',l);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${gaId}', { anonymize_ip: true });`}
            </Script>
          </>
        )}
        <NavProgress />
        <ConfirmHost />
        <LanguageProvider>
          <AuthProvider>
            <CartProvider>{children}</CartProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
