import type { Metadata } from 'next';
import NewsArticle from '@/components/cms/NewsArticle';
import PageFallback from '@/components/cms/PageFallback';
import { fetchNewsDetail } from '@/lib/server-data';

interface Params {
  params: { slug: string };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await fetchNewsDetail(params.slug);
  if (!post) return { title: 'Berita' };
  const title = post.title.id;
  const description = post.excerpt?.id || undefined;
  return {
    title,
    description,
    openGraph: {
      type: 'article',
      title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.author ? [post.author] : undefined,
      images: post.cover ? [{ url: post.cover.url }] : undefined,
    },
  };
}

export default async function NewsDetail({ params }: Params) {
  const post = await fetchNewsDetail(params.slug);
  if (!post) return <PageFallback variant="news" />;

  return <NewsArticle post={post} />;
}
