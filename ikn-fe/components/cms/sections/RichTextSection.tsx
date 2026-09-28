'use client';

import { useLang } from '@/components/LanguageProvider';
import { paragraphs, tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { looksLikeHtml, type RichTextContent } from '../utils';

// Generic text block with heading.
export default function RichTextSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as RichTextContent;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const body = tr(c.body, lang);

  return (
    <section className="section">
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} reveal={false} />}
        {looksLikeHtml(body) ? (
          // HTML comes from the internal admin editor, not from public input.
          <div className="article-body" dangerouslySetInnerHTML={{ __html: body }} />
        ) : (
          <div className="article-body">
            {paragraphs(body).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
