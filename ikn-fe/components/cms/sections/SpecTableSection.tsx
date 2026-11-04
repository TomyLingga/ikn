'use client';

import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, type SpecTableContent } from '../utils';

// Tabel spesifikasi: pasangan parameter-nilai + catatan kaki opsional. Bila baris punya `group`, tiap kelompok
// menjadi kolom berjudul sendiri (mis. satu kolom per pabrik); tanpa kelompok tampil sebagai satu daftar.
export default function SpecTableSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as SpecTableContent;
  const rows = asList<SpecTableContent['rows'][number]>(c.rows).filter((row) => tr(row.label, lang));
  if (rows.length === 0) return null;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const note = tr(c.note, lang);
  const groups: { title: string; rows: typeof rows }[] = [];
  rows.forEach((row) => {
    const title = tr(row.group, lang);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.rows.push(row);
    else groups.push({ title, rows: [row] });
  });
  const grouped = groups.some((g) => g.title);
  const sheet = (list: typeof rows) => (
    <dl className="spec-sheet">
      {list.map((row, i) => (
        <div key={i} className="spec-sheet-row">
          <dt>{tr(row.label, lang)}</dt>
          <dd>{tr(row.value, lang)}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {lead && <p className="lead sec-lead">{lead}</p>}
        {grouped ? (
          <div className="spec-groups">
            {groups.map((g, i) => (
              <div key={i} className="spec-group">
                {g.title && <h3 className="spec-group-title">{g.title}</h3>}
                {sheet(g.rows)}
              </div>
            ))}
          </div>
        ) : (
          sheet(rows)
        )}
        {note && <p className="spec-sheet-note">{note}</p>}
      </div>
    </section>
  );
}
