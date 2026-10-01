'use client';

import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { tr } from '@/lib/cms';
import type { PostSummary } from '@/lib/cms';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/lib/types';

interface NewsCardProps {
  post: PostSummary;
  lang: Lang;
  featured?: boolean; // kartu pertama: lebih lebar, gambar lebih besar
}

// Kartu berita (daftar /berita dan berita terkait): gambar sampul, kategori + tanggal, judul, ringkasan, tautan baca.
export default function NewsCard({ post, lang, featured = false }: NewsCardProps) {
  const href = `/berita/${post.slug}`;
  const title = tr(post.title, lang);
  const category = post.category ? tr(post.category.name, lang) : '';

  return (
    <article className={`news-card${featured ? ' news-card--featured' : ''}`}>
      <Link href={href} className="news-card-media" aria-label={title}>
        {post.cover?.url ? (
          <Image src={post.cover.url} alt={title} fill sizes={featured ? '(max-width:960px) 100vw, 800px' : '(max-width:640px) 100vw, 400px'} style={{ objectFit: 'cover' }} />
        ) : (
          <span className="news-card-placeholder" aria-hidden="true">
            <Icon name="image" size={28} strokeWidth={1.2} />
          </span>
        )}
      </Link>
      <div className="news-card-body">
        <div className="news-card-meta">
          {category && post.category && (
            <Link href={`/berita?category=${encodeURIComponent(post.category.slug)}`} className="news-cat">
              {category}
            </Link>
          )}
          {category && <span className="news-meta-dot" aria-hidden="true" />}
          <time dateTime={post.publishedAt ?? undefined}>{formatDate(post.publishedAt, lang)}</time>
        </div>
        <h3 className="news-card-title">
          <Link href={href}>{title}</Link>
        </h3>
        {tr(post.excerpt, lang) && <p className="news-card-ex">{tr(post.excerpt, lang)}</p>}
        <Link href={href} className="news-card-more">
          {lang === 'en' ? 'Read more' : 'Baca selengkapnya'} <Icon name="arrow" size={14} />
        </Link>
      </div>
    </article>
  );
}
