'use client';

import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { paragraphs, tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, type FaqContent } from '../utils';

// Tanya jawab: judul di kiri, daftar pertanyaan buka-tutup (<details>, tanpa JS) di kanan.
export default function FaqSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as FaqContent;
  const items = asList<FaqContent['items'][number]>(c.items).filter((item) => tr(item.question, lang));
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container faq">
        <div className="faq-intro">
          {(label || heading) && <SecHead label={label} heading={heading} reveal={false} />}
          {lead && <p className="lead">{lead}</p>}
        </div>
        <div className="faq-list">
          {items.map((item, i) => (
            <details key={i} className="faq-item" open={i === 0}>
              <summary>
                <span>{tr(item.question, lang)}</span>
                <Icon name="plus" size={18} className="faq-icon" />
              </summary>
              <div className="faq-answer">
                {paragraphs(tr(item.answer, lang)).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
