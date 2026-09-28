'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { paragraphs, tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SmartLink from '../SmartLink';
import { asText, looksLikeHtml, type TextVisualContent } from '../utils';

// Paragraphs on the left, visual block (label + big mark) on the right. Used by /tentang and /keberlanjutan/reach.
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

  return (
    <section className="section">
      <div className="container about-grid">
        <div className="about-body">
          {label && <span className="label label-green">{label}</span>}
          {heading && (
            <h2 className="h2" style={{ margin: '16px 0 22px', maxWidth: '18ch' }}>
              {heading}
            </h2>
          )}
          {looksLikeHtml(body) ? (
            // HTML comes from the internal admin editor, not from public input.
            <div dangerouslySetInnerHTML={{ __html: body }} />
          ) : (
            paragraphs(body).map((p, i) => <p key={i}>{p}</p>)
          )}
          {button && buttonUrl && (
            <SmartLink href={buttonUrl} className="btn btn-solid" style={{ marginTop: 12 }}>
              {button} <Icon name="arrow" />
            </SmartLink>
          )}
        </div>

        {(visualLabel || visualMark) && (
          <Reveal className="about-visual">
            {visualLabel && <span className="label">{visualLabel}</span>}
            {visualMark && <span className="about-visual-mark">{visualMark}</span>}
          </Reveal>
        )}
      </div>
    </section>
  );
}
