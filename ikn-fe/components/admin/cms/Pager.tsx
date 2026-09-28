'use client';

import { useLang } from '@/components/LanguageProvider';
import type { PagedMeta } from '@/lib/cms';

// Server-side pagination controls for apiPaged() lists.
interface PagerProps {
  meta: PagedMeta;
  onPage: (page: number) => void;
  disabled?: boolean;
}

export default function Pager({ meta, onPage, disabled = false }: PagerProps) {
  const { lang } = useLang();
  if (meta.lastPage <= 1) return null;
  const from = (meta.page - 1) * meta.perPage + 1;
  const to = Math.min(meta.page * meta.perPage, meta.total);

  return (
    <div className="pagination-wrap">
      <span className="pagination-info">
        {lang === 'en' ? `Showing ${from}–${to} of ${meta.total}` : `Menampilkan ${from}–${to} dari ${meta.total}`}
      </span>
      <div className="pagination-buttons">
        <button
          type="button"
          className="pagination-btn"
          disabled={disabled || meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          {lang === 'en' ? '‹ Prev' : '‹ Sebelum'}
        </button>
        <span className="pagination-info">
          {meta.page} / {meta.lastPage}
        </span>
        <button
          type="button"
          className="pagination-btn"
          disabled={disabled || meta.page >= meta.lastPage}
          onClick={() => onPage(meta.page + 1)}
        >
          {lang === 'en' ? 'Next ›' : 'Selanjutnya ›'}
        </button>
      </div>
    </div>
  );
}
