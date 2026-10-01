'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type Key, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import type { IconName } from '@/lib/types';

// Header standar tiap halaman admin: judul, deskripsi, dan tombol aksi opsional.
interface AdminPageHeadProps {
  title: string;
  desc?: string;
  action?: { label: string; icon?: IconName; onClick?: () => void };
}

export function AdminPageHead({ title, desc, action }: AdminPageHeadProps) {
  return (
    <div className="admin-head">
      <div>
        <h1 className="admin-title">{title}</h1>
        {desc && <p className="admin-desc">{desc}</p>}
      </div>
      {action && (
        <button type="button" className="btn btn-solid btn-sm" onClick={action.onClick}>
          <Icon name={action.icon || 'plus'} size={16} /> {action.label}
        </button>
      )}
    </div>
  );
}

// Tabel data generik dengan pagination bawaan.
export interface Column<T> {
  key: string;
  label: string;
  align?: string;
  render?: (row: T, index: number) => ReactNode;
  /** Bila diisi, judul kolom bisa diklik untuk mengurutkan baris (di sisi klien) menurut nilai ini. */
  sortValue?: (row: T) => number | string;
}

export interface TableSort {
  key: string;
  dir: 'asc' | 'desc';
}

// Kolom aksi (key 'act'/'action') menempel di tepi kanan saat tabel bergulir mendatar, supaya tombolnya selalu terlihat.
const isActionColumn = (key: string) => key === 'act' || key === 'action';

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  rowKey?: keyof T;
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  /** Urutan awal untuk kolom yang punya `sortValue`. */
  defaultSort?: TableSort;
}

