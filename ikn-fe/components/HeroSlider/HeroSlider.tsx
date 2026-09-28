'use client';

import { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/Icon';

// Slider gambar latar hero — cross-fade otomatis antar foto. Foto berasal dari CMS (section hero).
export interface HeroSlide {
  src: string;
  alt: string;
}

const INTERVAL = 5000;

export default function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const count = slides.length;

  const nextSlide = useCallback(() => {
    if (count === 0) return;
    setActive((i) => (i + 1) % count);
  }, [count]);

  const prevSlide = useCallback(() => {
    if (count === 0) return;
    setActive((i) => (i - 1 + count) % count);
  }, [count]);

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(nextSlide, INTERVAL);
    return () => clearInterval(id);
  }, [nextSlide, count]);

  return (
    <div className="hero-slider">
      {slides.map((s, i) => (
        <div
          key={`${s.src}-${i}`}
          aria-hidden="true"
          className={`hero-slide ${i === active ? 'is-active' : ''}`}
          style={{ backgroundImage: `url(${s.src})` }}
        />
      ))}
      <span className="hero-video-scrim" aria-hidden="true" />

      {count > 1 && (
        <>
          <button className="hero-slider-arrow prev" onClick={prevSlide} aria-label="Sebelumnya">
            <Icon name="chevronLeft" />
          </button>
          <button className="hero-slider-arrow next" onClick={nextSlide} aria-label="Selanjutnya">
            <Icon name="chevronRight" />
          </button>

          <div className="hero-slider-dots">
            {slides.map((s, i) => (
              <button
                key={`${s.src}-${i}`}
                type="button"
                className={`hero-slider-dot ${i === active ? 'is-active' : ''}`}
                aria-label={s.alt}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
