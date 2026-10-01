'use client';

import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, type SpecTableContent } from '../utils';

// Tabel spesifikasi: pasangan parameter-nilai dalam dua kolom (satu kolom di layar kecil) + catatan kaki opsional.
export default function SpecTableSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as SpecTableContent;
  const rows = asList<SpecTableContent['rows'][number]>(c.rows).filter((row) => tr(row.label, lang));
  if (rows.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const note = tr(c.note, lang);

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && <p className="lead sec-lead">{lead}</p>}
        <dl className="spec-sheet">
          {rows.map((row, i) => (
            <div key={i} className="spec-sheet-row">
              <dt>{tr(row.label, lang)}</dt>
              <dd>{tr(row.value, lang)}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="spec-sheet-note">{note}</p>}
      </div>
    </section>
  );
}
