// Ikon media sosial: unggahan admin (media) bila ada, selain itu glyph bawaan menurut platform yang dikenali
// dari label/URL (Instagram, YouTube, TikTok, Facebook, X, LinkedIn, WhatsApp, Telegram, Threads; lainnya = globe).
import type { ReactNode } from 'react';
import type { MediaSummary } from '@/lib/cms';

export type SocialPlatform =
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'x'
  | 'linkedin'
  | 'whatsapp'
  | 'telegram'
  | 'threads'
  | 'web';

const RULES: [SocialPlatform, RegExp][] = [
  ['instagram', /instagram/i],
  ['youtube', /youtube|youtu\.be/i],
  ['tiktok', /tiktok/i],
  ['facebook', /facebook|fb\.com|\bfb\b/i],
  ['x', /twitter|(^|\W)x\.com|^x$/i],
  ['linkedin', /linkedin/i],
  ['whatsapp', /whatsapp|wa\.me/i],
  ['telegram', /telegram|t\.me/i],
  ['threads', /threads/i],
];

export function detectPlatform(label: string, url = ''): SocialPlatform {
  const haystack = `${label} ${url}`;
  for (const [platform, rule] of RULES) {
    if (rule.test(haystack)) return platform;
  }
  return 'web';
}

const fill = (path: string) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
    <path d={path} />
  </svg>
);

const stroke = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const GLYPHS: Record<SocialPlatform, ReactNode> = {
  instagram: stroke(
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </>,
  ),
  youtube: stroke(
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="3.5" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </>,
  ),
  tiktok: fill(
    'M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-1.99 6.13-1.59.02 1.48-.04 2.96-.04 4.44-.98-.32-2.13-.23-2.99.37-.62.41-1.1 1.03-1.34 1.73-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  ),
  facebook: fill('M13.5 22v-8h2.7l.4-3.2h-3.1V8.8c0-.9.3-1.6 1.6-1.6h1.7V4.4c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.2H7.4V14h2.8v8h3.3z'),
  x: fill('M17.5 3h3l-6.8 7.8L21.7 21h-6.3l-4.9-6.4L4.9 21h-3l7.3-8.3L1.5 3h6.4l4.4 5.9L17.5 3zm-1.1 16.2h1.7L6.9 4.7H5.1l11.3 14.5z'),
  linkedin: fill('M6.5 8.5H3V21h3.5V8.5zM4.8 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM21 13.4c0-3.4-1.8-5.2-4.5-5.2-1.6 0-2.7.8-3.2 1.7V8.5H9.9V21h3.5v-6.6c0-1.6.6-2.6 2.1-2.6s2 1.1 2 2.6V21H21v-7.6z'),
  whatsapp: fill(
    'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 1.8a8.2 8.2 0 1 1-4.2 15.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 0 1 12 3.8zm-3.3 4.4c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3.1 4.9 4.3 2.4 1 2.9.8 3.4.7.5 0 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.3-.1-.1-.3-.2-.5-.3l-1.9-.9c-.3-.1-.4-.1-.6.1l-.9 1.1c-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.2-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.1c-.2-.5-.4-.4-.6-.4h-.5z',
  ),
  telegram: fill('M21.9 4.6 18.7 19.7c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.5-.6-.2L6.2 13.4 1.4 11.9c-1-.3-1-1 .2-1.5L20.5 3.1c.9-.3 1.6.2 1.4 1.5z'),
  threads: stroke(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 13.5c0-1.7 1.6-2.5 3.5-2.5 2.2 0 3.5 1 3.5 2.6 0 1.8-1.6 2.9-3.3 2.9-1.5 0-2.7-.9-2.7-2 0-1.2 1.1-1.9 2.6-1.9 1.9 0 3.4.6 4.4 1.8M9 9.5c.6-1.2 1.7-1.9 3.1-1.9 2 0 3.3 1.4 3.4 3.6" />
    </>,
  ),
  web: stroke(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>,
  ),
};

interface SocialIconProps {
  label: string;
  url?: string;
  icon?: MediaSummary | null;
  className?: string;
}

// Kotak ikon: <img> unggahan admin atau glyph bawaan. Ukuran ikut font-size wadah (.social-icon).
export default function SocialIcon({ label, url = '', icon, className = 'social-icon' }: SocialIconProps) {
  return (
    <span className={className} aria-hidden="true">
      {icon?.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon.url} alt="" />
      ) : (
        GLYPHS[detectPlatform(label, url)]
      )}
    </span>
  );
}
