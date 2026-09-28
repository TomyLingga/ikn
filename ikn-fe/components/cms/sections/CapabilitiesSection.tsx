'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, iconName, pad2, type CapabilitiesContent } from '../utils';

export default function CapabilitiesSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as CapabilitiesContent;
  const items = asList<CapabilitiesContent['items'][number]>(c.items);

  return (
    <section className="section">
      <div className="container">
        <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} />

        <div className="cap-list">
          {items.map((item, i) => (
            <Reveal key={i} className="cap-row" delay={i * 90}>
              <span className="cap-idx index">{pad2(i + 1)}</span>
              <div className="cap-icon">
                <Icon name={iconName(item.icon, 'leaf')} size={30} strokeWidth={1.3} />
              </div>
              <h3 className="h3 cap-title">{tr(item.title, lang)}</h3>
              <p className="cap-body">{tr(item.body, lang)}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
