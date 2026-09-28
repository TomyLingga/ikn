'use client';

import Link from 'next/link';
import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection, PostSummary } from '@/lib/cms';
import { formatDate } from '@/lib/format';
import type { EmptyTextContent } from '../utils';

interface Props {
  section: PageSection;
  items: PostSummary[];
}

// News list: first post as the highlight, the rest as rows. Items come from GET /content/news.
export default function NewsSection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as EmptyTextContent;
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No news published yet.' : 'Belum ada berita yang dipublikasikan.');
  const [lead, ...rest] = items;

  // "Oleh {author} · {n} menit baca" when the API provides them.
  function byline(item: PostSummary): string {
    const parts: string[] = [];
    if (item.author) parts.push(lang === 'en' ? `By ${item.author}` : `Oleh ${item.author}`);
    const minutes = item.readingMinutes ?? 0;
    if (minutes > 0) parts.push(lang === 'en' ? `${minutes} min read` : `${minutes} menit baca`);
    return parts.join(' · ');
  }

  return (
    <section className="section-tight">
      <div className="container">
        {lead ? (
          <Reveal className="news-lead" id="sorotan">
            <Link href={`/berita/${lead.slug}`} className="news-lead-media">
              {lead.cover?.url && (
                <Image
                  src={lead.cover.url}
                  alt={tr(lead.title, lang)}
                  fill
                  sizes="(max-width:900px) 100vw, 600px"
                  style={{ objectFit: 'cover' }}
                />
              )}
              {lead.tag && <span className="news-tag">{lead.tag}</span>}
            </Link>
            <div className="news-lead-body">
              <span className="news-tag">{lang === 'en' ? 'Highlight' : 'Sorotan'}</span>
              <time className="news-date">
                {formatDate(lead.publishedAt, lang)}
                {byline(lead) && <span className="news-byline"> · {byline(lead)}</span>}
              </time>
              <h2 className="news-lead-title">
                <Link href={`/berita/${lead.slug}`}>{tr(lead.title, lang)}</Link>
              </h2>
              <p>{tr(lead.excerpt, lang)}</p>
              <Link href={`/berita/${lead.slug}`} className="link" style={{ marginTop: 14 }}>
                {lang === 'en' ? 'Read more' : 'Baca selengkapnya'} <Icon name="arrow" />
              </Link>
            </div>
          </Reveal>
        ) : (
          <p>{emptyText}</p>
        )}

        {rest.length > 0 && (
          <div className="news-list" style={{ marginTop: 'clamp(40px, 6vw, 72px)' }}>
            {rest.map((item, i) => (
              <Reveal key={item.slug} className="news-row" delay={i * 80}>
                <span className="news-row-date">{formatDate(item.publishedAt, lang)}</span>
                <div>
                  <h3 className="news-row-title">
                    <Link href={`/berita/${item.slug}`}>{tr(item.title, lang)}</Link>
                  </h3>
                  <p className="news-row-ex">{tr(item.excerpt, lang)}</p>
                  {byline(item) && <span className="news-byline">{byline(item)}</span>}
                </div>
                {item.tag && <span className="news-row-tag">{item.tag}</span>}
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
