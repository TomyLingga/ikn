'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import StatusBadge from '@/components/StatusBadge';
import AdminModal from '@/components/admin/AdminModal';
import { AdminCard, AdminPageHead, DataTable, RowActions, type Column } from '@/components/admin/AdminPage';
import FileUploadDropzone from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { I18nInput } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import { emptyI18n, tr, type DocLinkData, type I18n, type WbsReportData } from '@/lib/cms';
import { formatDateTime } from '@/lib/format';
import type { Tone } from '@/lib/types';

type WbsStatus = WbsReportData['status'];

const STATUS_META: Record<WbsStatus, { id: string; en: string; tone: Tone }> = {
  new: { id: 'Baru', en: 'New', tone: 'warn' },
  review: { id: 'Ditinjau', en: 'In review', tone: 'info' },
  closed: { id: 'Selesai', en: 'Closed', tone: 'ok' },
};

const STATUSES: WbsStatus[] = ['new', 'review', 'closed'];

// WBS: report follow-up (GET/PUT /admin/whistleblowing) and the public SOP document (wbs/config, wbs/upload).
export default function AdminWhistleblowing() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const statusLabel = (status: WbsStatus) => (lang === 'en' ? STATUS_META[status].en : STATUS_META[status].id);

  const [reports, setReports] = useState<WbsReportData[]>([]);
  const [statusFilter, setStatusFilter] = useState<'' | WbsStatus>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [detail, setDetail] = useState<WbsReportData | null>(null);
  const [detailStatus, setDetailStatus] = useState<WbsStatus>('new');
  const [detailNotes, setDetailNotes] = useState('');
  const [detailError, setDetailError] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  const [wbsDoc, setWbsDoc] = useState<DocLinkData | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docLabel, setDocLabel] = useState<I18n>(emptyI18n());
  const [docUploading, setDocUploading] = useState(false);
  const [docError, setDocError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [list, config] = await Promise.all([
        api<WbsReportData[]>(`/admin/whistleblowing${statusFilter ? `?status=${statusFilter}` : ''}`),
        api<{ document: DocLinkData | null }>('/admin/wbs/config'),
      ]);
      setReports(list);
      setWbsDoc(config.document);
      setDocLabel(config.document?.label ?? emptyI18n());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function openDetail(row: WbsReportData) {
    setError('');
    try {
      const full = await api<WbsReportData>(`/admin/whistleblowing/${row.id}`);
      setDetail(full);
      setDetailStatus(full.status);
      setDetailNotes(full.adminNotes ?? '');
      setDetailError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function saveDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || savingDetail) return;
    setSavingDetail(true);
    setDetailError('');
    try {
      const updated = await api<WbsReportData>(`/admin/whistleblowing/${detail.id}`, {
        method: 'PUT',
        body: { status: detailStatus, adminNotes: detailNotes.trim() || null },
      });
      setReports((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      setDetail(null);
      setNotice(t('Tindak lanjut laporan tersimpan.', 'Report follow-up saved.'));
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setSavingDetail(false);
    }
  }

  async function uploadDoc(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (docUploading) return;
    if (!docFile) {
      setDocError(t('Pilih berkas PDF terlebih dahulu.', 'Choose a PDF file first.'));
      return;
    }
    setDocUploading(true);
    setDocError('');
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      if (docLabel.id.trim()) formData.append('label[id]', docLabel.id.trim());
      if (docLabel.en.trim()) formData.append('label[en]', docLabel.en.trim());
      const result = await api<{ document: DocLinkData }>('/admin/wbs/upload', { method: 'POST', formData });
      setWbsDoc(result.document);
      setDocLabel(result.document.label);
      setDocFile(null);
      setNotice(t('Dokumen WBS diperbarui.', 'WBS document updated.'));
    } catch (err) {
      setDocError(errorMessage(err));
    } finally {
      setDocUploading(false);
    }
  }

  const columns: Column<WbsReportData>[] = [
    { key: 'code', label: t('Kode', 'Code'), render: (r) => <span className="mono">{r.code}</span> },
    { key: 'subject', label: t('Subjek', 'Subject'), render: (r) => <strong>{r.subject}</strong> },
    {
      key: 'isAnonymous',
      label: t('Pelapor', 'Reporter'),
      render: (r) => (r.isAnonymous ? t('Anonim', 'Anonymous') : r.reporterName || t('Tidak anonim', 'Identified')),
    },
    { key: 'status', label: 'Status', render: (r) => <StatusBadge label={statusLabel(r.status)} tone={STATUS_META[r.status].tone} small /> },
    { key: 'createdAt', label: t('Diterima', 'Received'), render: (r) => formatDateTime(r.createdAt, lang) },
    {
      key: 'act',
      label: t('Aksi', 'Actions'),
      render: (r) => <RowActions actions={[{ label: t('Tindak lanjut', 'Follow up'), onClick: () => void openDetail(r) }]} />,
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <AdminPageHead
        title={t('Pelaporan WBS', 'WBS Reports')}
        desc={t('Tindak lanjut laporan whistle blowing dan dokumen SOP WBS untuk publik.', 'Follow up whistle blowing reports and manage the public WBS SOP document.')}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <AdminCard
        title={t('Dokumen SOP WBS', 'WBS SOP document')}
        desc={t('Dokumen yang dibuka pengunjung dari tombol WBS di situs.', 'The document visitors open from the WBS button on the site.')}
      >
        <form className="admin-form" onSubmit={(event) => void uploadDoc(event)} style={{ maxWidth: 720 }}>
          {docError && (
            <p className="form-error" role="alert">
              {docError}
            </p>
          )}
          {wbsDoc?.file ? (
            <p className="admin-field-hint">
              {t('Dokumen aktif:', 'Current document:')}{' '}
              <a href={wbsDoc.file.url} target="_blank" rel="noopener noreferrer" className="cms-link">
                {wbsDoc.file.originalName}
              </a>{' '}
              · {tr(wbsDoc.label, lang)}
            </p>
          ) : (
            <p className="admin-field-hint">{t('Belum ada dokumen WBS.', 'No WBS document yet.')}</p>
          )}
          <I18nInput label={t('Label tombol', 'Button label')} value={docLabel} onChange={setDocLabel} maxLength={150} />
          <FileUploadDropzone
            label={t('Berkas PDF baru', 'New PDF file')}
            accept=".pdf,application/pdf"
            selectedFile={docFile}
            onFileSelect={setDocFile}
            helperText={t('Format PDF, maks 20MB.', 'PDF format, max 20MB.')}
          />
          <div>
            <button type="submit" className="btn btn-solid btn-sm" disabled={docUploading}>
              {docUploading ? t('Mengunggah...', 'Uploading...') : t('Unggah & simpan', 'Upload & save')}
            </button>
          </div>
        </form>
      </AdminCard>

      <AdminCard title={t('Laporan masuk', 'Incoming reports')}>
        <div className="filter-pill-group">
          <button type="button" className={`filter-pill${statusFilter === '' ? ' is-active' : ''}`} onClick={() => setStatusFilter('')}>
            {t('Semua', 'All')}
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={`filter-pill${statusFilter === status ? ' is-active' : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {statusLabel(status)}
            </button>
          ))}
        </div>
        <DataTable columns={columns} rows={reports} empty={loading ? t('Memuat laporan...', 'Loading reports...') : t('Belum ada laporan.', 'No reports yet.')} />
      </AdminCard>

      {detail && (
        <AdminModal title={`${t('Laporan', 'Report')} ${detail.code}`} onClose={() => setDetail(null)} width={760}>
          <form className="admin-form" onSubmit={(event) => void saveDetail(event)}>
            {detailError && (
              <p className="form-error" role="alert">
                {detailError}
              </p>
            )}
            <dl className="wbs-detail">
              <div>
                <dt>{t('Subjek', 'Subject')}</dt>
                <dd>{detail.subject}</dd>
              </div>
              <div>
                <dt>{t('Diterima', 'Received')}</dt>
                <dd>{formatDateTime(detail.createdAt, lang)}</dd>
              </div>
              <div>
                <dt>{t('Pelapor', 'Reporter')}</dt>
                <dd>
                  {detail.isAnonymous
                    ? t('Anonim', 'Anonymous')
                    : `${detail.reporterName || '—'}${detail.reporterContact ? ` · ${detail.reporterContact}` : ''}`}
                </dd>
              </div>
              <div>
                <dt>{t('Lampiran', 'Attachment')}</dt>
                <dd>
                  {detail.attachment ? (
                    <a href={detail.attachment.url} target="_blank" rel="noopener noreferrer" className="cms-link">
                      {detail.attachment.originalName}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {detail.handledBy && (
                <div>
                  <dt>{t('Ditangani oleh', 'Handled by')}</dt>
                  <dd>{detail.handledBy.name}</dd>
                </div>
              )}
            </dl>
            <div>
              <span className="field-label">{t('Isi laporan', 'Report body')}</span>
              <div className="wbs-body">{detail.body}</div>
            </div>
            <div className="admin-form-row">
              <label>
                <span className="field-label">Status</span>
                <select value={detailStatus} onChange={(e) => setDetailStatus(e.target.value as WbsStatus)}>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              <span className="field-label">{t('Catatan admin (internal)', 'Admin notes (internal)')}</span>
              <textarea rows={5} value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} maxLength={5000} />
            </label>
            <div className="admin-modal-actions">
              <button type="button" className="btn btn-line btn-sm" onClick={() => setDetail(null)}>
                {t('Tutup', 'Close')}
              </button>
              <button type="submit" className="btn btn-solid btn-sm" disabled={savingDetail}>
                {savingDetail ? t('Menyimpan...', 'Saving...') : t('Simpan tindak lanjut', 'Save follow-up')}
              </button>
            </div>
          </form>
        </AdminModal>
      )}
    </div>
  );
}
