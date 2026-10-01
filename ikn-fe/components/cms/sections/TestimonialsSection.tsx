'use client';

import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type TestimonialsContent } from '../utils';

// Testimoni pelanggan/mitra: kutipan pertama tampil besar, sisanya kartu ringkas di sampingnya.
export default function TestimonialsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TestimonialsContent;
  const items = asList<TestimonialsContent['items'][number]>(c.items).filter((item) => tr(item.quote, lang));
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);

  return (
    <section className="section-tight quotes-section" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        <div className={`quotes${items.length === 1 ? ' is-single' : ''}`}>
          {items.map((item, i) => {
            const name = asText(item.name);
            const role = [tr(item.role, lang), asText(item.company)].filter(Boolean).join(', ');
            return (
              <Reveal as="figure" key={i} className={`quote-card${i === 0 ? ' quote-card-lead' : ''}`} delay={Math.min(i, 5) * 70}>
                <Icon name="quote" size={i === 0 ? 30 : 22} strokeWidth={1.4} className="quote-mark" />
                <blockquote>{tr(item.quote, lang)}</blockquote>
                <figcaption>
                  {item.photo?.url && (
                    <span className="quote-photo">
                      <Image src={item.photo.url} alt="" fill sizes="48px" style={{ objectFit: 'cover' }} />
                    </span>
                  )}
                  <span className="quote-who">
                    <strong>{name}</strong>
                    {role && <span>{role}</span>}
                  </span>
                </figcaption>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
