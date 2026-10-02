'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { FileLink } from '@/components/FileViewer';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { CertificateData, I18n, PageSection } from '@/lib/cms';
import SecHead from './SecHead';
import { pad2, type EmptyTextContent } from '../utils';

interface Props {
  section: PageSection;
  items: CertificateData[];
}

interface CertificatesContent extends EmptyTextContent {
  layout?: 'list' | 'grid' | '';
}

function fileOf(cert: CertificateData, lang: 'id' | 'en') {
  return cert.file?.url ? { url: cert.file.url, name: cert.file.originalName || tr(cert.name as I18n, lang), mime: cert.file.mime } : null;
}

/** Kotak putih berisi logo sertifikat (tetap putih di tema gelap agar logo berwarna terbaca); tanpa logo = nomor urut. */
function Badge({ cert, index, lang, large = false }: { cert: CertificateData; index: number; lang: 'id' | 'en'; large?: boolean }) {
  return (
    <span className={`cert-badge${large ? ' cert-badge-lg' : ''}${cert.logo ? '' : ' cert-badge-empty'}`}>
      {cert.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cert.logo.url} alt={tr(cert.name, lang)} loading="lazy" />
      ) : (
        <>
          <Icon name="shieldCheck" size={large ? 30 : 22} />
          <span className="cert-badge-index">{pad2(index + 1)}</span>
        </>
      )}
    </span>
  );
}

// Daftar sertifikat dari GET /content/certificates (lewat `extra`). Tata letak: baris (logo kiri) atau kartu lencana.
// Berkas sertifikat (PDF) dibuka di penampil dalam situs. Section id = key (#sertifikat).
export default function CertificatesSection({ section, items }: Props) {
  const { lang } = useLang();
  const c = section.content as CertificatesContent;
  const emptyText = tr(c.empty_text, lang) || (lang === 'en' ? 'No certificates published yet.' : 'Belum ada sertifikat yang dipublikasikan.');
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const grid = c.layout === 'grid';
  const viewLabel = lang === 'en' ? 'View certificate' : 'Lihat sertifikat';
  const verified = lang === 'en' ? 'Verified' : 'Terverifikasi';

  return (
    <section className="section-tight" id={section.key || undefined}>
      <div className="container">
        {(label || heading) && <SecHead label={label} heading={heading} />}
        {items.length === 0 ? (
          <p className="form-note">{emptyText}</p>
        ) : grid ? (
          <div className="cert-grid">
            {items.map((cert, i) => {
              const file = fileOf(cert, lang);
              return (
                <Reveal key={cert.id} className="cert-card" delay={i * 70}>
                  {file ? (
                    <FileLink file={file} className="cert-card-media" aria-label={`${viewLabel}: ${tr(cert.name, lang)}`}>
                      <Badge cert={cert} index={i} lang={lang} large />
                    </FileLink>
                  ) : (
                    <span className="cert-card-media">
                      <Badge cert={cert} index={i} lang={lang} large />
                    </span>
                  )}
                  <div className="cert-card-body">
                    <h3 className="h3">{tr(cert.name, lang)}</h3>
                    {tr(cert.material, lang) && <span className="cert-material">{tr(cert.material, lang)}</span>}
                    {tr(cert.description, lang) && <p>{tr(cert.description, lang)}</p>}
                  </div>
                  <div className="cert-card-foot">
                    {file ? (
                      <FileLink file={file} className="cert-view">
                        <Icon name="eye" size={16} /> {viewLabel}
                      </FileLink>
                    ) : (
                      <span className="cert-verified">
                        <Icon name="checkCircle" size={16} /> {verified}
                      </span>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>
        ) : (
          <div className="cert-list">
            {items.map((cert, i) => {
              const file = fileOf(cert, lang);
              return (
                <Reveal key={cert.id} className="cert-row" delay={i * 80}>
                  <Badge cert={cert} index={i} lang={lang} />
                  <div className="cert-body">
                    <h3 className="h3">{tr(cert.name, lang)}</h3>
                    {tr(cert.material, lang) && <span className="cert-material">{tr(cert.material, lang)}</span>}
                    {tr(cert.description, lang) && <p>{tr(cert.description, lang)}</p>}
                  </div>
                  {file ? (
                    <FileLink file={file} className="cert-view">
                      <Icon name="eye" size={16} /> {viewLabel}
                    </FileLink>
                  ) : (
                    <span className="cert-verified">
                      <Icon name="checkCircle" size={16} /> {verified}
                    </span>
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
