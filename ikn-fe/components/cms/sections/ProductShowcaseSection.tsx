'use client';

import Image from 'next/image';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import SmartLink from '../SmartLink';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, type I18nItem, type ProductShowcaseContent } from '../utils';

type Item = ProductShowcaseContent['items'][number];

// Panel produk (2026-11-04, gaya ptpn4.co.id/our-business/products): satu panel lebar per produk dengan foto besar,
// penomoran "1/2", nama, uraian, dan poin; foto berselang kiri/kanan di atas latar abu radial. Bila produk punya
// data teknis (`specs`), tabelnya tampil di samping uraian dalam panel yang sama. `key` item = anchor (#resiprene-35).
export default function ProductShowcaseSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ProductShowcaseContent;
  const items = asList<Item>(c.items).filter((item) => asText(item.name));
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  return (
    <section className="pshow" id={section.key || undefined}>
      {(label || heading || lead) && (
        <div className="container pshow-head">
          {(label || heading) && <SecHead label={label} heading={heading} />}
          {lead && <p className="lead sec-lead">{lead}</p>}
        </div>
      )}
      {items.map((item, i) => (
        <Panel key={item.key || i} item={item} index={i} total={items.length} lang={lang} />
      ))}
    </section>
  );
}

function Panel({ item, index, total, lang }: { item: Item; index: number; total: number; lang: 'id' | 'en' }) {
  const name = asText(item.name);
  const paragraphs = tr(item.summary, lang).split(/\n{2,}/).filter(Boolean);
  const points = asList<I18nItem>(item.points).map((p) => tr(p.text, lang)).filter(Boolean);
  const specs = asList<{ label: Item['summary']; value: Item['summary'] }>(item.specs).filter((row) => tr(row.label, lang));
  const buttonLabel = tr(item.button_label, lang);
  const buttonUrl = asText(item.button_url);

  return (
    <article id={asText(item.key) || undefined} className={`pshow-panel${index % 2 ? ' is-flip' : ''}${specs.length ? ' has-specs' : ''}`}>
      <span className="pshow-leaf pshow-leaf-a" aria-hidden="true" />
      <span className="pshow-leaf pshow-leaf-b" aria-hidden="true" />
      <div className="container pshow-grid">
        <Reveal className="pshow-media">
          {item.image?.url && <Image src={item.image.url} alt={name} fill sizes="(max-width: 900px) 90vw, 46vw" style={{ objectFit: 'contain' }} />}
        </Reveal>
        <div className="pshow-content">
          <Reveal className="pshow-text">
            <span className="pshow-count">
              {index + 1}/{total}
            </span>
            {(asText(item.code) || asText(item.kind)) && (
              <span className="pshow-meta">{[asText(item.code), asText(item.kind)].filter(Boolean).join(' · ')}</span>
            )}
            <h3 className="pshow-name">{name}</h3>
            {paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {points.length > 0 && (
              <ul className="pshow-points">
                {points.map((p, j) => (
                  <li key={j}>{p}</li>
                ))}
              </ul>
            )}
            {buttonLabel && buttonUrl && (
              <SmartLink href={buttonUrl} className="btn btn-solid pshow-btn">
                {buttonLabel} <Icon name="arrow" size={16} />
              </SmartLink>
            )}
          </Reveal>
          {specs.length > 0 && (
            <Reveal className="pshow-specs" delay={120}>
              <dl>
                {specs.map((row, j) => (
                  <div key={j}>
                    <dt>{tr(row.label, lang)}</dt>
                    <dd>{tr(row.value, lang)}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          )}
        </div>
      </div>
    </article>
  );
}
