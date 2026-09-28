'use client';

import Marquee from '@/components/Marquee';
import type { PageSection } from '@/lib/cms';
import { marqueeItems } from './HeroSection';

// Standalone marquee (only when it is not placed right after a hero section).
export default function MarqueeSection({ section }: { section: PageSection }) {
  const words = marqueeItems(section);
  if (words.length === 0) return null;
  return (
    <div style={{ position: 'relative', minHeight: 52 }}>
      <Marquee items={words} />
    </div>
  );
}
