import Image from 'next/image';
import Reveal from '@/components/Reveal';
import VideoGallery from '@/components/VideoGallery';
import { fetchGallery } from '@/lib/server-data';

export const metadata = {
  title: 'Galeri',
  description: 'Galeri foto dan video fasilitas produksi PT Industri Karet Nusantara.',
};

export default async function Galeri() {
  const items = await fetchGallery();
  const photos = items.filter((g) => g.type === 'image');
  const videos = items
    .filter((g) => g.type === 'video')
    .map((g) => ({ id: g.src, title: g.title, desc: '' }));

  return (
    <>
      <section className="pagehead">
        <div className="container pagehead-row">
          <div>
            <span className="label label-amber">/ Media — Galeri</span>
            <h1 className="display pagehead-title">Dari dekat.</h1>
          </div>
          <p className="lead">
            Cuplikan fasilitas produksi, bahan baku, dan proses hilirisasi karet
            di PT Industri Karet Nusantara.
          </p>
        </div>
      </section>

      <section className="section-tight">
        <div className="container">
          <span className="label label-green">/ Foto</span>
          {photos.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>Belum ada foto yang dipublikasikan.</p>
          ) : (
            <div className="gallery-grid" style={{ marginTop: 20 }}>
              {photos.map((g, i) => (
                <Reveal key={g.id} className="gallery-cell" delay={i * 70}>
                  <Image src={g.src} alt={g.title} fill sizes="(max-width:900px) 50vw, 380px" style={{ objectFit: 'cover' }} />
                  <span className="gallery-cap">{g.title}</span>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="section-tight" style={{ paddingTop: 0 }}>
        <div className="container">
          <span className="label label-green">/ Video</span>
          {videos.length === 0 ? (
            <p className="form-note" style={{ marginTop: 20 }}>Belum ada video yang dipublikasikan.</p>
          ) : (
            <div style={{ marginTop: 20 }}>
              <VideoGallery videos={videos} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
