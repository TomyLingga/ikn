'use client';

import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { asList, pad2, type I18nItem, type InfoBlocksContent } from '../utils';

// Labelled text blocks with point lists (left column of the WBS block). Rendered inside ContactGrid.
// Optional label/heading (SecHead) di atas blok, dipakai saat WBS menjadi bagian halaman Keberlanjutan.
export default function InfoBlocksSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as InfoBlocksContent;
  const blocks = asList<InfoBlocksContent['blocks'][number]>(c.blocks);
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);

  return (
    <>
      {(label || heading) && (
        <div className="contact-block">
          <SecHead label={label} heading={heading} reveal={false} />
        </div>
      )}
      {blocks.map((b, i) => {
        const body = tr(b.body, lang);
        const points = asList<I18nItem>(b.points);
        return (
          <div key={i} className="contact-block">
            <span className="label label-green">{tr(b.label, lang)}</span>
            {body && (
              <p style={{ marginTop: 12, maxWidth: '46ch' }}>
                {body}
              </p>
            )}
            {points.length > 0 && (
              <ul className="vm-list" style={{ marginTop: 12 }}>
                {points.map((p, j) => (
                  <li key={j}>
                    <span className="index">{pad2(j + 1)}</span>
                    <span>{tr(p.text, lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
