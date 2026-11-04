'use client';

import CustomerWorldMap, { type MapPoint } from '@/components/CustomerWorldMap';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type CustomerMapContent } from '../utils';

// Key sama dengan SectionDefinitions::CUSTOMER_REGIONS; kawasan baru = tambah di sana + warna di sini.
const REGIONS: Record<string, { id: string; en: string; color: string }> = {
  asia: { id: 'Asia', en: 'Asia', color: '#42a5d5' },
  europe: { id: 'Eropa', en: 'Europe', color: '#1769aa' },
  middle_east: { id: 'Timur Tengah', en: 'Middle East', color: '#7a6fd0' },
  africa: { id: 'Afrika', en: 'Africa', color: '#d08a2e' },
  americas: { id: 'Amerika Utara & Selatan', en: 'North & South America', color: '#2e9e8f' },
  oceania: { id: 'Oseania', en: 'Oceania', color: '#c0577a' },
};

const coord = (g?: { lat: number | null; lng: number | null } | null) => {
  const lat = Number(g?.lat ?? NaN);
  const lng = Number(g?.lng ?? NaN);
  return Number.isFinite(lat) && Number.isFinite(lng) && g?.lat != null && g?.lng != null ? { lat, lng } : null;
};

interface Customer {
  name: string;
  logo: string | null;
  at: { lat: number; lng: number } | null;
}

// Peta pelanggan per negara (2026-11-04, slide "Resiprene 35 Our Customer" klien): peta dunia bertitik + rute dari
// Belawan, daftar pelanggan per kawasan, dan kartu pelanggan (logo bila ada) yang berjalan mendatar. Pelanggan dengan
// titik sendiri mendapat pin + rute sendiri; tanpa titik, pelanggan ikut titik negaranya.
export default function CustomerMapSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as CustomerMapContent;
  const items = asList<CustomerMapContent['items'][number]>(c.items)
    .map((item) => {
      type Raw = CustomerMapContent['items'][number]['customers'][number];
      const raw: unknown = item.customers;
      // Konten lama (sebelum migrasi) masih berupa teks dipisah koma.
      const list: Raw[] = typeof raw === 'string' ? raw.split(',').map((name) => ({ name })) : asList<Raw>(item.customers);
      const customers: Customer[] = list
        .map((cu) => ({ name: asText(cu.name).trim(), logo: cu.logo?.url || null, at: coord(cu.geo) }))
        .filter((cu) => cu.name);
      return { region: REGIONS[asText(item.region)] ? asText(item.region) : 'asia', country: tr(item.country, lang), at: coord(item.geo), customers };
    })
    .filter((item) => item.country && (item.at || item.customers.some((cu) => cu.at)));
  if (items.length === 0) return null;

  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const regions = Object.keys(REGIONS).filter((r) => items.some((i) => i.region === r));
  const color = (r: string) => REGIONS[r]?.color ?? '#1769aa';

  const points: MapPoint[] = items.flatMap((i) => {
    const own = i.customers.filter((cu) => cu.at);
    const rest = i.customers.filter((cu) => !cu.at);
    const out: MapPoint[] = own.map((cu) => ({
      key: `${i.country}-${cu.name}`,
      ...cu.at!,
      color: color(i.region),
      title: cu.name,
      subtitle: i.country,
      logo: cu.logo,
      size: 'sm',
    }));
    if (i.at && (rest.length > 0 || own.length === 0)) {
      out.push({ key: i.country, ...i.at, color: color(i.region), title: i.country, subtitle: rest.map((cu) => cu.name).join(', '), logo: null, size: 'md' });
    }
    return out;
  });

  const cards = items.flatMap((i) => i.customers.map((cu) => ({ ...cu, country: i.country, region: i.region })));
  const loop = cards.length < 12 ? [...cards, ...cards] : cards;

  return (
    <section className="section-tight cmap" id={section.key || undefined}>
      <div className="container">
        <div className="cmap-head">
          {(label || heading) && <SecHead label={label} heading={heading} />}
          {lead && <p className="cmap-lead">{lead}</p>}
        </div>
        <div className="cmap-frame">
          <CustomerWorldMap points={points} origin={{ lat: 3.79, lng: 98.69, label: tr(c.origin_label, lang) || 'Belawan, Indonesia' }} />
          <ul className="cmap-legend">
            {regions.map((r) => (
              <li key={r}>
                <span style={{ background: color(r) }} />
                {REGIONS[r]![lang]}
              </li>
            ))}
          </ul>
        </div>
        <div className="cmap-regions">
          {regions.map((r) => (
            <div key={r} className="cmap-region">
              <h3>
                <span style={{ background: color(r) }} />
                {REGIONS[r]![lang]}
              </h3>
              <dl>
                {items
                  .filter((i) => i.region === r)
                  .map((i) => (
                    <div key={i.country}>
                      <dt>{i.country}</dt>
                      <dd>{i.customers.map((cu) => cu.name).join(', ')}</dd>
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
              <span key={i} className={`logo-card${n.logo ? '' : ' is-text'}`} data-dup={i >= cards.length ? '' : undefined}>
                {n.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={n.logo} alt="" loading="lazy" />
                ) : (
                  <span className="logo-card-word">{n.name}</span>
                )}
                <span className="logo-card-name" style={n.logo ? undefined : { color: color(n.region) }}>
                  {n.logo ? `${n.name} · ${n.country}` : n.country}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
