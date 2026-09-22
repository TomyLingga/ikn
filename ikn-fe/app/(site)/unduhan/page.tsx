import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import { fetchBrochures } from '@/lib/server-data';

export const metadata = {
  title: 'Unduhan',
  description: 'Brosur produk dan dokumen PT Industri Karet Nusantara.',
};

export default async function Unduhan() {
  const items = await fetchBrochures();
  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={[{ label: 'Beranda', href: '/' }, { label: 'Unduhan' }]} />
          <span className="label label-amber">/ Unduhan</span>
          <h1 className="display pagehead-title">Brosur & dokumen.</h1>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          {items.length === 0 ? (
            <p className="form-note">Belum ada dokumen yang dipublikasikan.</p>
          ) : (
            <div className="download-grid">
              {items.map((b, i) => {
                const downloadable = b.file.startsWith('/');
                return (
                  <Reveal key={b.id} className="download-card" delay={i * 80}>
                    <div className="download-icon"><Icon name="quote" size={30} strokeWidth={1.2} /></div>
                    <div className="download-meta">
                      <h3 className="h3">{b.title}</h3>
                      <span className="download-size">PDF · {b.size}</span>
                    </div>
                    {downloadable ? (
                      <a href={b.file} className="btn btn-line btn-sm download-cta" target="_blank" rel="noreferrer">
                        Unduh <Icon name="arrowDown" />
                      </a>
                    ) : (
                      <>
                        <span className="btn btn-line btn-sm download-cta" aria-disabled="true">
                          {b.file}
                        </span>
                        <p className="download-note">Berkas dari arsip — hubungi kami untuk mendapatkan dokumen ini.</p>
                      </>
                    )}
                  </Reveal>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
