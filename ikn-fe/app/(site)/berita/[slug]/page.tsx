import type { Metadata } from 'next';
import NewsArticle from '@/components/cms/NewsArticle';
import PageFallback from '@/components/cms/PageFallback';
import { fetchNewsDetail } from '@/lib/server-data';
import JsonLd from '@/components/JsonLd';
import { articleJsonLd, breadcrumbJsonLd, buildMetadata } from '@/lib/seo';

interface Params {
  params: { slug: string };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await fetchNewsDetail(params.slug);
  if (!post) return { title: 'Berita' };
  return buildMetadata({
    title: post.title.id,
    description: post.excerpt?.id,
    path: `/berita/${post.slug}`,
    image: post.cover?.url,
    type: 'article',
    publishedTime: post.publishedAt,
  });
}

export default async function NewsDetail({ params }: Params) {
  const post = await fetchNewsDetail(params.slug);
  if (!post) return <PageFallback variant="news" />;

  return (
    <>
      <JsonLd
        data={[
          articleJsonLd(post),
          breadcrumbJsonLd([
            { name: 'Beranda', path: '/' },
            { name: 'Berita', path: '/berita' },
            { name: post.title.id, path: `/berita/${post.slug}` },
          ]),
        ]}
      />
      <NewsArticle post={post} />
    </>
  );
}
