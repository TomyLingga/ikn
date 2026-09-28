'use client';

import EmptyState from '@/components/EmptyState';
import { useLang } from '@/components/LanguageProvider';

const copy = {
  page: {
    id: {
      title: 'Konten belum tersedia',
      body: 'Halaman ini belum dapat dimuat dari CMS. Silakan coba lagi beberapa saat lagi.',
      action: 'Kembali ke beranda',
    },
    en: {
      title: 'Content not available',
      body: 'This page could not be loaded from the CMS. Please try again shortly.',
      action: 'Back to home',
    },
  },
  news: {
    id: {
      title: 'Berita tidak ditemukan',
      body: 'Artikel yang Anda cari tidak tersedia atau sudah tidak dipublikasikan.',
      action: 'Kembali ke berita',
    },
    en: {
      title: 'Article not found',
      body: 'The article you are looking for is unavailable or no longer published.',
      action: 'Back to news',
    },
  },
};

// Small fallback when a CMS page (or a news post) cannot be loaded.
export default function PageFallback({ variant = 'page' }: { variant?: 'page' | 'news' }) {
  const { lang } = useLang();
  const text = copy[variant][lang] || copy[variant].id;
  const href = variant === 'news' ? '/berita' : '/';

  return (
    <section className="section-tight" style={{ paddingTop: 'calc(var(--nav-h) + var(--nav-gap) + 40px)' }}>
      <div className="container">
        <EmptyState icon="compass" title={text.title} body={text.body} action={{ href, label: text.action }} />
      </div>
    </section>
  );
}
