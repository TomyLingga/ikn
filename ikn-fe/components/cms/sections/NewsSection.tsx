'use client';

import Link from 'next/link';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection, PostCategory, PostSummary } from '@/lib/cms';
import NewsCard from '../NewsCard';
import type { EmptyTextContent } from '../utils';

interface Props {
  section: PageSection;
  items: PostSummary[];
  categories?: PostCategory[];
  activeCategory?: string | null; // slug dari ?category=
}

// Daftar berita: filter kategori (chip) + kisi kartu; kartu pertama ditonjolkan saat tanpa filter.
// Item dari GET /content/news[?category=], kategori dari GET /content/news-categories.
export default function NewsSection({ section, items, categories = [], activeCategory = null }: Props) {
  const { lang } = useLang();
  const c = section.content as EmptyTextContent;
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No news published yet.' : 'Belum ada berita yang dipublikasikan.');
  const chips = categories.filter((cat) => (cat.postCount ?? 0) > 0);
  const active = chips.find((cat) => cat.slug === activeCategory) ?? null;

  return (
    <section className="section-tight">
      <div className="container">
        {chips.length > 0 && (
          <nav className="news-filter" aria-label={lang === 'en' ? 'News categories' : 'Kategori berita'}>
            <Link href="/berita" className={`news-chip${active ? '' : ' is-active'}`} scroll={false}>
              {lang === 'en' ? 'All' : 'Semua'}
            </Link>
            {chips.map((cat) => (
              <Link
                key={cat.slug}
                href={`/berita?category=${encodeURIComponent(cat.slug)}`}
                className={`news-chip${active?.slug === cat.slug ? ' is-active' : ''}`}
                scroll={false}
              >
                {tr(cat.name, lang)}
                <span className="news-chip-count">{cat.postCount}</span>
              </Link>
            ))}
          </nav>
        )}

        {items.length === 0 ? (
          <p className="news-empty">
            {active
              ? lang === 'en'
                ? `No news in “${tr(active.name, lang)}” yet.`
                : `Belum ada berita di kategori “${tr(active.name, lang)}”.`
              : emptyText}
          </p>
        ) : (
          <div className="news-grid">
            {items.map((item, i) => (
              <Reveal key={item.slug} delay={Math.min(i, 6) * 70} className={i === 0 && !active ? 'news-grid-featured' : undefined}>
                <NewsCard post={item} lang={lang} featured={i === 0 && !active} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
