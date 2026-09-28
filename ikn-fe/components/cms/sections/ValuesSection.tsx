'use client';

import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { ANCHOR_BY_TYPE, asList, type ValuesContent } from '../utils';

// Core values grid (AKHLAK). The big letter is the first character of the value name.
export default function ValuesSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ValuesContent;
  const items = asList<ValuesContent['items'][number]>(c.items);

  return (
    <section className="section-tight" id={ANCHOR_BY_TYPE.values} style={{ paddingTop: 0 }}>
      <div className="container">
        <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} reveal={false} />
        <div className="akhlak-grid">
          {items.map((v, i) => {
            const title = tr(v.title, lang);
            return (
              <Reveal key={i} className="akhlak-cell">
                <div className="akhlak-letter">{title.charAt(0)}</div>
                <h3 className="h3">{title}</h3>
                <p>{tr(v.body, lang)}</p>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
