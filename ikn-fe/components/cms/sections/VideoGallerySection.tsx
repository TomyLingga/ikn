'use client';

import VideoGallery from '@/components/VideoGallery';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type VideoGalleryContent } from '../utils';

export default function VideoGallerySection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as VideoGalleryContent;
  const videos = asList<VideoGalleryContent['videos'][number]>(c.videos).flatMap((v) => {
    const id = asText(v.youtube_id).trim();
    return id ? [{ id, title: tr(v.title, lang), desc: tr(v.desc, lang) }] : [];
  });
  if (videos.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} />
        <VideoGallery videos={videos} />
      </div>
    </section>
  );
}
