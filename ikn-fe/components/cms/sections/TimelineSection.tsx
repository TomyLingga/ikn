'use client';

import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { ANCHOR_BY_TYPE, asList, asText, type TimelineContent } from '../utils';

export default function TimelineSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TimelineContent;
  const items = asList<TimelineContent['items'][number]>(c.items);

  return (
    <section className="section-tight" id={ANCHOR_BY_TYPE.timeline}>
      <div className="container">
        <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} reveal={false} />
        <div className="timeline">
          {items.map((t, i) => (
            <Reveal key={i} className="tl-row" delay={i * 80}>
              <span className="tl-year">{asText(t.year)}</span>
              <div>
                <h3 className="h3 tl-title">{tr(t.title, lang)}</h3>
                <p className="tl-body">{tr(t.body, lang)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
