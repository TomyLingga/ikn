'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import SmartLink from '../SmartLink';
import { asList, asText, type ProductHighlightsContent } from '../utils';

export default function ProductHighlightsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ProductHighlightsContent;
  const items = asList<ProductHighlightsContent['items'][number]>(c.items);
  const linkLabel = tr(c.link_label, lang);
  const linkUrl = asText(c.link_url) || '/produk';
  const specLabel = lang === 'en' ? 'Specifications' : 'Spesifikasi';

  return (
    <section className="section prod-section">
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
          {items.map((p, i) => (
            <Reveal key={`${asText(p.code)}-${i}`} className="prod-preview-card" delay={i * 100}>
              <div className="prod-preview-top">
                <span className="prod-code">{asText(p.code)}</span>
                <Icon name="drop" size={22} strokeWidth={1.3} />
              </div>
              <h3 className="prod-preview-name">{asText(p.name)}</h3>
              <span className="prod-preview-kind">{asText(p.kind)}</span>
              <p className="prod-preview-sum">{tr(p.summary, lang)}</p>
              <SmartLink href={asText(p.url) || linkUrl} className="link prod-preview-link">
                {specLabel} <Icon name="arrow" />
              </SmartLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
