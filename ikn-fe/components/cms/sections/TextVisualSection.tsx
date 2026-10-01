'use client';

import Image from 'next/image';
import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { paragraphs, tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SmartLink from '../SmartLink';
import { asText, looksLikeHtml, type TextVisualContent } from '../utils';

// Teks di satu sisi, visual di sisi lain (image_side). Visual = foto bila diisi; tanpa foto tampil panel
// berwarna tema berisi label + kata besar. Dipakai profil (Tentang), lini bisnis, REACH.
export default function TextVisualSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as TextVisualContent;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const body = tr(c.body, lang);
  const button = tr(c.button_label, lang);
  const buttonUrl = asText(c.button_url);
  const visualLabel = asText(c.visual_label);
  const visualMark = asText(c.visual_mark);
  const imageUrl = c.image?.url || '';
  const hasVisual = Boolean(imageUrl || visualLabel || visualMark);
  const flip = asText(c.image_side) === 'left';

  return (
    // id = key section agar bisa jadi tujuan anchor menu (mis. /bisnis#resiprene-35).
    <section className="section" id={section.key || undefined}>
      <div className={`container about-grid${flip ? ' is-flip' : ''}${hasVisual ? '' : ' is-text-only'}`}>
        <div className="about-body">
          {label && <span className="label label-green">{label}</span>}
          {heading && <h2 className="h2 about-heading">{heading}</h2>}
          {looksLikeHtml(body) ? (
            // HTML comes from the internal admin editor, not from public input.
            <div className="about-richtext" dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            paragraphs(body).map((p, i) => <p key={i}>{p}</p>)
          )}
          {button && buttonUrl && (
            <SmartLink href={buttonUrl} className="btn btn-solid about-btn">
              {button} <Icon name="arrow" />
            </SmartLink>
          )}
        </div>

        {imageUrl ? (
          <Reveal as="figure" className="about-figure">
            <div className="about-figure-frame">
              <Image src={imageUrl} alt={tr(c.image_alt, lang) || heading} fill sizes="(max-width: 780px) 100vw, 560px" style={{ objectFit: 'cover' }} />
            </div>
            {visualLabel && <figcaption className="about-figure-cap">{visualLabel}</figcaption>}
          </Reveal>
        ) : (
          hasVisual && (
            <Reveal className="about-visual">
              {visualLabel && <span className="label">{visualLabel}</span>}
              {visualMark && <span className="about-visual-mark">{visualMark}</span>}
            </Reveal>
          )
        )}
      </div>
    </section>
  );
}
