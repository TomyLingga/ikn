'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { CertificateData, PageSection } from '@/lib/cms';
import { pad2, type EmptyTextContent } from '../utils';

interface Props {
  section: PageSection;
  items: CertificateData[];
}

// Certificate list; the rows come from GET /content/certificates (passed via `extra`).
export default function CertificatesSection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as EmptyTextContent;
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No certificates published yet.' : 'Belum ada sertifikat yang dipublikasikan.');

  return (
    <section className="section-tight">
      <div className="container">
        {items.length === 0 ? (
          <p className="form-note">{emptyText}</p>
        ) : (
          <div className="cert-list">
            {items.map((cert, i) => (
              <Reveal key={cert.id} className="cert-row" delay={i * 80}>
                <span className="index">{pad2(i + 1)}</span>
                <div className="cert-body">
                  <h3 className="h3">{tr(cert.name, lang)}</h3>
                  <span className="cert-material">{tr(cert.material, lang)}</span>
                  <p>{tr(cert.description, lang)}</p>
                </div>
                {cert.file?.url ? (
                  <a href={cert.file.url} className="btn btn-line btn-sm" target="_blank" rel="noreferrer">
                    {lang === 'en' ? 'View' : 'Lihat'} <Icon name="arrow" />
                  </a>
                ) : (
                  <span className="badge badge-ok">{lang === 'en' ? 'Verified' : 'Terverifikasi'}</span>
                )}
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
