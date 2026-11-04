'use client';

import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { CustomerLogoData, PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import type { CustomerLogosContent } from '../utils';

interface Props {
  section: PageSection;
  items: CustomerLogoData[];
}

// Optional heading + intro paragraph + logo grid; logos come from GET /content/customer-logos (passed via `extra`).
// Section id = key (#pelanggan). `layout: 'marquee'` = kartu logo + nama yang berjalan mendatar (dua baris berlawanan
// arah bila logo cukup banyak; berhenti saat hover dan untuk prefers-reduced-motion).
export default function CustomerLogosSection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as CustomerLogosContent;
  const lead = tr(c.lead, lang);
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && (
          <p className="lead" style={{ maxWidth: '52ch', marginBottom: 36 }}>
            {lead}
          </p>
        )}
        {items.length > 0 && c.layout === 'marquee' && <LogoMarquee items={items} />}
        {items.length > 0 && c.layout !== 'marquee' && (
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

function LogoMarquee({ items }: { items: CustomerLogoData[] }) {
  // Satu baris untuk sedikit logo, dua baris (dibagi bergantian) bila > 8. Isi digandakan agar putaran mulus.
  const rows = items.length > 8 ? [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)] : [items];
  return (
    <div className="logo-marquee">
      {rows.map((row, r) => {
        const loop = Array.from({ length: Math.max(2, Math.ceil(12 / row.length)) }, () => row).flat();
        return (
          <div key={r} className={`logo-marquee-row${r % 2 ? ' is-reverse' : ''}`}>
            <div className="logo-marquee-track" style={{ animationDuration: `${Math.max(24, loop.length * 3)}s` }}>
              {[...loop, ...loop].map((c, i) => (
                <span key={i} className="logo-card" aria-hidden={i >= row.length ? true : undefined} data-dup={i >= row.length ? '' : undefined}>
                  {c.logo?.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.logo.url} alt={i < row.length ? c.name : ''} loading="lazy" />
                  )}
                  <span className="logo-card-name">{c.name}</span>
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
