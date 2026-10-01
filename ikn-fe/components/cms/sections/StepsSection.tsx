'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, asText, iconName, pad2, type StepsContent } from '../utils';

// Alur berurutan (proses produksi, cara pemesanan): nomor urut + ikon opsional, judul, uraian; garis penghubung antar langkah.
export default function StepsSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as StepsContent;
  const items = asList<StepsContent['items'][number]>(c.items);
  if (items.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && <p className="lead sec-lead">{lead}</p>}
        <ol className="proc-steps">
          {items.map((step, i) => {
            const body = tr(step.body, lang);
            return (
              <Reveal as="li" key={i} className="proc-step" delay={Math.min(i, 6) * 70}>
                <div className="proc-step-mark">
                  <span className="proc-step-num">{pad2(i + 1)}</span>
                  {asText(step.icon) && <Icon name={iconName(step.icon, 'check')} size={20} strokeWidth={1.5} />}
                </div>
                <h3 className="h3 proc-step-title">{tr(step.title, lang)}</h3>
                {body && <p className="proc-step-body">{body}</p>}
              </Reveal>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
