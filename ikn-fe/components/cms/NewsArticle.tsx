'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PostDetail, PostSummary } from '@/lib/cms';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/lib/types';

// News post detail (/berita/[slug]): header with meta, cover, HTML body,
// share buttons and related posts in the aside.
export default function NewsArticle({ post }: { post: PostDetail }) {
  const { lang } = useLang();
  const title = tr(post.title, lang);
  const related = post.related ?? [];
  const minutes = post.readingMinutes ?? 0;

  return (
    <>
      <section className="pagehead commerce-head article-head">
        <div className="container">
          <Breadcrumb
            items={[
              { label: lang === 'en' ? 'Home' : 'Beranda', href: '/' },
              { label: lang === 'en' ? 'News' : 'Berita', href: '/berita' },
              { label: title },
            ]}
          />
          {post.tag && <span className="label label-amber">/ {post.tag}</span>}
          <h1 className="article-title">{title}</h1>
          <div className="article-meta">
            <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt, lang)}</time>
            {post.author && <span>{lang === 'en' ? `By ${post.author}` : `Oleh ${post.author}`}</span>}
            {minutes > 0 && <span>{lang === 'en' ? `${minutes} min read` : `${minutes} menit baca`}</span>}
          </div>
        </div>
      </section>

      <section className="section-tight article-section">
        <div className="container">
          {post.cover && (
            <figure className="article-cover">
              <Image src={post.cover.url} alt={title} fill priority sizes="(max-width: 1200px) 100vw, 1144px" style={{ objectFit: 'cover' }} />
            </figure>
          )}

          <div className="article-wrap">
            <div className="article-main">
              {/* HTML body is written in the admin WYSIWYG editor and sanitised by the API. */}
              <article className="article-body" dangerouslySetInnerHTML={{ __html: tr(post.body, lang) }} />
              <nav className="article-foot" aria-label={lang === 'en' ? 'Article navigation' : 'Navigasi artikel'}>
                <Link href="/berita" className="link">
                  <Icon name="chevronLeft" /> {lang === 'en' ? 'Back to all news' : 'Kembali ke daftar berita'}
                </Link>
              </nav>
            </div>

            <aside className="article-aside">
              <ShareBar title={title} lang={lang} />

              {related.length > 0 && (
                <div className="article-related-block">
                  <span className="label label-green">{lang === 'en' ? '/ Related news' : '/ Berita terkait'}</span>
                  <div className="article-related">
                    {related.map((r) => (
                      <RelatedItem key={r.slug} post={r} lang={lang} />
                    ))}
                  </div>
                </div>
              )}

              <Link href="/berita" className="link article-aside-all">
                {lang === 'en' ? 'All news' : 'Semua berita'} <Icon name="arrow" />
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}

function RelatedItem({ post, lang }: { post: PostSummary; lang: Lang }) {
  return (
    <Link href={`/berita/${post.slug}`} className="article-related-item">
      <span className="article-related-thumb" aria-hidden="true">
        {post.cover ? <Image src={post.cover.url} alt="" fill sizes="96px" style={{ objectFit: 'cover' }} /> : null}
      </span>
      <span className="article-related-body">
        {post.tag && <span className="news-row-tag">{post.tag}</span>}
        <h3>{tr(post.title, lang)}</h3>
        <time className="news-date" dateTime={post.publishedAt ?? undefined}>
          {formatDate(post.publishedAt, lang)}
        </time>
      </span>
    </Link>
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
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`, icon: shareIcons.whatsapp },
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, icon: shareIcons.facebook },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`, icon: shareIcons.x },
    { key: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, icon: shareIcons.linkedin },
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
  whatsapp: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.2H7.4V14h2.8v8h3.3z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M17.5 3h3l-6.8 7.8L21.7 21h-6.3l-4.9-6.4L4.9 21h-3l7.3-8.3L1.5 3h6.4l4.4 5.9L17.5 3zm-1.1 16.2h1.7L6.9 4.7H5.1l11.3 14.5z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M6.5 8.5H3V21h3.5V8.5zM4.8 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM21 13.4c0-3.4-1.8-5.2-4.5-5.2-1.6 0-2.7.8-3.2 1.7V8.5H9.9V21h3.5v-6.6c0-1.6.6-2.6 2.1-2.6s2 1.1 2 2.6V21H21v-7.6z" />
    </svg>
  ),
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