export function DataTable<T extends object>({
  columns,
  rows,
  empty = 'Belum ada data.',
  rowKey = 'id' as keyof T,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  defaultSort,
}: DataTableProps<T>) {
  const { lang } = useLang();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sort, setSort] = useState<TableSort | null>(defaultSort ?? null);

  if (!rows || rows.length === 0) {
    return <div className="admin-empty">{empty}</div>;
  }

  const sortColumn = sort ? columns.find((c) => c.key === sort.key && c.sortValue) : undefined;
  if (sortColumn?.sortValue && sort) {
    const value = sortColumn.sortValue;
    const factor = sort.dir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * factor;
      return String(x).localeCompare(String(y), lang === 'en' ? 'en' : 'id', { numeric: true }) * factor;
    });
  }

  // Klik pertama: angka dari terbesar, teks dari A; klik berikutnya membalik arah.
  const toggleSort = (column: Column<T>) => {
    setCurrentPage(1);
    setSort((current) => {
      if (current?.key === column.key) return { key: column.key, dir: current.dir === 'asc' ? 'desc' : 'asc' };
      const sample = column.sortValue && rows[0] ? column.sortValue(rows[0]) : 0;
      return { key: column.key, dir: typeof sample === 'number' ? 'desc' : 'asc' };
    });
  };

  const totalRows = rows.length;
  const minPageSize = pageSizeOptions?.[0] ?? 5;
  const shouldPaginate = pagination && totalRows > minPageSize;

  const totalPages = shouldPaginate ? Math.ceil(totalRows / pageSize) : 1;
  const validPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = shouldPaginate ? (validPage - 1) * pageSize : 0;
  const visibleRows = shouldPaginate ? rows.slice(startIndex, startIndex + pageSize) : rows;

  return (
    <div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-cards">
          <thead>
            <tr>
              {columns.map((c) => {
                const sorted = sort?.key === c.key && c.sortValue ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    className={isActionColumn(c.key) ? 'admin-col-actions' : undefined}
                    style={c.align ? { textAlign: c.align as CSSProperties['textAlign'] } : undefined}
                    aria-sort={c.sortValue ? (sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none') : undefined}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        className={`admin-th-sort${sorted ? ' is-sorted' : ''}`}
                        onClick={() => toggleSort(c)}
                        title={lang === 'en' ? `Sort by ${c.label}` : `Urutkan menurut ${c.label}`}
                      >
                        {c.label}
                        <span className={`admin-th-sort-arrow${sorted ? ` is-${sorted}` : ''}`} aria-hidden="true" />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={(row[rowKey] as Key) ?? i}>
                {columns.map((c) => (
                  <td key={c.key} data-label={c.label} className={isActionColumn(c.key) ? 'admin-col-actions' : undefined} style={c.align ? { textAlign: c.align as CSSProperties['textAlign'] } : undefined}>
                    {c.render
                      ? c.render(row, startIndex + i)
                      : ((row as Record<string, unknown>)[c.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shouldPaginate && (
        <div className="pagination-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="pagination-info">
              {lang === 'en'
                ? `Showing ${startIndex + 1}–${Math.min(startIndex + pageSize, totalRows)} of ${totalRows} items`
                : `Menampilkan ${startIndex + 1}–${Math.min(startIndex + pageSize, totalRows)} dari ${totalRows} data`}
            </span>
            <label className="admin-filter" style={{ padding: '4px 8px', fontSize: '0.74rem', marginBottom: 0 }}>
              <span>{lang === 'en' ? 'Per page:' : 'Per hal:'}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="pagination-buttons">
            <button
              type="button"
              className="pagination-btn"
              disabled={validPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              {lang === 'en' ? '‹ Prev' : '‹ Sebelum'}
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - validPage) <= 1)
              .map((p, idx, arr) => (
                <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && <span style={{ padding: '0 4px', color: 'var(--ink-soft)' }}>...</span>}
                  <button
                    type="button"
                    className={`pagination-btn ${validPage === p ? 'is-active' : ''}`}
                    onClick={() => setCurrentPage(p)}
                  >
                    {p}
                  </button>
                </span>
              ))}

            <button
              type="button"
              className="pagination-btn"
              disabled={validPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              {lang === 'en' ? 'Next ›' : 'Selanjutnya ›'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Aksi row tabel
export interface RowAction {
  label: string;
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'success';
  disabled?: boolean;
}

function normalizeAction(action: string | RowAction): RowAction & { tone: 'default' | 'danger' | 'success' } {
  const item: RowAction = typeof action === 'string' ? { label: action } : action;
  const tone =
    item.tone === 'danger' || ['Nonaktifkan', 'Tolak'].includes(item.label)
      ? 'danger'
      : item.tone === 'success' || item.label === 'Aktifkan'
        ? 'success'
        : 'default';
  return { ...item, tone };
}

const toneClass = (tone: string) => (tone === 'danger' ? ' row-act-danger' : tone === 'success' ? ' row-act-success' : '');

// Sampai `maxInline` aksi tampil berjajar; bila lebih, (maxInline - 1) aksi pertama tetap berjajar dan sisanya
// masuk menu "aksi lainnya" supaya kolom aksi tidak melebar atau patah menjadi dua baris.
export function RowActions({
  actions = ['Detail', 'Edit', 'Nonaktifkan'],
  maxInline = 3,
}: {
  actions?: Array<string | RowAction>;
  maxInline?: number;
}) {
  const items = actions.map(normalizeAction);
  const split = items.length > maxInline ? Math.max(1, maxInline - 1) : items.length;
  const inline = items.slice(0, split);
  const overflow = items.slice(split);

  return (
    <div className="row-actions">
      {inline.map((item) => (
        <button key={item.label} type="button" className={`row-act${toneClass(item.tone)}`} onClick={item.onClick} disabled={item.disabled}>
          {item.label}
        </button>
      ))}
      {overflow.length > 0 && <RowMenu items={overflow} />}
    </div>
  );
}

// Menu aksi lainnya: dirender lewat portal dengan posisi fixed agar tidak terpotong pembungkus tabel yang bergulir.
function RowMenu({ items }: { items: Array<RowAction & { tone: string }> }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  }, []);

  // Tempatkan di bawah tombol, rata kanan; pindah ke atas bila ruang di bawah tidak cukup.
  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = menu.current?.offsetHeight ?? items.length * 38 + 12;
    const below = rect.bottom + 6 + height <= window.innerHeight;
    setPos({ top: below ? rect.bottom + 6 : Math.max(8, rect.top - 6 - height), right: Math.max(8, window.innerWidth - rect.right) });
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !trigger.current?.contains(target)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close(true);
    };
    const onMove = () => close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`row-act row-act-more${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={lang === 'en' ? 'More actions' : 'Aksi lainnya'}
        title={lang === 'en' ? 'More actions' : 'Aksi lainnya'}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="row-act-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>
      {open &&
        createPortal(
          <div ref={menu} className="row-menu" role="menu" style={pos ? { top: pos.top, right: pos.right } : { visibility: 'hidden' }}>
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`row-menu-item${item.tone === 'danger' ? ' is-danger' : ''}`}
                disabled={item.disabled}
                onClick={() => {
                  close();
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

// Kartu ringkas untuk modul konten (CMS)
interface AdminCardProps {
  title?: string;
  desc?: string;
  action?: { label: string; icon?: IconName; onClick?: () => void };
  children: ReactNode;
  foot?: ReactNode;
  className?: string;
}

export function AdminCard({ title, desc, action, children, foot, className = '' }: AdminCardProps) {
  return (
    <section className={`admin-card ${className}`.trim()}>
      {(title || desc || action) && (
        <div className="admin-card-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            {title && <h2 className="admin-card-title" style={{ margin: 0 }}>{title}</h2>}
            {desc && <p className="admin-desc" style={{ marginTop: 4, marginBottom: 0 }}>{desc}</p>}
          </div>
          {action && (
            <button type="button" className="btn btn-solid btn-sm" onClick={action.onClick}>
              <Icon name={action.icon || 'plus'} size={15} /> {action.label}
            </button>
          )}
        </div>
      )}
      <div className="admin-card-body">{children}</div>
      {foot && <div className="admin-card-foot">{foot}</div>}
    </section>
  );
}
