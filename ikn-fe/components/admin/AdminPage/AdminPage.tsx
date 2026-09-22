'use client';

import { useState, type CSSProperties, type Key, type ReactNode } from 'react';
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
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  rowKey?: keyof T;
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
}

export function DataTable<T extends object>({
  columns,
  rows,
  empty = 'Belum ada data.',
  rowKey = 'id' as keyof T,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
}: DataTableProps<T>) {
  const { lang } = useLang();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  if (!rows || rows.length === 0) {
    return <div className="admin-empty">{empty}</div>;
  }

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
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={c.align ? { textAlign: c.align as CSSProperties['textAlign'] } : undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={(row[rowKey] as Key) ?? i}>
                {columns.map((c) => (
                  <td key={c.key} style={c.align ? { textAlign: c.align as CSSProperties['textAlign'] } : undefined}>
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

export function RowActions({
  actions = ['Detail', 'Edit', 'Nonaktifkan'],
}: {
  actions?: Array<string | RowAction>;
}) {
  return (
    <div className="row-actions">
      {actions.map((action) => {
        const item: RowAction = typeof action === 'string' ? { label: action } : action;
        const isDanger = item.tone === 'danger' || ['Nonaktifkan', 'Tolak'].includes(item.label);
        const isSuccess = item.tone === 'success' || item.label === 'Aktifkan';

        return (
          <button
            key={item.label}
            type="button"
            className={`row-act${isDanger ? ' row-act-danger' : ''}${isSuccess ? ' row-act-success' : ''}`}
            onClick={item.onClick}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </div>
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
