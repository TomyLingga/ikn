'use client';

import { useCallback, useEffect, useState } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminPageHead, DataTable, RowActions, type Column, type RowAction } from '@/components/admin/AdminPage';
import { Pager } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, apiPaged, errorMessage } from '@/lib/api';
import type { ContactMessageData, PagedMeta } from '@/lib/cms';
import { formatDateTime } from '@/lib/format';

function metaValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Inbox of public contact / quote forms (GET /admin/contact-messages, PUT .../{id}/read).
export default function AdminContactMessages() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ContactMessageData[]>([]);
  const [meta, setMeta] = useState<PagedMeta>({ page: 1, perPage: 20, total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<ContactMessageData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiPaged<ContactMessageData>(
        `/admin/contact-messages?page=${page}&perPage=20${unreadOnly ? '&unread=1' : ''}`,
      );
      setItems(result.items);
      setMeta(result.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(row: ContactMessageData) {
    setError('');
    try {
      const updated = await api<ContactMessageData>(`/admin/contact-messages/${row.id}/read`, { method: 'PUT' });
      setItems((current) => current.map((m) => (m.id === updated.id ? updated : m)));
      setDetail((current) => (current && current.id === updated.id ? updated : current));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function openDetail(row: ContactMessageData) {
    setDetail(row);
    if (!row.readAt) void markRead(row);
  }

  const typeLabel = (type: ContactMessageData['type']) =>
    type === 'quote' ? t('Permintaan penawaran', 'Quote request') : t('Pesan kontak', 'Contact message');

  const columns: Column<ContactMessageData>[] = [
    { key: 'createdAt', label: t('Diterima', 'Received'), render: (m) => formatDateTime(m.createdAt, lang) },
    { key: 'type', label: t('Jenis', 'Type'), render: (m) => <StatusBadge label={typeLabel(m.type)} tone={m.type === 'quote' ? 'info' : 'ok'} small /> },
    {
      key: 'name',
      label: t('Pengirim', 'Sender'),
      render: (m) => (
        <div>
          <strong style={{ fontWeight: m.readAt ? 500 : 700 }}>{m.name}</strong>
          <small style={{ display: 'block', color: 'var(--ink-soft)', fontSize: '0.76rem' }} className="mono">
            {m.email}
          </small>
        </div>
      ),
    },
    {
      key: 'subject',
      label: t('Subjek / pesan', 'Subject / message'),
      render: (m) => (
        <div style={{ maxWidth: 360, whiteSpace: 'normal' }}>
          {m.subject && <strong style={{ display: 'block' }}>{m.subject}</strong>}
          <span style={{ color: 'var(--ink-soft)', fontSize: '0.84rem' }}>
            {m.message.length > 110 ? `${m.message.slice(0, 110)}…` : m.message}
          </span>
        </div>
      ),
    },
    {
      key: 'readAt',
      label: 'Status',
      render: (m) => <StatusBadge label={m.readAt ? t('Dibaca', 'Read') : t('Belum dibaca', 'Unread')} tone={m.readAt ? 'ok' : 'warn'} small />,
    },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (m) => {
        const actions: RowAction[] = [{ label: t('Lihat', 'View'), onClick: () => openDetail(m) }];
        if (!m.readAt) actions.push({ label: t('Tandai dibaca', 'Mark read'), tone: 'success', onClick: () => void markRead(m) });
        return <RowActions actions={actions} />;
      },
    },
  ];

  return (
    <div>
      <AdminPageHead
        title={t('Pesan Kontak', 'Contact Messages')}
        desc={t('Pesan dari formulir kontak dan permintaan penawaran di situs.', 'Messages from the site contact and quote forms.')}
      />

      {error && <p className="form-error">{error}</p>}

      <div className="admin-toolbar">
        <label className="cms-check" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
          />
          <span>{t('Hanya belum dibaca', 'Unread only')}</span>
        </label>
        <span className="admin-result-count">
          {meta.total} {t('pesan', 'messages')}
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={items}
        pagination={false}
        empty={loading ? t('Memuat pesan...', 'Loading messages...') : t('Tidak ada pesan.', 'No messages.')}
      />
      <Pager meta={meta} onPage={setPage} disabled={loading} />

      {detail && (
        <AdminModal title={detail.subject || typeLabel(detail.type)} onClose={() => setDetail(null)} width={720}>
          <div className="admin-form">
            <dl className="wbs-detail">
              <div>
                <dt>{t('Pengirim', 'Sender')}</dt>
                <dd>{detail.name}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${detail.email}`} className="cms-link">
                    {detail.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt>{t('Telepon', 'Phone')}</dt>
                <dd>{detail.phone || '—'}</dd>
              </div>
              <div>
                <dt>{t('Jenis', 'Type')}</dt>
                <dd>{typeLabel(detail.type)}</dd>
              </div>
              <div>
                <dt>{t('Diterima', 'Received')}</dt>
                <dd>{formatDateTime(detail.createdAt, lang)}</dd>
              </div>
              <div>
                <dt>{t('Dibaca', 'Read at')}</dt>
                <dd>{detail.readAt ? formatDateTime(detail.readAt, lang) : t('Belum', 'Not yet')}</dd>
              </div>
              {detail.meta &&
                Object.entries(detail.meta).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{metaValue(value)}</dd>
                  </div>
                ))}
            </dl>
            <div>
              <span className="field-label">{t('Pesan', 'Message')}</span>
              <div className="wbs-body">{detail.message}</div>
            </div>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setDetail(null)}>
                {t('Tutup', 'Close')}
              </button>
              <a href={`mailto:${detail.email}?subject=${encodeURIComponent(`Re: ${detail.subject || 'PT IKN'}`)}`} className="btn btn-solid btn-sm">
                {t('Balas via email', 'Reply by email')}
              </a>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
