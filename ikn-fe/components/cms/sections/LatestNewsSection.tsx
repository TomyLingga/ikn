'use client';

import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection, PostSummary } from '@/lib/cms';
import NewsCard from '../NewsCard';
import SmartLink from '../SmartLink';
import SecHead from './SecHead';
import { asText, type LatestNewsContent } from '../utils';

interface Props {
  section: PageSection;
  items: PostSummary[]; // berita terbit terbaru (GET /content/news), diteruskan lewat `extra`
}

// Beberapa berita terbaru dalam kartu + tautan ke halaman Berita. Tanpa berita terbit, section tidak dirender.
export default function LatestNewsSection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as LatestNewsContent;
  const count = Math.min(6, Math.max(1, Math.round(Number(c.count) || 3)));
  const posts = items.slice(0, count);
  if (posts.length === 0) return null;
  const linkLabel = tr(c.link_label, lang) || (lang === 'en' ? 'All news' : 'Semua berita');

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        <SecHead
          label={tr(c.label, lang)}
          heading={tr(c.heading, lang) || (lang === 'en' ? 'Latest news' : 'Berita terbaru')}
          aside={
            <SmartLink href={asText(c.link_url) || '/berita'} className="link">
              {linkLabel} <Icon name="arrow" />
            </SmartLink>
          }
        />
        <div className="news-grid">
          {posts.map((post) => (
            <NewsCard key={post.slug} post={post} lang={lang} />
          ))}
        </div>
      </div>
    </section>
  );
}
