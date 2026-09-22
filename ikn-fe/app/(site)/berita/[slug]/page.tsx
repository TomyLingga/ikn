import Link from 'next/link';
import Icon from '@/components/Icon';
import Breadcrumb from '@/components/Breadcrumb';
import EmptyState from '@/components/EmptyState';
import { fetchNews, fetchNewsDetail } from '@/lib/server-data';
import { formatDate } from '@/lib/format';

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const item = await fetchNewsDetail(params.slug);
  return { title: item ? item.title : 'Berita' };
}

export default async function NewsDetail({ params }: { params: { slug: string } }) {
  const item = await fetchNewsDetail(params.slug);

  if (!item) {
    return (
      <section className="section-tight">
        <div className="container">
          <EmptyState
            icon="compass"
            title="Berita tidak ditemukan"
            body="Artikel yang Anda cari tidak tersedia atau sudah tidak dipublikasikan."
            action={{ href: '/berita', label: 'Kembali ke berita' }}
          />
        </div>
      </section>
    );
  }

  const news = await fetchNews();
  const related = news.filter((n) => n.slug !== item.slug).slice(0, 2);

  return (
    <>
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb
            items={[
              { label: 'Beranda', href: '/' },
              { label: 'Berita', href: '/berita' },
              { label: item.title },
            ]}
          />
          <span className="label label-amber">/ {item.tag}</span>
          <h1 className="display pagehead-title" style={{ maxWidth: '22ch' }}>
            {item.title}
          </h1>
          <time className="news-date">{formatDate(item.date)}</time>
        </div>
      </section>

      <section className="section-tight">
        <div className="container article-wrap">
          {/* Konten HTML berasal dari CMS admin internal — bukan input publik. */}
          <article
            className="article-body"
            dangerouslySetInnerHTML={{ __html: item.body }}
          />

          <aside className="article-aside">
            <span className="label label-green">/ Berita lainnya</span>
            <div className="article-related">
              {related.map((r) => (
                <Link key={r.slug} href={`/berita/${r.slug}`} className="article-related-item">
                  <span className="news-row-tag">{r.tag}</span>
                  <h3>{r.title}</h3>
                  <time className="news-date">{formatDate(r.date)}</time>
                </Link>
              ))}
            </div>
            <Link href="/berita" className="link" style={{ marginTop: 20 }}>
              Semua berita <Icon name="arrow" />
            </Link>
          </aside>
        </div>
      </section>
    </>
  );
}
