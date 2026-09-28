'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, iconName, pad2, type I18nItem, type PillarsContent } from '../utils';

// Sustainability pillars (environment, social, governance). `key` becomes the anchor id.
export default function PillarsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const items = asList<PillarsContent['items'][number]>((section.content as PillarsContent).items);

  return (
    <section className="section-tight">
      <div className="container">
        <div className="sustain-grid">
          {items.map((s, i) => {
            const points = asList<I18nItem>(s.points);
            const key = asText(s.key);
            return (
              <Reveal key={key || i} id={key || undefined} className="vm-card" delay={i * 90}>
                <div className="vm-icon">
                  <Icon name={iconName(s.icon, 'leaf')} size={34} strokeWidth={1.3} />
                </div>
                <h3 className="h3">{tr(s.title, lang)}</h3>
                <p style={{ marginBottom: 18 }}>{tr(s.body, lang)}</p>
                {points.length > 0 && (
                  <ul className="vm-list">
                    {points.map((p, j) => (
                      <li key={j}>
                        <span className="index">{pad2(j + 1)}</span>
                        <span>{tr(p.text, lang)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
