'use client';

import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, pad2, type StatsContent } from '../utils';

// Key figures row ("datarow"), followed by the rule that separates it from the next section.
export default function StatsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const items = asList<StatsContent['items'][number]>((section.content as StatsContent).items);
  if (items.length === 0) return null;

  return (
    <>
      <section className="section-tight">
        <div className="container">
          <div className="datarow">
            {items.map((s, i) => (
              <Reveal key={i} className="datacell" delay={i * 70}>
                <span className="index">{pad2(i + 1)}</span>
                <div className="datacell-num">
                  {asText(s.value)}
                  {asText(s.unit) && <span className="datacell-unit">{asText(s.unit)}</span>}
                </div>
                <p className="datacell-label">{tr(s.label, lang)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <hr className="rule container-rule" />
    </>
  );
}
