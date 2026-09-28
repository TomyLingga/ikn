'use client';

import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { CustomerLogoData, PageSection } from '@/lib/cms';
import type { CustomerLogosContent } from '../utils';

interface Props {
  section: PageSection;
  items: CustomerLogoData[];
}

// Intro paragraph + logo grid; logos come from GET /content/customer-logos (passed via `extra`).
export default function CustomerLogosSection({ section, items }: Props) {
  const { lang } = useLang();
  const lead = tr((section.content as CustomerLogosContent).lead, lang);

  return (
    <section className="section-tight">
      <div className="container">
        {lead && (
          <p className="lead" style={{ maxWidth: '52ch', marginBottom: 36 }}>
            {lead}
          </p>
        )}
        {items.length > 0 && (
          <div className="logo-grid">
            {items.map((c, i) => {
              const inner = c.logo?.url ? (
                // Logo dimensions are unknown; a plain img keeps the cell layout.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logo.url} alt={c.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <span>{c.name}</span>
              );
              return (
                <Reveal key={c.id} className="logo-cell" delay={i * 60}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" title={c.name}>
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
