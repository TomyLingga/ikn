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

export const metadata = {
  metadataBase: new URL('https://ikn.co.id'),
  title: {
    default: 'PT Industri Karet Nusantara — Hilir Karet Berkualitas',
    template: '%s · PT IKN',
  },
  description:
    'PT Industri Karet Nusantara (PT IKN) adalah perusahaan hilir karet berpengalaman sejak 1965, memproduksi Resiprene 35 dan aneka barang karet dari Medan, Sumatera Utara.',
  keywords: ['karet', 'rubber', 'Resiprene', 'PT IKN', 'Medan', 'hilir karet'],
};

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
