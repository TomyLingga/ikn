'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import MediaVideo from '@/components/MediaVideo';
import SecHead from './SecHead';
import { ANCHOR_BY_TYPE, asList, asText, type TimelineContent } from '../utils';
import { frameStyle, frameBackground } from '@/lib/media-frame';

// Linimasa model bagan "Sejarah Perusahaan" klien: jalan berkelok mendatar dengan pin tahun di atasnya,
// nama entitas di atas pin, kotak uraian + produk di bawahnya (geser mendatar + tombol panah di layar lebar;
// bertumpuk vertikal di ponsel). Anchor tetap #sejarah (menu Tentang Kami). Konten lama tanpa `name`/`products`
// tetap tampil: judul menjadi label di atas pin.
export default function TimelineSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TimelineContent;
  const items = asList<TimelineContent['items'][number]>(c.items);
  const startNewest = c.start === 'newest';
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  // Tombol panah hanya aktif bila masih ada tonggak di luar layar pada arah itu.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () => setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    // Posisi awal 'newest': mulai dari tonggak terbaru di ujung kanan (urutan tetap lama → baru), pengunjung menggeser ke kiri.
    if (startNewest) el.scrollLeft = el.scrollWidth;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [items.length, startNewest]);

  // Geser otomatis satu tonggak tiap AUTOPLAY_MS searah titik mulai ('oldest' ke kanan, 'newest' ke kiri), kembali ke awal di ujung.
  // Berhenti saat kursor/fokus/sentuhan di linimasa, section tidak terlihat, tab tersembunyi; mati bila reduced-motion.
  const hold = useRef(0);
  useEffect(() => {
    const el = track.current;
    if (!el || items.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let visible = false;
    const io = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; }, { threshold: 0.3 });
    io.observe(el);
    const dir = startNewest ? -1 : 1;
    const timer = window.setInterval(() => {
      if (!visible || document.hidden || Date.now() < hold.current) return;
      if (el.scrollWidth <= el.clientWidth + 4) return; // semua muat atau tata letak vertikal (ponsel)
      const atEnd = dir > 0 ? el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 : el.scrollLeft <= 4;
      if (atEnd) el.scrollTo({ left: dir > 0 ? 0 : el.scrollWidth, behavior: 'smooth' });
      else el.scrollBy({ left: dir * stopStep(el), behavior: 'smooth' });
    }, AUTOPLAY_MS);
    return () => {
      window.clearInterval(timer);
      io.disconnect();
    };
  }, [items.length, startNewest]);

  // Interaksi pengunjung menunda geser otomatis; Infinity = selama kursor/fokus masih di dalam.
  const pause = (ms = Infinity) => { hold.current = Date.now() + ms; };
  const resume = () => { hold.current = Date.now() + AUTOPLAY_MS; };

  function scrollBy(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * stopStep(el) * 2, behavior: 'smooth' });
  }

  return (
    <section className="section-tight" id={ANCHOR_BY_TYPE.timeline}>
      <div
        className="container"
        onMouseEnter={() => pause()}
        onMouseLeave={resume}
        onFocus={() => pause()}
        onBlur={resume}
        onTouchStart={() => pause(AUTOPLAY_MS * 2)}
      >
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
                    {/* Gambar atau video singkat opsional per tonggak (video bisu, berulang). */}
                    {item.media?.url && (
                      <figure className="road-media">
                        {item.media.mime?.startsWith('video/') ? (
                          <MediaVideo source={item.media} background muted loop playsInline autoPlay preload="metadata" />
                        ) : (
                          <Image src={item.media.url} alt={title || name} fill sizes="(max-width: 720px) 90vw, 280px" style={{ objectFit: 'cover', ...frameStyle(item.media.frame) }} />
                        )}
                      </figure>
                    )}
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

const AUTOPLAY_MS = 4000;

// Jarak antar tonggak (lebar kolom + celah), cadangan 320px bila belum terukur.
function stopStep(el: HTMLElement): number {
  const [a, b] = el.querySelectorAll<HTMLElement>('.road-stop');
  if (a && b) return b.offsetLeft - a.offsetLeft;
  return a?.offsetWidth ?? 320;
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
