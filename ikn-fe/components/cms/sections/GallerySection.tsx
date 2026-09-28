'use client';

import Image from 'next/image';
import Reveal from '@/components/Reveal';
import VideoGallery from '@/components/VideoGallery';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { GalleryItemData, PageSection } from '@/lib/cms';
import type { GalleryContent } from '../utils';

interface Props {
  section: PageSection;
  items: GalleryItemData[];
}

// Photo grid + YouTube videos; items come from GET /content/gallery (passed via `extra`).
export default function GallerySection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as GalleryContent;
  const photosLabel = tr(c.photos_label, lang) || (lang === 'en' ? '/ Photos' : '/ Foto');
  const videosLabel = tr(c.videos_label, lang) || (lang === 'en' ? '/ Videos' : '/ Video');
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No media published yet.' : 'Belum ada media yang dipublikasikan.');

  const photos = items.flatMap((g) =>
    g.type === 'image' && g.media?.url ? [{ id: g.id, src: g.media.url, title: tr(g.title, lang) }] : [],
  );
  const videos = items.flatMap((g) => {
    const id = g.type === 'video' ? g.youtubeId || g.externalUrl || '' : '';
    return id ? [{ id, title: tr(g.title, lang), desc: '' }] : [];
  });

  return (
    <>
      <section className="section-tight">
        <div className="container">
          <span className="label label-green">{photosLabel}</span>
          {photos.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              {emptyText}
            </p>
          ) : (
            <div className="gallery-grid" style={{ marginTop: 20 }}>
              {photos.map((g, i) => (
                <Reveal key={g.id} className="gallery-cell" delay={i * 70}>
                  <Image src={g.src} alt={g.title} fill sizes="(max-width:900px) 50vw, 380px" style={{ objectFit: 'cover' }} />
                  <span className="gallery-cap">{g.title}</span>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          <span className="label label-green">{videosLabel}</span>
          {videos.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>
              {emptyText}
            </p>
          ) : (
            <div style={{ marginTop: 20 }}>
              <VideoGallery videos={videos} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
