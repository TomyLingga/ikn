'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import { Pager } from '@/components/admin/cms';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { apiPaged, errorMessage } from '@/lib/api';
import { queryString, type AuditLogRow } from '@/lib/admin';
import { formatDateTime } from '@/lib/format';
import type { PagedMeta } from '@/lib/cms';

const PER_PAGE = 30;

function pretty(value: Record<string, unknown> | null): string {
  if (!value) return '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Audit log (super_admin): GET /admin/audit-logs?page&user&action&from&to; before/after ditampilkan sebagai JSON.
export default function AdminAuditLogs() {
  const { admin } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const isSuperAdmin = admin?.role === 'super_admin';

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: PER_PAGE, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [userInput, setUserInput] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [filters, setFilters] = useState({ user: '', action: '', from: '', to: '' });
  const [detail, setDetail] = useState<AuditLogRow | null>(null);

  const refresh = useCallback(async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<AuditLogRow>(`/admin/audit-logs${queryString({ ...filters, page, perPage: PER_PAGE })}`);
      setRows(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page, isSuperAdmin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setFilters((current) => ({ ...current, user: userInput.trim(), action: actionInput.trim() }));
  }

  const columns: Column<AuditLogRow>[] = [
    { key: 'createdAt', label: t('Waktu', 'Time'), render: (r) => <span className="mono">{formatDateTime(r.createdAt, lang)}</span> },
    {
      key: 'user',
      label: t('Pengguna', 'User'),
      render: (r) =>
        r.user ? (
          <span>
            {r.user.name}
            <small className="admin-cell-sub mono">
              {r.user.email} · {r.user.role}
            </small>
          </span>
        ) : (
          <span className="admin-field-hint">{t('Sistem', 'System')}</span>
        ),
    },
    { key: 'action', label: t('Aksi', 'Action'), render: (r) => <span className="mono admin-cell-wrap">{r.action}</span> },
    {
      key: 'subject',
      label: t('Subjek', 'Subject'),
      render: (r) => (r.subjectType ? <span className="mono">{`${r.subjectType}${r.subjectId ? ` #${r.subjectId}` : ''}`}</span> : '—'),
    },
    { key: 'ip', label: 'IP', render: (r) => <span className="mono">{r.ip || '—'}</span> },
    {
      key: 'act',
      label: '',
      render: (r) => <RowActions actions={[{ label: 'Detail', onClick: () => setDetail(r) }]} />,
    },
  ];

  if (admin && !isSuperAdmin) {
    return (
      <div>
        <AdminPageHead title="Audit Log" />
        <p className="form-error">{t('Halaman ini hanya untuk Super Admin.', 'This page is for Super Admins only.')}</p>
      </div>
    );
  }

  return (
    <div>
      <AdminPageHead
        title="Audit Log"
        desc={t('Jejak semua aksi tulis admin dan perubahan status otomatis sistem (scheduler, webhook).', 'Trail of every admin write action and automatic system status changes (scheduler, webhook).')}
      />

      {error && <p className="form-error">{error}</p>}

      <form className="admin-toolbar" onSubmit={submitFilters}>
        <label className="admin-search">
          <span className="sr-only">{t('Pengguna', 'User')}</span>
          <input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={t('Pengguna (nama/email/id)', 'User (name/email/id)')} />
        </label>
        <label className="admin-search">
          <span className="sr-only">{t('Aksi', 'Action')}</span>
          <input value={actionInput} onChange={(e) => setActionInput(e.target.value)} placeholder={t('Aksi, mis. order atau PUT api/v1/admin', 'Action, e.g. order or PUT api/v1/admin')} />
        </label>
        <label className="admin-filter">
          <span>{t('Dari', 'From')}</span>
          <input
            type="date"
            className="admin-filter-input"
            value={filters.from}
            onChange={(e) => {
              setFilters({ ...filters, from: e.target.value });
              setPage(1);
            }}
          />
        </label>
        <label className="admin-filter">
          <span>{t('Sampai', 'To')}</span>
          <input
            type="date"
            className="admin-filter-input"
            value={filters.to}
            onChange={(e) => {
              setFilters({ ...filters, to: e.target.value });
              setPage(1);
            }}
          />
        </label>
        <button type="submit" className="btn btn-line btn-sm">
          {t('Terapkan', 'Apply')}
        </button>
        <span className="admin-result-count">
          {meta.total} {t('catatan', 'entries')}
        </span>
      </form>

      <DataTable columns={columns} rows={rows} pagination={false} empty={loading ? t('Memuat audit log...', 'Loading audit log...') : t('Tidak ada catatan pada filter ini.', 'No entries match this filter.')} />
      <Pager meta={meta} onPage={setPage} disabled={loading} />

      {detail && (
        <AdminModal title={`${t('Audit', 'Audit')} #${detail.id}`} onClose={() => setDetail(null)} width={920}>
          <div className="admin-modal-body">
            <dl className="admin-kv">
              <div>
                <dt>{t('Waktu', 'Time')}</dt>
                <dd className="mono">{formatDateTime(detail.createdAt, lang)}</dd>
              </div>
              <div>
                <dt>{t('Pengguna', 'User')}</dt>
                <dd>{detail.user ? `${detail.user.name} (${detail.user.email}, ${detail.user.role})` : t('Sistem', 'System')}</dd>
              </div>
              <div>
                <dt>{t('Aksi', 'Action')}</dt>
                <dd className="mono">{detail.action}</dd>
              </div>
              <div>
                <dt>{t('Subjek', 'Subject')}</dt>
                <dd className="mono">{detail.subjectType ? `${detail.subjectType}${detail.subjectId ? ` #${detail.subjectId}` : ''}` : '—'}</dd>
              </div>
              <div>
                <dt>IP / User agent</dt>
                <dd className="mono" style={{ wordBreak: 'break-all' }}>
                  {detail.ip || '—'}
                  {detail.userAgent ? ` · ${detail.userAgent}` : ''}
                </dd>
              </div>
            </dl>
            <div className="admin-grid-2" style={{ marginTop: 16 }}>
              <div>
                <h3 className="admin-subtitle">{t('Sebelum', 'Before')}</h3>
                <pre className="admin-json">{pretty(detail.before)}</pre>
              </div>
              <div>
                <h3 className="admin-subtitle">{t('Sesudah', 'After')}</h3>
                <pre className="admin-json">{pretty(detail.after)}</pre>
              </div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setDetail(null)}>
                {t('Tutup', 'Close')}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
