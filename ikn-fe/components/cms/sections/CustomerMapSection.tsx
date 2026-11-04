'use client';

import CustomerWorldMap from '@/components/CustomerWorldMap';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type CustomerMapContent } from '../utils';

const REGIONS: Record<string, { id: string; en: string; color: string }> = {
  asia: { id: 'Asia', en: 'Asia', color: '#42a5d5' },
  europe: { id: 'Eropa', en: 'Europe', color: '#1769aa' },
  middle_east: { id: 'Timur Tengah', en: 'Middle East', color: '#7a6fd0' },
  americas: { id: 'Amerika Utara & Selatan', en: 'North & South America', color: '#2e9e8f' },
};

// Peta pelanggan per negara (2026-11-04, slide "Resiprene 35 Our Customer" klien): peta dunia bertitik + rute dari
// Belawan, daftar pelanggan per kawasan, dan kartu nama pelanggan yang berjalan mendatar.
export default function CustomerMapSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as CustomerMapContent;
  const items = asList<CustomerMapContent['items'][number]>(c.items)
    .map((item) => ({
      region: REGIONS[asText(item.region)] ? asText(item.region) : 'asia',
      country: tr(item.country, lang),
      lat: Number(item.geo?.lat ?? NaN),
      lng: Number(item.geo?.lng ?? NaN),
      customers: asText(item.customers).split(',').map((s) => s.trim()).filter(Boolean),
    }))
    .filter((item) => item.country && Number.isFinite(item.lat) && Number.isFinite(item.lng));
  if (items.length === 0) return null;

  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const regions = Object.keys(REGIONS).filter((r) => items.some((i) => i.region === r));
  const colors = Object.fromEntries(Object.entries(REGIONS).map(([k, v]) => [k, v.color]));
  const names = items.flatMap((i) => i.customers.map((n) => ({ name: n, country: i.country, region: i.region })));
  const loop = names.length < 12 ? [...names, ...names] : names;

  return (
    <section className="section-tight cmap" id={section.key || undefined}>
      <div className="container">
        <div className="cmap-head">
          {(label || heading) && <SecHead label={label} heading={heading} />}
          {lead && <p className="cmap-lead">{lead}</p>}
        </div>
        <div className="cmap-frame">
          <CustomerWorldMap
            countries={items}
            colors={colors}
            origin={{ lat: 3.79, lng: 98.69, label: tr(c.origin_label, lang) || 'Belawan, Indonesia' }}
          />
          <ul className="cmap-legend">
            {regions.map((r) => (
              <li key={r}>
                <span style={{ background: REGIONS[r]!.color }} />
                {REGIONS[r]![lang]}
              </li>
            ))}
          </ul>
        </div>
        <div className="cmap-regions">
          {regions.map((r) => (
            <div key={r} className="cmap-region">
              <h3>
                <span style={{ background: REGIONS[r]!.color }} />
                {REGIONS[r]![lang]}
              </h3>
              <dl>
                {items
                  .filter((i) => i.region === r)
                  .map((i) => (
                    <div key={i.country}>
                      <dt>{i.country}</dt>
                      <dd>{i.customers.join(', ')}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
      <div className="logo-marquee cmap-marquee" aria-hidden="true">
        <div className="logo-marquee-row">
          <div className="logo-marquee-track" style={{ animationDuration: `${Math.max(30, loop.length * 3)}s` }}>
            {[...loop, ...loop].map((n, i) => (
              <span key={i} className="logo-card is-text" data-dup={i >= names.length ? '' : undefined}>
                <span className="logo-card-word">{n.name}</span>
                <span className="logo-card-name" style={{ color: REGIONS[n.region]!.color }}>
                  {n.country}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
