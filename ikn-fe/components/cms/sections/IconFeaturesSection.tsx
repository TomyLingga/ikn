'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, iconName, type IconFeaturesContent } from '../utils';

// "Mengapa memilih kami?": judul + pengantar di tengah, lalu 2-4 kolom berisi ikon dalam lingkaran (atau gambar
// ikon sendiri), judul, dan uraian singkat. Gaya ikon: outline (bawaan), soft, solid, plain.
export default function IconFeaturesSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as IconFeaturesContent;
  const items = asList<IconFeaturesContent['items'][number]>(c.items).filter((item) => tr(item.title, lang));
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const columns = c.columns === '2' || c.columns === '3' || c.columns === '4' ? Number(c.columns) : Math.min(4, items.length);
  const style = ['soft', 'solid', 'plain'].includes(asText(c.icon_style)) ? asText(c.icon_style) : 'outline';
  const align = c.align === 'left' ? 'left' : 'center';

  return (
    <section className={`section-tight ifeat ifeat-${align}`} id={section.key || undefined}>
      <div className="container">
        {(label || heading || lead) && (
          <header className="ifeat-head">
            {label && <span className="label">{label}</span>}
            {heading && <h2 className="h2 ifeat-title">{heading}</h2>}
            {lead && <p className="ifeat-lead">{lead}</p>}
          </header>
        )}
        <div className="ifeat-grid" style={{ '--ifeat-cols': columns } as CSSProperties}>
          {items.map((item, i) => {
            const title = tr(item.title, lang);
            const body = tr(item.body, lang);
            return (
              <Reveal as="article" key={i} className="ifeat-item" delay={Math.min(i, 6) * 70}>
                <span className={`ifeat-icon ifeat-icon-${style}`} aria-hidden="true">
                  {item.image?.url ? (
                    <Image src={item.image.url} alt="" width={40} height={40} style={{ objectFit: 'contain' }} />
                  ) : (
                    <Icon name={iconName(item.icon, 'checkCircle')} size={30} strokeWidth={1.3} />
                  )}
                </span>
                <h3 className="ifeat-item-title">{title}</h3>
                {body && <p className="ifeat-item-body">{body}</p>}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
