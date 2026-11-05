'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { VideoLightbox } from '@/components/VideoGallery';
import HeroTileMap from '@/components/HeroTileMap';
import MediaVideo, { isEmbedVideo, type VideoSource } from '@/components/MediaVideo';
import { useSite } from '@/components/SiteProvider';
import SmartLink from '../SmartLink';
import HeroSlider from '@/components/HeroSlider';
import HeroTitle from '@/components/HeroTitle';
import HeroSubtitle from '@/components/HeroSubtitle';
import HeroActions, { type HeroButton } from '@/components/HeroActions';
import Marquee from '@/components/Marquee';
import { useLang } from '@/components/LanguageProvider';
import { lines, tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, contactMapPoints, mapsUrl, type HeroButtonItem, type HeroContent, type HeroMetaItem, type HeroSlideItem, type MarqueeContent } from '../utils';

interface Props {
  section: PageSection;
  marquee?: PageSection | null;
}

export function marqueeItems(section: PageSection | null | undefined): string[] {
  if (!section) return [];
  const c = section.content as MarqueeContent;
  return asList<{ text: string }>(c.items)
    .map((i) => asText(i.text).trim())
    .filter(Boolean);
}

const HEX = /^#[0-9a-f]{6}$/i;

// Home hero: background slider, meta labels (warna bebas), multi-line title, subtitle, tombol 0..n.
// The marquee section that follows it in the CMS is rendered inside the hero (absolute bottom).
export default function HeroSection({ section, marquee }: Props) {
  const { lang } = useLang();
  const c = section.content as HeroContent;

  const slides = asList<HeroSlideItem>(c.slides).flatMap((s) =>
    s.image?.url ? [{ src: s.image.url, alt: tr(s.alt, lang) }] : [],
  );
  const meta = asList<HeroMetaItem>(c.meta);
  const titleLines = lines(tr(c.title, lang));
  const words = marqueeItems(marquee);

  // Konten lama (sebelum migrasi) masih memakai primary_*/secondary_*; tetap dirender.
  const buttons: HeroButton[] = asList<HeroButtonItem>(c.buttons).map((b) => ({
    label: tr(b.label, lang),
    url: asText(b.url),
    style: asText(b.style) || 'solid',
    profileDocument: b.profile_document === true,
    newTab: b.new_tab === true,
  }));
  if (buttons.length === 0 && c.buttons === undefined) {
    if (tr(c.primary_label, lang)) buttons.push({ label: tr(c.primary_label, lang), url: asText(c.primary_url) || '/produk', style: 'solid', profileDocument: false, newTab: false });
    if (tr(c.secondary_label, lang)) buttons.push({ label: tr(c.secondary_label, lang), url: asText(c.secondary_url) || '/tentang', style: 'outline', profileDocument: true, newTab: false });
  }

  if (c.layout === 'grid') {
    return <HeroGrid c={c} slides={slides} meta={meta} titleLines={titleLines} buttons={buttons} lang={lang} />;
  }

  return (
    <section className="hero hero-video-section">
      <HeroSlider slides={slides} />

      <div className="container hero-content">
        <div className="hero-meta">
          {meta.map((m, i) => {
            const color = asText(m.color);
            const legacyGreen = !color && m.style === 'green';
            return (
              <span
                key={i}
                className={legacyGreen ? 'label label-green' : 'label'}
                style={HEX.test(color) ? { color } : undefined}
              >
                {tr(m.text, lang)}
              </span>
            );
          })}
        </div>

        <HeroTitle lines={titleLines} />

        <div className="hero-foot">
          <HeroSubtitle text={tr(c.subtitle, lang)} />
          <HeroActions buttons={buttons} />
        </div>
      </div>
      {words.length > 0 && <Marquee items={words} />}
    </section>
  );
}

/**
 * Hero kisi layar penuh (2026-11-04, referensi pkaymetal.com): video/foto memenuhi layar dengan garis kisi tipis,
 * judul besar, sel angka, ubin angka sorotan, kartu sorotan bergambar + tombol Tonton (YouTube), dan teks pojok.
 * Mulai di bawah tinggi navbar (`--nav-h`) agar navbar tetap utuh di atasnya.
 */
