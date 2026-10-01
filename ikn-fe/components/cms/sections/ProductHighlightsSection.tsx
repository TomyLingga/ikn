'use client';

import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import SmartLink from '../SmartLink';
import { asList, asText, type ProductHighlightsContent } from '../utils';

// Kartu produk andalan. Kisi lentur: baris terakhir selalu penuh berapa pun jumlah kartunya (tanpa sel kosong).
export default function ProductHighlightsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ProductHighlightsContent;
  const items = asList<ProductHighlightsContent['items'][number]>(c.items);
  const linkLabel = tr(c.link_label, lang);
  const linkUrl = asText(c.link_url) || '/bisnis';
  const detailLabel = lang === 'en' ? 'View details' : 'Lihat detail';

  return (
    <section className="section prod-section" id={section.key || undefined}>
      <div className="container">
        <SecHead
          label={tr(c.label, lang)}
          heading={tr(c.heading, lang)}
          aside={
            linkLabel ? (
              <SmartLink href={linkUrl} className="link">
                {linkLabel} <Icon name="arrow" />
              </SmartLink>
            ) : undefined
          }
        />

        <div className="prod-preview">
          {items.map((p, i) => {
            const name = asText(p.name);
            const kind = asText(p.kind);
            return (
              <Reveal key={`${asText(p.code)}-${i}`} className="prod-preview-card" delay={i * 90}>
                {p.image?.url && (
                  <div className="prod-preview-media">
                    <Image src={p.image.url} alt={name} fill sizes="(max-width: 720px) 100vw, 400px" style={{ objectFit: 'cover' }} />
                  </div>
                )}
                <div className="prod-preview-body">
                  <div className="prod-preview-top">
                    <span className="prod-code">{asText(p.code)}</span>
                    {!p.image?.url && <Icon name="drop" size={22} strokeWidth={1.3} />}
                  </div>
                  <h3 className="prod-preview-name">{name}</h3>
                  {kind && <span className="prod-preview-kind">{kind}</span>}
                  <p className="prod-preview-sum">{tr(p.summary, lang)}</p>
                  <SmartLink href={asText(p.url) || linkUrl} className="link prod-preview-link">
                    {detailLabel} <Icon name="arrow" />
                  </SmartLink>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
