'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { tr } from '@/lib/cms';
import type { I18n, PageSection } from '@/lib/cms';
import type { Lang } from '@/lib/types';
import { asList, asText, breadcrumbItems, type PageHeaderContent } from '../utils';

interface Props {
  section: PageSection;
  pageTitle?: I18n | null;
}

interface Slide {
  url: string;
  video: boolean;
  caption: string;
}

// Page header: eyebrow label, display title, lead. Dengan media (foto/video dari admin) menjadi tata letak
// "split" (teks kiri, panggung media kanan), "split_reverse" (media kiri, teks kanan) atau "cover" (media memenuhi latar); lebih dari satu media = slideshow fade.
// Tanpa media: tata letak teks lama; breadcrumb=true memakai varian ringkas "commerce-head".
export default function PageHeaderSection({ section, pageTitle }: Props) {
  const { lang } = useLang();
  const site = useSite();
  const pathname = usePathname();
  const c = section.content as PageHeaderContent;
  const label = tr(c.label, lang);
  const title = tr(c.title, lang);
  const lead = tr(c.lead, lang);
  const slides: Slide[] = asList<NonNullable<PageHeaderContent['media']>[number]>(c.media).flatMap((m) =>
    m.file?.url ? [{ url: m.file.url, video: (m.file.mime || '').startsWith('video/'), caption: tr(m.caption, lang) }] : [],
  );
  const crumbs = c.breadcrumb ? breadcrumbItems(pathname || '/', site.menus.header.items, lang, pageTitle) : null;

  if (slides.length > 0) {
    const rawLayout = asText(c.layout);
    const layout = rawLayout === 'cover' ? 'cover' : rawLayout === 'split_reverse' ? 'split ph-reverse' : 'split';
    const interval = Number(c.interval) > 0 ? Number(c.interval) : 6;
    return (
      <section className={`pagehead ph ph-${layout}`}>
        <div className="container ph-grid">
          <div className="ph-text">
            {crumbs && <Breadcrumb items={crumbs} />}
            {label && <span className="label label-amber">{label}</span>}
            <h1 className="display pagehead-title">{title}</h1>
            {lead && <p className="lead">{lead}</p>}
          </div>
          <Showcase slides={slides} interval={interval} lang={lang} />
        </div>
      </section>
    );
  }

  if (crumbs) {
    return (
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={crumbs} />
          {label && <span className="label label-amber">{label}</span>}
          <h1 className="display pagehead-title">{title}</h1>
          {lead && (
            <p className="lead" style={{ marginTop: 18 }}>
              {lead}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="pagehead">
      <div className="container pagehead-row">
        <div>
          {label && <span className="label label-amber">{label}</span>}
          <h1 className="display pagehead-title">{title}</h1>
        </div>
        {lead && <p className="lead">{lead}</p>}
      </div>
    </section>
  );
}

// Slideshow otomatis tanpa kontrol: foto berganti tiap `interval` detik dengan fade; video diputar (tanpa suara)
// dan berganti saat selesai.
function Showcase({ slides, interval, lang }: { slides: Slide[]; interval: number; lang: Lang }) {
  const [index, setIndex] = useState(0);
  const videos = useRef<(HTMLVideoElement | null)[]>([]);
  const count = slides.length;
  const current = slides[index] ?? slides[0];
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);

  useEffect(() => {
    if (count < 2 || !current || current.video) return;
    const timer = window.setTimeout(next, interval * 1000);
    return () => window.clearTimeout(timer);
  }, [index, count, current, interval, next]);

  useEffect(() => {
    videos.current.forEach((video, i) => {
      if (!video) return;
      if (i === index) {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [index]);

  if (!current) return null;

  return (
    <div className="ph-stage" role="region" aria-roledescription="carousel" aria-label={lang === 'en' ? 'Header media' : 'Media kepala halaman'}>
      {slides.map((slide, i) => (
        <div key={`${slide.url}-${i}`} className={`ph-slide${i === index ? ' is-active' : ''}`} aria-hidden={i !== index}>
          {slide.video ? (
            <video
              ref={(el) => {
                videos.current[i] = el;
              }}
              src={slide.url}
              muted
              playsInline
              preload={i === 0 ? 'auto' : 'metadata'}
              loop={count === 1}
              onEnded={count > 1 ? next : undefined}
            />
          ) : (
            <Image src={slide.url} alt={slide.caption} fill priority={i === 0} sizes="(max-width: 860px) 100vw, 60vw" style={{ objectFit: 'cover' }} />
          )}
          {slide.caption && <span className="ph-caption">{slide.caption}</span>}
        </div>
      ))}
    </div>
  );
}
