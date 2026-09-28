'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { PageListItem } from '@/lib/cms';

// Resolves a page slug to its id and forwards to the editor (target of legacy admin routes).
export default function AdminPageBySlug({ params }: { params: { slug: string } }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    api<PageListItem[]>('/admin/pages')
      .then((pages) => {
        if (cancelled) return;
        const found = pages.find((p) => p.slug === params.slug);
        router.replace(found ? `/admin/pages/${found.id}` : '/admin/pages');
      })
      .catch(() => {
        if (!cancelled) router.replace('/admin/pages');
      });
    return () => {
      cancelled = true;
    };
  }, [params.slug, router]);

  return <div className="admin-empty">Membuka editor halaman...</div>;
}
