// Form state + payload mapping shared by the news list (publish toggle) and the
// full-page editor. PUT /admin/news/{id} replaces every field, so the payload
// always carries the complete record.

import { emptyI18n, type I18n, type MediaSummary, type PostDetail } from '@/lib/cms';

export interface NewsForm {
  slug: string;
  title: I18n;
  excerpt: I18n;
  body: I18n;
  categoryId: number | null; // dari /admin/news-categories
  author: string;
  cover: MediaSummary | null;
  isPublished: boolean;
  publishedAt: string;
}

export const emptyForm = (): NewsForm => ({
  slug: '',
  title: emptyI18n(),
  excerpt: emptyI18n(),
  body: emptyI18n(),
  categoryId: null,
  author: '',
  cover: null,
  isPublished: false,
  publishedAt: '',
});

export function formFromPost(post: PostDetail): NewsForm {
  return {
    slug: post.slug,
    title: post.title ?? emptyI18n(),
    excerpt: post.excerpt ?? emptyI18n(),
    body: post.body ?? emptyI18n(),
    categoryId: post.category?.id ?? null,
    author: post.author ?? '',
    cover: post.cover,
    isPublished: post.isPublished,
    publishedAt: toLocalInput(post.publishedAt),
  };
}

// ISO (+07:00 dari API) -> nilai <input type="datetime-local"> dalam zona browser.
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Nilai datetime-local -> ISO UTC; server menyimpan instan dan mengembalikan +07:00.
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toPayload(form: NewsForm) {
  return {
    slug: form.slug.trim() || null,
    title: form.title,
    excerpt: form.excerpt,
    body: form.body,
    categoryId: form.categoryId,
    author: form.author.trim() || null,
    coverMediaId: form.cover?.id ?? null,
    isPublished: form.isPublished,
    publishedAt: fromLocalInput(form.publishedAt),
  };
}
