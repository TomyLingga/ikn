'use client';

import type { CSSProperties } from 'react';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type StatsContent } from '../utils';

// Angka kunci ("datarow"): kolom mengikuti jumlah angka (maks. 4 per baris), diikuti garis pemisah.
export default function StatsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as StatsContent;
  const items = asList<StatsContent['items'][number]>(c.items);
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  // 5-6 angka dibagi 3 kolom agar baris terakhir tidak timpang; selebihnya maksimal 4 kolom.
  const cols = items.length <= 4 ? items.length : items.length <= 6 ? 3 : 4;

  return (
    <>
      <section className="section-tight" id={section.key || undefined}>
        <div className="container">
          {(label || heading) && <SecHead label={label} heading={heading} />}
          <div className="datarow" style={{ '--cols': cols } as CSSProperties}>
            {items.map((s, i) => (
              <Reveal key={i} className="datacell" delay={i * 70}>
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
