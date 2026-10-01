'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { tr } from '@/lib/cms';
import styles from '@/app/(auth)/login/page.module.css';

interface Slide {
  src: string;
  kind: 'image' | 'video';
  caption: { id: string; en: string };
}

// Foto bawaan bila admin belum mengisi Pengaturan Situs → "Halaman login" (settings.auth.slides).
const DEFAULT_SLIDES: Slide[] = [
  { src: '/img/pabrik-2-1.png', kind: 'image', caption: { id: 'Karet hilir Nusantara, diproses untuk dunia.', en: 'Nusantara downstream rubber, made for the world.' } },
  { src: '/img/produksi-karet-1.webp', kind: 'image', caption: { id: 'Mutu teruji sejak 1965.', en: 'Proven quality since 1965.' } },
  { src: '/img/karet-1-1-scaled.jpg', kind: 'image', caption: { id: 'Pesan produk karet industri secara online.', en: 'Order industrial rubber products online.' } },
];
const INTERVAL_MS = 5500;

// Panel foto/video halaman login/registrasi/lupa password: slideshow (foto berganti tiap 5,5 detik, video berganti saat
// selesai diputar), logo, tombol kembali ke situs, teks per slide, dan titik indikator. Panel ini yang bergeser
// kiri ↔ kanan saat berpindah login ↔ daftar.
export default function AuthVisual() {
  const { lang } = useLang();
  const { settings } = useSite();
  const slides = useMemo<Slide[]>(() => {
    const custom = (settings.auth?.slides ?? [])
      .filter((s) => s.media?.url)
      .map((s) => ({
        src: s.media.url,
        kind: (s.media.mime || '').startsWith('video/') ? ('video' as const) : ('image' as const),
        caption: { id: tr(s.caption, 'id'), en: tr(s.caption, 'en') },
      }));
    return custom.length > 0 ? custom : DEFAULT_SLIDES;
  }, [settings.auth?.slides]);
  const [index, setIndex] = useState(0);
  const current = slides[index] ?? slides[0]!;
  const next = useCallback(() => setIndex((i) => (i + 1) % slides.length), [slides.length]);

  useEffect(() => {
    if (slides.length < 2 || current.kind === 'video') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(next, INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [index, slides.length, current.kind, next]);

  return (
    <aside className={styles.visual} aria-label="PT Industri Karet Nusantara">
      {slides.map((slide, i) => (
        <div key={`${slide.src}-${i}`} className={`${styles.visualSlide} ${i === index ? styles.visualSlideOn : ''}`} aria-hidden={i !== index}>
          {slide.kind === 'video' ? (
            i === index && (
              <video
                className={styles.visualVideo}
                src={slide.src}
                autoPlay
                muted
                playsInline
                loop={slides.length < 2}
                onEnded={slides.length > 1 ? next : undefined}
              />
            )
          ) : (
            <Image src={slide.src} alt="" fill sizes="(max-width: 860px) 100vw, 560px" priority={i === 0} style={{ objectFit: 'cover' }} />
          )}
        </div>
      ))}
      <div className={styles.visualShade} aria-hidden="true" />
      <div className={styles.visualTop}>
        <Link href="/" className={styles.visualLogo} aria-label={lang === 'en' ? 'PT IKN home' : 'Beranda PT IKN'}>
          <Image src="/img/rubin-logo.png" alt="" width={40} height={40} />
          <span>
            <strong>PT IKN</strong>
            <small>Industri Karet Nusantara</small>
          </span>
        </Link>
        <Link href="/" className={styles.visualBack}>
          {lang === 'en' ? 'Back to website' : 'Kembali ke situs'} <Icon name="arrow" size={15} />
        </Link>
      </div>
      <div className={styles.visualBottom}>
        {(current.caption[lang] || current.caption.id) && (
          <p key={index} className={styles.visualCaption}>
            {current.caption[lang] || current.caption.id}
          </p>
        )}
        {slides.length > 1 && (
          <div className={styles.visualDots} role="tablist" aria-label={lang === 'en' ? 'Photos' : 'Foto'}>
            {slides.map((slide, i) => (
              <button
                key={`${slide.src}-${i}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1} / ${slides.length}`}
                className={`${styles.visualDot} ${i === index ? styles.visualDotOn : ''}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
