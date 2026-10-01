'use client';

import Link from 'next/link';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { GalleryItemData, PostSummary } from '@/lib/cms';
import NewsCard from './NewsCard';
import SecHead from './sections/SecHead';

interface Props {
  news: PostSummary[]; // 3 berita terbaru
  photos: GalleryItemData[]; // 6 foto terbaru (type image, media ada)
}

// Teaser di halaman hub Media: berita terbaru (kartu) dan foto terbaru (kartu galeri menuju /galeri).
export default function MediaTeasers({ news, photos }: Props) {
  const { lang } = useLang();
  const en = lang === 'en';

  return (
    <>
      {news.length > 0 && (
        <section className="section-tight" id="berita-terbaru">
          <div className="container">
            <SecHead
              label={en ? '/ Latest news' : '/ Berita terbaru'}
              heading={en ? 'What is happening at IKN.' : 'Yang sedang terjadi di IKN.'}
              aside={
                <Link href="/berita" className="link">
                  {en ? 'All news' : 'Semua berita'} <Icon name="arrow" />
                </Link>
              }
            />
            <div className="news-grid">
              {news.map((post) => (
                <NewsCard key={post.slug} post={post} lang={lang} />
              ))}
            </div>
          </div>
        </section>
      )}

      {photos.length > 0 && (
        <section className="section-tight" id="galeri-terbaru" style={{ paddingTop: 0 }}>
          <div className="container">
            <SecHead
              label={en ? '/ Latest photos' : '/ Foto terbaru'}
              heading={en ? 'From the plant floor.' : 'Dari lantai pabrik.'}
              aside={
                <Link href="/galeri" className="link">
                  {en ? 'Open gallery' : 'Buka galeri'} <Icon name="arrow" />
                </Link>
              }
            />
            <div className="gallery-cards">
              {photos.map((g) => {
                const title = tr(g.title, lang);
                return (
                  <Link key={g.id} href="/galeri" className="gallery-card" aria-label={title}>
                    <Image src={g.media?.url ?? ''} alt={title} fill sizes="(max-width:700px) 100vw, 400px" style={{ objectFit: 'cover' }} />
                    <span className="gallery-card-cap">{title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
