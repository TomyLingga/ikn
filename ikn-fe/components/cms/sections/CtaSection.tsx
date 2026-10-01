'use client';

import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SmartLink from '../SmartLink';
import { asText, type CtaContent } from '../utils';

// Pita ajakan berwarna tema: teks di kiri, satu atau dua tombol di kanan; foto latar opsional di balik lapisan warna.
export default function CtaSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as CtaContent;
  const label = tr(c.label, lang);
  const body = tr(c.body, lang);
  const button = tr(c.button_label, lang);
  const secondary = tr(c.secondary_label, lang);
  const secondaryUrl = asText(c.secondary_url);
  const background = c.background?.url || '';

  return (
    <section className={`cta${background ? ' cta-has-bg' : ''}`} id={section.key || undefined}>
      {background && <Image src={background} alt="" fill sizes="100vw" className="cta-bg" style={{ objectFit: 'cover' }} />}
      <div className="container cta-inner">
        <div className="cta-text">
          {label && <span className="label cta-label">{label}</span>}
          <Reveal as="h2" className="h2 cta-title">
            {tr(c.title, lang)}
          </Reveal>
          {body && <p className="cta-body">{body}</p>}
        </div>
        {(button || (secondary && secondaryUrl)) && (
          <div className="cta-actions">
            {button && (
              <SmartLink href={asText(c.button_url) || '/kontak'} className="btn cta-btn">
                {button} <Icon name="arrow" />
              </SmartLink>
            )}
            {secondary && secondaryUrl && (
              <SmartLink href={secondaryUrl} className="btn cta-btn-ghost">
                {secondary} <Icon name="arrow" />
              </SmartLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
