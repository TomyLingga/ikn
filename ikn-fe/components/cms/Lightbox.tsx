'use client';

import { useCallback, useEffect } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';

export interface LightboxPhoto {
  id: number | string;
  src: string;
  title: string;
}

interface LightboxProps {
  photos: LightboxPhoto[];
  index: number;
  onChange: (index: number) => void;
  onClose: () => void;
  lang: string;
}

// Pratinjau foto layar penuh: panah kiri/kanan, Esc, klik latar untuk menutup; scroll halaman dikunci.
// Dipakai section gallery (menu Galeri) dan image_grid (foto pilihan).
export default function Lightbox({ photos, index, onChange, onClose, lang }: LightboxProps) {
  const total = photos.length;
  const prev = useCallback(() => onChange((index - 1 + total) % total), [index, total, onChange]);
  const next = useCallback(() => onChange((index + 1) % total), [index, total, onChange]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') prev();
      if (event.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, prev, next]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={photo.title} onClick={onClose}>
      <button type="button" className="lightbox-btn lightbox-close" onClick={onClose} aria-label={lang === 'en' ? 'Close' : 'Tutup'}>
        <Icon name="close" size={22} />
      </button>
      {total > 1 && (
        <button type="button" className="lightbox-btn lightbox-prev" onClick={(e) => { e.stopPropagation(); prev(); }} aria-label={lang === 'en' ? 'Previous' : 'Sebelumnya'}>
          <Icon name="chevronLeft" size={26} />
        </button>
      )}
      <figure className="lightbox-figure" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-image">
          <Image src={photo.src} alt={photo.title} fill sizes="92vw" style={{ objectFit: 'contain' }} priority />
        </div>
        <figcaption className="lightbox-cap">
          {photo.title}
          <span className="lightbox-count">
            {index + 1} / {total}
          </span>
        </figcaption>
      </figure>
      {total > 1 && (
        <button type="button" className="lightbox-btn lightbox-next" onClick={(e) => { e.stopPropagation(); next(); }} aria-label={lang === 'en' ? 'Next' : 'Berikutnya'}>
          <Icon name="chevronRight" size={26} />
        </button>
      )}
    </div>
  );
}
