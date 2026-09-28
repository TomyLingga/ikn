'use client';

import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, pad2, type I18nItem, type InfoBlocksContent } from '../utils';

// Labelled text blocks with point lists (left column of the WBS page). Rendered inside ContactGrid.
export default function InfoBlocksSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const blocks = asList<InfoBlocksContent['blocks'][number]>((section.content as InfoBlocksContent).blocks);

  return (
    <>
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
