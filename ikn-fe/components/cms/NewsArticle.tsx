'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { GLYPHS } from '@/components/SocialIcon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PostDetail } from '@/lib/cms';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/lib/types';
import NewsCard from './NewsCard';

// Detail berita (/berita/[slug]): band judul (tautan kembali, kategori, tanggal), sampul, isi HTML satu kolom,
// tombol bagikan, lalu berita terkait sebagai kartu.
export default function NewsArticle({ post }: { post: PostDetail }) {
  const { lang } = useLang();
  const title = tr(post.title, lang);
  const related = post.related ?? [];
  const minutes = post.readingMinutes ?? 0;
  const category = post.category ? tr(post.category.name, lang) : '';

  return (
    <>
      <section className="article-hero">
        <div className="container article-narrow">
          <Link href="/berita" className="article-back">
            <Icon name="chevronLeft" size={15} /> {lang === 'en' ? 'Back to news' : 'Kembali ke berita'}
          </Link>
          <div className="article-meta-row">
            {category && post.category && (
              <Link href={`/berita?category=${encodeURIComponent(post.category.slug)}`} className="news-cat">
                {category}
              </Link>
            )}
            <span>
              {lang === 'en' ? 'Published ' : 'Diterbitkan '}
              <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt, lang)}</time>
            </span>
            {post.author && <span>{lang === 'en' ? `By ${post.author}` : `Oleh ${post.author}`}</span>}
            {minutes > 0 && <span>{lang === 'en' ? `${minutes} min read` : `${minutes} menit baca`}</span>}
          </div>
          <h1 className="article-title">{title}</h1>
        </div>
      </section>

      <section className="section-tight article-section">
        <div className="container">
          {post.cover && (
            <figure className="article-cover">
              <Image src={post.cover.url} alt={title} fill priority sizes="(max-width: 1100px) 100vw, 1000px" style={{ objectFit: 'cover' }} />
            </figure>
          )}

          <div className="article-body-wrap">
            {/* HTML body is written in the admin WYSIWYG editor and sanitised by the API. */}
            <article className="article-body" dangerouslySetInnerHTML={{ __html: tr(post.body, lang) }} />
            <ShareBar title={title} lang={lang} />
            <nav className="article-foot" aria-label={lang === 'en' ? 'Article navigation' : 'Navigasi artikel'}>
              <Link href="/berita" className="link">
                <Icon name="chevronLeft" /> {lang === 'en' ? 'Back to all news' : 'Kembali ke daftar berita'}
              </Link>
            </nav>
          </div>

          {related.length > 0 && (
            <div className="article-related-grid">
              <span className="label label-green">{lang === 'en' ? '/ Related news' : '/ Berita terkait'}</span>
              <div className="news-grid" style={{ marginTop: 20 }}>
                {related.map((r) => (
                  <NewsCard key={r.slug} post={r} lang={lang} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

// Share buttons for the current URL (resolved on the client after mount).
function ShareBar({ title, lang }: { title: string; lang: Lang }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt(lang === 'en' ? 'Copy this link:' : 'Salin tautan ini:', url);
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(title);
  const targets: Array<{ key: string; label: string; href: string; icon: ReactNode }> = [
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, icon: GLYPHS.whatsapp },
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, icon: GLYPHS.facebook },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, icon: GLYPHS.x },
    { key: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, icon: GLYPHS.linkedin },
  ];

  return (
    <div className="article-share">
      <span className="label">{lang === 'en' ? '/ Share' : '/ Bagikan'}</span>
      <div className="article-share-row">
        {targets.map((s) => (
          <a
            key={s.key}
            className="article-share-btn"
            href={url ? s.href : '#'}
            target="_blank"
            rel="noopener noreferrer"
            title={s.label}
            aria-label={`${lang === 'en' ? 'Share on' : 'Bagikan ke'} ${s.label}`}
            aria-disabled={!url}
          >
            {s.icon}
          </a>
        ))}
        <button type="button" className={`article-share-btn${copied ? ' is-done' : ''}`} onClick={() => void copy()} title={lang === 'en' ? 'Copy link' : 'Salin tautan'}>
          {copied ? shareIcons.check : shareIcons.link}
          <span>{copied ? (lang === 'en' ? 'Copied' : 'Tersalin') : lang === 'en' ? 'Copy link' : 'Salin tautan'}</span>
        </button>
      </div>
    </div>
  );
}

const shareIcons = {
  link: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
};
