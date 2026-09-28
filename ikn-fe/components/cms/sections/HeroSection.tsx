'use client';

import HeroSlider from '@/components/HeroSlider';
import HeroTitle from '@/components/HeroTitle';
import HeroSubtitle from '@/components/HeroSubtitle';
import HeroActions, { type HeroButton } from '@/components/HeroActions';
import Marquee from '@/components/Marquee';
import { useLang } from '@/components/LanguageProvider';
import { lines, tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, type HeroButtonItem, type HeroContent, type HeroMetaItem, type HeroSlideItem, type MarqueeContent } from '../utils';

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
