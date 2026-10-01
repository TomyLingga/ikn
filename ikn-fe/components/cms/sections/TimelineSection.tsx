'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { ANCHOR_BY_TYPE, asList, asText, type TimelineContent } from '../utils';

// Linimasa model bagan "Sejarah Perusahaan" klien: jalan berkelok mendatar dengan pin tahun di atasnya,
// nama entitas di atas pin, kotak uraian + produk di bawahnya (geser mendatar + tombol panah di layar lebar;
// bertumpuk vertikal di ponsel). Anchor tetap #sejarah (menu Tentang Kami). Konten lama tanpa `name`/`products`
// tetap tampil: judul menjadi label di atas pin.
export default function TimelineSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TimelineContent;
  const items = asList<TimelineContent['items'][number]>(c.items);
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  // Tombol panah hanya aktif bila masih ada tonggak di luar layar pada arah itu.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [items.length]);

  function scrollBy(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const step = el.querySelector<HTMLElement>('.road-stop')?.offsetWidth ?? 320;
    el.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  }

  return (
    <section className="section-tight" id={ANCHOR_BY_TYPE.timeline}>
      <div className="container">
        <div className="road-head">
          <SecHead label={tr(c.label, lang)} heading={tr(c.heading, lang)} reveal={false} />
          {items.length > 2 && (
            <div className="road-nav" aria-hidden="true">
              <button type="button" className="road-nav-btn" disabled={edge.start} onClick={() => scrollBy(-1)} tabIndex={-1}>
                <Icon name="chevronLeft" size={18} />
              </button>
              <button type="button" className="road-nav-btn" disabled={edge.end} onClick={() => scrollBy(1)} tabIndex={-1}>
                <Icon name="chevronRight" size={18} />
              </button>
            </div>
          )}
        </div>

        <div className="road-track" ref={track}>
          <ol className="road" style={{ '--stops': items.length } as CSSProperties}>
            {/* Jalan berkelok: dua garis sejajar yang melewati setiap pin. */}
            <svg className="road-line" viewBox={`0 0 ${Math.max(items.length, 1) * 100} 100`} preserveAspectRatio="none" aria-hidden="true">
              <path d={roadPath(items.length)} className="road-line-outer" />
              <path d={roadPath(items.length)} className="road-line-inner" />
            </svg>
            {items.map((item, i) => {
              const name = tr(item.name, lang);
              const title = tr(item.title, lang);
              const body = tr(item.body, lang);
              const products = tr(item.products, lang);
              const above = name || title;
              const showTitle = !!name && !!title;
              return (
                <Reveal as="li" key={i} className="road-stop" delay={i * 70}>
                  <span className="road-name">{above}</span>
                  <span className="road-pin">
                    <span className="road-pin-year" data-long={asText(item.year).length > 6 ? '' : undefined}>
                      {asText(item.year)}
                    </span>
                  </span>
                  <span className="road-post" aria-hidden="true" />
                  <div className="road-card">
                    {showTitle && <strong className="road-period">{title}</strong>}
                    {body && <p className="road-body">{body}</p>}
                    {products && (
                      <p className="road-products">
                        <span>{lang === 'en' ? 'Products' : 'Produk'} :</span> {products}
                      </p>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}

// Jalur gelombang lembut: tiap pin (tengah kolom ke-i) dilewati pada y 50, di antara pin jalan turun sedikit.
function roadPath(count: number): string {
  if (count <= 0) return '';
  if (count === 1) return 'M 0 50 L 100 50';
  const parts = ['M 0 50'];
  for (let i = 0; i < count - 1; i++) {
    const x0 = i * 100 + 50;
    const x1 = (i + 1) * 100 + 50;
    const dip = 50 + (i % 2 === 0 ? 22 : -22);
    parts.push(`L ${x0} 50 C ${x0 + 30} 50, ${x0 + 30} ${dip}, ${(x0 + x1) / 2} ${dip} S ${x1 - 30} 50, ${x1} 50`);
  }
  parts.push(`L ${count * 100} 50`);
  return parts.join(' ');
}
