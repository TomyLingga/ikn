'use client';

import { useState } from 'react';
import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import VideoGallery from '@/components/VideoGallery';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { GalleryItemData, PageSection } from '@/lib/cms';
import Lightbox, { type LightboxPhoto } from '../Lightbox';
import type { GalleryContent } from '../utils';

interface Props {
  section: PageSection;
  items: GalleryItemData[];
}

// Galeri: tab Foto / Video, kartu foto dengan judul di atas gradien + lightbox, video YouTube.
// Items come from GET /content/gallery (passed via `extra`).
export default function GallerySection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as GalleryContent;
  const photosLabel = tr(c.photos_label, lang) || (lang === 'en' ? 'Photos' : 'Foto');
  const videosLabel = tr(c.videos_label, lang) || (lang === 'en' ? 'Videos' : 'Video');
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No media published yet.' : 'Belum ada media yang dipublikasikan.');

  const photos: LightboxPhoto[] = items.flatMap((g) =>
    g.type === 'image' && g.media?.url ? [{ id: g.id, src: g.media.url, title: tr(g.title, lang) }] : [],
  );
  const videos = items.flatMap((g) => {
    const id = g.type === 'video' ? g.youtubeId || g.externalUrl || '' : '';
    return id ? [{ id, title: tr(g.title, lang), desc: '' }] : [];
  });

  const [tab, setTab] = useState<'photos' | 'videos'>('photos');
  const [active, setActive] = useState<number | null>(null);
  const clean = (label: string) => label.replace(/^\/\s*/, '');

  return (
    <section className="section-tight">
      <div className="container">
        <div className="gallery-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'photos'} className={`gallery-tab${tab === 'photos' ? ' is-active' : ''}`} onClick={() => setTab('photos')}>
            <Icon name="image" size={16} /> {clean(photosLabel)} <span className="gallery-tab-count">{photos.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={tab === 'videos'} className={`gallery-tab${tab === 'videos' ? ' is-active' : ''}`} onClick={() => setTab('videos')}>
            <Icon name="play" size={16} /> {clean(videosLabel)} <span className="gallery-tab-count">{videos.length}</span>
          </button>
        </div>

        {tab === 'photos' &&
          (photos.length === 0 ? (
            <p className="news-empty">{emptyText}</p>
          ) : (
            <div className="gallery-cards">
              {photos.map((g, i) => (
                <Reveal key={g.id} delay={Math.min(i, 8) * 60}>
                  <button type="button" className="gallery-card" onClick={() => setActive(i)} aria-label={`${lang === 'en' ? 'Open' : 'Buka'} ${g.title}`}>
                    <Image src={g.src} alt={g.title} fill sizes="(max-width:700px) 100vw, (max-width:1100px) 50vw, 400px" style={{ objectFit: 'cover' }} />
                    <span className="gallery-card-cap">{g.title}</span>
                  </button>
                </Reveal>
              ))}
            </div>
          ))}

        {tab === 'videos' && (videos.length === 0 ? <p className="news-empty">{emptyText}</p> : <VideoGallery videos={videos} />)}
      </div>

      {active !== null && photos[active] && (
        <Lightbox photos={photos} index={active} onChange={setActive} onClose={() => setActive(null)} lang={lang} />
      )}
    </section>
  );
}
