'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import type { ProductImage } from '@/lib/types';
import styles from './ProductGallery.module.css';

interface ProductGalleryProps {
  media: ProductImage[];
  name: string;
  code?: string;
  /** Foto yang dipakai sebagai gambar diam untuk thumbnail video (thumbnail produk). */
  poster?: string | null;
}

// Galeri produk geser (ASUMSI A-72): foto dan video dalam satu strip scroll-snap, jadi bisa digeser dengan jari
// di ponsel, dengan panah + thumbnail di layar besar. Video berhenti saat slide ditinggalkan.
export default function ProductGallery({ media, name, code, poster }: ProductGalleryProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const stage = useRef<HTMLDivElement>(null);
  const thumbs = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = media.length;

  const goTo = useCallback(
    (index: number) => {
      const el = stage.current;
      if (!el || total === 0) return;
      const next = Math.min(Math.max(index, 0), total - 1);
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    },
    [total],
  );

  // Slide aktif = yang paling dekat dengan posisi gulir.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  // Hentikan video yang tidak sedang tampil, dan jaga thumbnail aktif tetap terlihat.
  useEffect(() => {
    stage.current?.querySelectorAll('video').forEach((video, index) => {
      const slide = Number(video.dataset.slide ?? index);
      if (slide !== active && !video.paused) video.pause();
    });
    const strip = thumbs.current;
    const current = strip?.children[active] as HTMLElement | undefined;
    if (strip && current) {
      const left = current.offsetLeft - strip.clientWidth / 2 + current.clientWidth / 2;
      strip.scrollTo({ left, behavior: 'smooth' });
    }
  }, [active]);

  if (total === 0) {
    return (
      <div className={styles.gallery}>
        <div className={styles.frame}>
          <div className={styles.placeholder}>
            <Icon name="image" size={72} strokeWidth={0.9} />
          </div>
          {code && <span className={styles.code}>{code}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gallery}>
      <div className={styles.frame}>
        <div
          className={styles.stage}
          ref={stage}
          tabIndex={0}
          role="group"
          aria-roledescription="carousel"
          aria-label={`${t('Galeri', 'Gallery')} ${name}`}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') { event.preventDefault(); goTo(active + 1); }
            if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(active - 1); }
          }}
        >
          {media.map((item, index) => (
            <div key={item.id || item.url} className={styles.slide} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${total}`}>
              {item.type === 'video' ? (
                <video data-slide={index} src={item.url} controls playsInline preload="metadata" poster={poster || undefined} aria-label={`${t('Video', 'Video')} ${name}`} />
              ) : (
                <Image src={item.url} alt={`${name} ${index + 1}`} fill sizes="(max-width: 900px) 100vw, 560px" priority={index === 0} />
              )}
            </div>
          ))}
        </div>

        {code && <span className={styles.code}>{code}</span>}
        {total > 1 && (
          <>
            <span className={styles.counter} aria-hidden="true">
              {active + 1}/{total}
            </span>
            <button type="button" className={`${styles.arrow} ${styles.prev}`} onClick={() => goTo(active - 1)} disabled={active === 0} aria-label={t('Media sebelumnya', 'Previous media')}>
              <Icon name="chevronLeft" size={20} />
            </button>
            <button type="button" className={`${styles.arrow} ${styles.next}`} onClick={() => goTo(active + 1)} disabled={active === total - 1} aria-label={t('Media berikutnya', 'Next media')}>
              <Icon name="chevronRight" size={20} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className={styles.thumbs} ref={thumbs}>
          {media.map((item, index) => (
            <button
              key={item.id || item.url}
              type="button"
              className={`${styles.thumb} ${index === active ? styles.thumbOn : ''}`}
              onClick={() => goTo(index)}
              aria-label={`${item.type === 'video' ? t('Video', 'Video') : t('Foto', 'Photo')} ${index + 1}`}
              aria-current={index === active}
            >
              {item.type === 'video' ? (
                <>
                  {poster && <Image src={poster} alt="" fill sizes="72px" />}
                  <span className={styles.play}>
                    <Icon name="play" size={16} />
                  </span>
                </>
              ) : (
                <Image src={item.url} alt="" fill sizes="72px" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
