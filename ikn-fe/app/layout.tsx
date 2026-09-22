import './globals.css';
import './shared.css';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { LanguageProvider } from '@/components/LanguageProvider';
import { CartProvider } from '@/components/CartProvider';
import { AuthProvider } from '@/components/AuthProvider';
import { TransactionProvider } from '@/components/TransactionProvider';

// Pasangan huruf industrial: Archivo (grotesque) untuk teks & display,
// IBM Plex Mono untuk label teknis — identitas "lembar data pabrik".
const archivo = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${archivo.variable} ${plexMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,400..700;1,400..700&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Anti-flash: pasang tema tersimpan sebelum paint pertama */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var l=localStorage.getItem('lang')||'id';document.documentElement.setAttribute('lang',l);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <TransactionProvider>
              <CartProvider>{children}</CartProvider>
            </TransactionProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