function HeroGrid({
  c,
  slides,
  meta,
  titleLines,
  buttons,
  lang,
}: {
  c: HeroContent;
  slides: { src: string; alt: string }[];
  meta: HeroMetaItem[];
  titleLines: string[];
  buttons: HeroButton[];
  lang: 'id' | 'en';
}) {
  const [playing, setPlaying] = useState(false);
  const site = useSite();
  const videos = [c.video, ...asList<{ file?: VideoSource | null }>(c.videos).map((v) => v.file)].filter((v): v is VideoSource => !!v?.url);
  const links = asList<{ title: HeroContent['title']; note?: HeroContent['title']; image?: { url?: string } | null; url: string }>(c.links).filter((l) => tr(l.title, lang) && asText(l.url));
  // Lokasi fasilitas di ubin peta: daftar dari CMS (`locations`), kosong = lokasi blok kontak halaman Kontak.
  const ownFacilities = asList<NonNullable<HeroContent['locations']>[number]>(c.locations)
    .map((l) => {
      const lat = l.geo?.lat;
      const lng = l.geo?.lng;
      const ok = typeof lat === 'number' && typeof lng === 'number' && Number.isFinite(lat) && Number.isFinite(lng);
      return { name: tr(l.name, lang), note: tr(l.note, lang), lat: ok ? lat : null, lng: ok ? lng : null };
    })
    .filter((f) => f.name);
  const facilities =
    ownFacilities.length > 0 || !c.tile_map || !site.contact
      ? ownFacilities
      : contactMapPoints(site.contact, lang).map((p) => ({ name: p.name, note: p.address, lat: p.lat as number | null, lng: p.lng as number | null }));
  const pins = c.tile_map ? facilities.flatMap((f, index) => (f.lat !== null && f.lng !== null ? [{ index, name: f.name, lat: f.lat, lng: f.lng }] : [])) : [];
  const [activeFac, setActiveFac] = useState<number | null>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const pickFacility = (i: number) => setActiveFac((cur) => (cur === i ? null : i));
  useEffect(() => {
    if (activeFac === null) return;
    // Kartu info ditutup dengan Escape atau klik di luar ubin.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setActiveFac(null);
    const onDown = (e: PointerEvent) => !tileRef.current?.contains(e.target as Node) && setActiveFac(null);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [activeFac]);
  const active = activeFac !== null ? facilities[activeFac] : undefined;
  const stats = asList<{ value: string; label: HeroContent['title'] }>(c.stats).filter((s) => asText(s.value));
  const overlay = Math.min(90, Math.max(0, typeof c.overlay === 'number' ? c.overlay : 45)) / 100;
  const videoId = asText(c.video_id);
  const cardTitle = tr(c.card_title, lang);
  const cardNote = tr(c.card_note, lang);
  // {year} di teks pojok diganti tahun berjalan (mis. "Copyright © 1965-{year} ...").
  const corner = tr(c.corner_text, lang).replace(/\{year\}/g, String(new Date().getFullYear()));
  const watch = lang === 'en' ? 'Watch Video' : 'Tonton Video';

  return (
    <section className="hgrid" style={{ '--hgrid-overlay': overlay } as CSSProperties}>
      <div className="hgrid-media" aria-hidden="true">
        {videos.length > 0 ? <VideoPlaylist sources={videos} poster={slides[0]?.src} /> : <HeroSlider slides={slides} />}
      </div>
      <div className="hgrid-scrim" aria-hidden="true" />

      <div className="hgrid-cells">
        <div className="hgrid-cell hgrid-stat">
          {stats[0] && (
            <>
              <strong>{asText(stats[0].value)}</strong>
              <span>{tr(stats[0].label, lang)}</span>
            </>
          )}
        </div>

        <div className="hgrid-cell hgrid-main">
          {meta.length > 0 && (
            <div className="hgrid-meta">
              {meta.map((m, i) => {
                const color = asText(m.color);
                return (
                  <span key={i} className="hgrid-meta-item" style={HEX.test(color) ? { color } : undefined}>
                    {tr(m.text, lang)}
                  </span>
                );
              })}
            </div>
          )}
          <h1 className="hgrid-title">
            {titleLines.map((line, i) => (
              <span key={i}>{line}</span>
            ))}
          </h1>
          {tr(c.subtitle, lang) && <p className="hgrid-sub">{tr(c.subtitle, lang)}</p>}
          <div className="hgrid-actions">
            <HeroActions buttons={buttons.slice(0, 1)} />
            {videoId && (
              <button type="button" className="hgrid-watch" onClick={() => setPlaying(true)}>
                {watch} <Icon name="play" size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="hgrid-cell hgrid-aside">
          {links.length > 0 && (
            <ul className="hgrid-links">
              {links.map((l, i) => (
                <li key={i}>
                  <SmartLink href={asText(l.url)} className="hgrid-link">
                    {l.image?.url && (
                      <span className="hgrid-link-img">
                        <Image src={l.image.url} alt="" fill sizes="56px" style={{ objectFit: 'cover' }} />
                      </span>
                    )}
                    <span className="hgrid-link-text">
                      <strong>{tr(l.title, lang)}</strong>
                      {/* "Jenis · Lokasi" = dua baris: jenis produk lalu lokasi pabrik berikon pin. */}
                      {tr(l.note, lang)
                        .split(' · ')
                        .filter(Boolean)
                        .map((part, j) =>
                          j === 0 ? (
                            <small key={j}>{part}</small>
                          ) : (
                            <small key={j} className="hgrid-link-place">
                              <Icon name="pin" size={11} /> {part}
                            </small>
                          ),
                        )}
                    </span>
                    <Icon name="arrow" size={16} />
                  </SmartLink>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div ref={tileRef} className={`hgrid-cell hgrid-tile${pins.length > 0 ? ' has-map' : ''}${facilities.length > 0 ? ' is-facilities' : ''}`}>
          {pins.length > 0 && (
            <span className="hgrid-tile-map" aria-hidden="true">
              <HeroTileMap pins={pins} active={activeFac} onSelect={pickFacility} />
            </span>
          )}
          {facilities.length > 0 ? (
            <>
              <div className="hgrid-fac-head">
                <span className="hgrid-fac-label">{tr(c.tile_label, lang) || (lang === 'en' ? 'Facility locations' : 'Lokasi fasilitas')}</span>
                {stats[1] && (
                  <span className="hgrid-fac-count">
                    <strong>{asText(stats[1].value)}</strong>
                    <small>{tr(stats[1].label, lang)}</small>
                  </span>
                )}
              </div>
              <div className="hgrid-fac-body">
                <ul className="hgrid-fac-list">
                  {facilities.map((f, i) => (
                    <li key={i}>
                      <button type="button" className={activeFac === i ? 'is-active' : undefined} aria-expanded={activeFac === i} aria-controls="hgrid-fac-card" onClick={() => pickFacility(i)}>
                        <i aria-hidden="true" />
                        {f.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              {active && (
                <div className="hgrid-fac-card" id="hgrid-fac-card" role="region" aria-label={active.name}>
                  <button type="button" className="hgrid-fac-close" onClick={() => setActiveFac(null)} aria-label={lang === 'en' ? 'Close' : 'Tutup'}>
                    <Icon name="close" size={14} />
                  </button>
                  <small>{lang === 'en' ? 'Production facility' : 'Fasilitas produksi'}</small>
                  <strong>{active.name}</strong>
                  {active.note && <p>{active.note}</p>}
                  {active.lat !== null && active.lng !== null && (
                    <a href={mapsUrl(active.lat, active.lng)} target="_blank" rel="noopener noreferrer">
                      {lang === 'en' ? 'Open in Maps' : 'Buka di peta'} <Icon name="arrow" size={12} style={{ transform: 'rotate(-45deg)' }} />
                    </a>
                  )}
                </div>
              )}
            </>
          ) : (
            stats[1] && (
              <>
                <strong>{asText(stats[1].value)}</strong>
                <span>{tr(stats[1].label, lang)}</span>
              </>
            )
          )}
        </div>

        <div className="hgrid-cell hgrid-card-cell">
          {(cardTitle || c.card_image?.url) && (
            <div className="hgrid-card">
              <div className="hgrid-card-text">
                {cardTitle && <p className="hgrid-card-title">{cardTitle}</p>}
                {cardNote && (
                  <span className="hgrid-card-note">
                    <i aria-hidden="true" /> {cardNote}
                  </span>
                )}
              </div>
              {c.card_image?.url && (
                <span className="hgrid-card-img">
                  <Image src={c.card_image.url} alt="" fill sizes="(max-width: 900px) 50vw, 320px" style={{ objectFit: 'contain', objectPosition: 'bottom center' }} />
                </span>
              )}
              {videoId && (
                <button type="button" className="hgrid-play" onClick={() => setPlaying(true)} aria-label={watch}>
                  <span>
                    <Icon name="play" size={18} />
                  </span>
                  <small>{lang === 'en' ? 'Watch' : 'Tonton'}</small>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="hgrid-cell hgrid-corner">
          {c.corner_image?.url && (
            <span className="hgrid-corner-img">
              <Image src={c.corner_image.url} alt="" fill sizes="160px" style={{ objectFit: 'cover' }} />
            </span>
          )}
          {corner && <p>{corner}</p>}
        </div>
      </div>

      {playing && videoId && <VideoLightbox video={{ id: videoId, title: titleLines.join(' '), desc: '' }} onClose={() => setPlaying(false)} />}
    </section>
  );
}

/**
 * Beberapa video latar diputar bergantian: tiap video bertumpuk, hanya yang aktif berjalan dan terlihat; saat
 * selesai, video berikutnya diputar dengan transisi pudar. Satu video saja = diulang terus.
 */
function VideoPlaylist({ sources, poster }: { sources: VideoSource[]; poster?: string }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);
  const single = sources.length === 1;

  // Video dari URL (iframe YouTube/Vimeo) berulang sendiri dan tidak memberi sinyal selesai: berganti tiap 30 detik.
  useEffect(() => {
    if (single || !isEmbedVideo(sources[active])) return;
    const timer = window.setTimeout(() => setActive((a) => (a + 1) % sources.length), 30000);
    return () => window.clearTimeout(timer);
  }, [active, single, sources]);

  useEffect(() => {
    refs.current.forEach((video, i) => {
      if (!video) return;
      if (i === active) {
        video.currentTime = 0;
        void video.play().catch(() => undefined);
      } else {
        video.pause();
      }
    });
  }, [active]);

  return (
    <>
      {sources.map((src, i) => (
        <MediaVideo
          key={`${src.url}-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={`hgrid-video${i === active ? ' is-active' : ''}`}
          source={src}
          background
          muted
          playsInline
          loop={single}
          autoPlay={i === 0}
          preload={i === 0 ? 'auto' : 'metadata'}
          poster={i === 0 ? poster : undefined}
          onEnded={() => setActive((a) => (a + 1) % sources.length)}
        />
      ))}
    </>
  );
}
