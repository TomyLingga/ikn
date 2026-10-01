'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import type { IconName } from '@/lib/types';
import SmartLink from '../SmartLink';
import { asList, asText, type LinkCardsContent } from '../utils';

// Kisi kartu berikon menuju halaman lain (sub-halaman Keberlanjutan, katalog, unduhan).
export default function LinkCardsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as LinkCardsContent;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const items = asList<LinkCardsContent['items'][number]>(c.items).filter((item) => asText(item.url));
  const fallbackMore = lang === 'en' ? 'Learn more' : 'Selengkapnya';

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {label && <span className="label label-green">{label}</span>}
        {heading && (
          <Reveal as="h2" className="h2 link-cards-heading">
            {heading}
          </Reveal>
        )}
        {lead && <p className="lead link-cards-lead">{lead}</p>}
        <div className="link-cards">
          {items.map((item, i) => (
            <Reveal key={i} delay={i * 70}>
              <SmartLink href={asText(item.url)} className="link-card">
                {asText(item.icon) && (
                  <span className="link-card-icon" aria-hidden="true">
                    <Icon name={asText(item.icon) as IconName} size={22} strokeWidth={1.4} />
                  </span>
                )}
                <h3>{tr(item.title, lang)}</h3>
                {tr(item.body, lang) && <p>{tr(item.body, lang)}</p>}
                <span className="link-card-more">
                  {tr(item.link_label, lang) || fallbackMore} <Icon name="arrow" size={14} />
                </span>
              </SmartLink>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
