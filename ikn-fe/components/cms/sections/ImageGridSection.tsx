'use client';

import { useState } from 'react';
import Image from 'next/image';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import Lightbox, { type LightboxPhoto } from '../Lightbox';
import SecHead from './SecHead';
import { asList, type ImageGridContent } from '../utils';

// Kisi foto pilihan (bukan dari menu Galeri): baris lentur tanpa sel kosong, klik membuka pembesar.
export default function ImageGridSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ImageGridContent;
  const [active, setActive] = useState<number | null>(null);
  const photos: LightboxPhoto[] = asList<ImageGridContent['items'][number]>(c.items).flatMap((item, i) =>
    item.image?.url ? [{ id: i, src: item.image.url, title: tr(item.caption, lang) }] : [],
  );
  if (photos.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && <p className="lead sec-lead">{lead}</p>}
        {/* data-count: tinggi baris menyesuaikan jumlah foto (1, 2, atau banyak). */}
        <div className="photo-grid" data-count={Math.min(photos.length, 3)}>
          {photos.map((photo, i) => (
            <Reveal key={photo.id} className="photo-grid-item" delay={Math.min(i, 8) * 50}>
              <button type="button" className="photo-grid-btn" onClick={() => setActive(i)} aria-label={`${lang === 'en' ? 'Enlarge photo' : 'Perbesar foto'}${photo.title ? `: ${photo.title}` : ''}`}>
                <Image src={photo.src} alt={photo.title} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 400px" style={{ objectFit: 'cover' }} />
              </button>
              {photo.title && <p className="photo-grid-cap">{photo.title}</p>}
            </Reveal>
          ))}
        </div>
      </div>

      {active !== null && photos[active] && (
        <Lightbox photos={photos} index={active} onChange={setActive} onClose={() => setActive(null)} lang={lang} />
      )}
    </section>
  );
}
