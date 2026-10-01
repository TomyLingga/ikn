'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { BrochureData, PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { fileKind, formatBytes, type EmptyTextContent } from '../utils';

interface Props {
  section: PageSection;
  items: BrochureData[];
}

// Download cards; the rows come from GET /content/brochures (passed via `extra`). Section id = key (#unduhan).
export default function BrochuresSection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as EmptyTextContent;
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No documents published yet.' : 'Belum ada dokumen yang dipublikasikan.');
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const archiveNote =
    lang === 'en'
      ? 'Archived file — contact us to obtain this document.'
      : 'Berkas dari arsip — hubungi kami untuk mendapatkan dokumen ini.';

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {items.length === 0 ? (
          <p className="form-note">{emptyText}</p>
        ) : (
          <div className="download-grid">
            {items.map((b, i) => {
              const description = tr(b.description, lang);
              return (
                <Reveal key={b.id} className="download-card" delay={i * 80}>
                  <div className="download-icon">
                    <Icon name="quote" size={30} strokeWidth={1.2} />
                  </div>
                  <div className="download-meta">
                    <h3 className="h3">{tr(b.title, lang)}</h3>
                    {description && <p className="download-note">{description}</p>}
                    {b.file && (
                      <span className="download-size">
                        {fileKind(b.file)} · {formatBytes(b.file.size)}
                      </span>
                    )}
                  </div>
                  {b.file?.url ? (
                    <a href={b.file.url} className="btn btn-line btn-sm download-cta" target="_blank" rel="noreferrer">
                      {lang === 'en' ? 'Download' : 'Unduh'} <Icon name="arrowDown" />
                    </a>
                  ) : (
                    <p className="download-note">{archiveNote}</p>
                  )}
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
