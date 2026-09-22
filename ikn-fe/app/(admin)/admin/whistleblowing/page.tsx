'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminPageHead, AdminCard } from '@/components/admin/AdminPage';
import FileUploadDropzone, { SegmentedRadio } from '@/components/admin/FileUploadDropzone/FileUploadDropzone';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';

interface WbsFileConfig {
  title: string;
  type: 'url' | 'file';
  url: string;
  filePath: string;
  fileName: string;
}

export default function AdminWhistleblowing() {
  const { lang } = useLang();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Unggah File WBS / Company Profile
  const [wbsConfig, setWbsConfig] = useState<WbsFileConfig | null>(null);
  const [formTitle, setFormTitle] = useState('Dokumen WBS & Company Profile PT IKN');
  const [formType, setFormType] = useState<'url' | 'file'>('file');
  const [formUrl, setFormUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const cfg = await api<WbsFileConfig>('/admin/wbs/config');
      setWbsConfig(cfg);
      setFormTitle(cfg.title || 'Dokumen WBS & Company Profile PT IKN');
      setFormType(cfg.type || 'file');
      setFormUrl(cfg.url || '');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleUploadWbs(e: React.FormEvent) {
    e.preventDefault();
    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const formData = new FormData();
      formData.append('title', formTitle);
      formData.append('type', formType);
      if (formType === 'url') {
        formData.append('url', formUrl);
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await api('/admin/wbs/upload', {
        method: 'POST',
        body: formData,
      });

      setSuccess(
        lang === 'en'
          ? 'WBS / Company Profile file updated successfully!'
          : 'File Dokumen WBS / Company Profile berhasil diperbarui!'
      );
      setSelectedFile(null);
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <AdminPageHead
        title="Dokumen WBS & Company Profile"
        desc="Unggah file dokumen WBS / Company Profile yang dapat diakses publik."
      />

      {error && <p className="form-error" style={{ marginBottom: 16 }}>{error}</p>}
      {success && (
        <div className="admin-toast" role="status" style={{ marginBottom: 18 }}>
          {success}
        </div>
      )}

      {/* CARD UNGGAH FILE WBS & COMPANY PROFILE */}
      <div>
        <AdminCard title="Pengaturan Dokumen WBS & Company Profile">
          <p className="admin-note" style={{ marginBottom: 20, lineHeight: 1.6 }}>
            File dokumen yang diunggah di sini akan otomatis terbuka di tab baru saat pengunjung mengeklik tombol <strong>Company Profile</strong> di website publik.
          </p>

          <form onSubmit={(e) => void handleUploadWbs(e)} style={{ display: 'grid', gap: 20, maxWidth: 640 }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: 'var(--ink)' }}>
                Judul Dokumen
              </label>

              <input
                type="text"
                className="admin-input"
                style={{ width: '100%' }}
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Misal: Dokumen WBS & Company Profile PT IKN"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: 'var(--ink)' }}>
                Tipe Sumber Dokumen
              </label>

              <SegmentedRadio<'file' | 'url'>
                name="wbsSourceType"
                value={formType}
                onChange={(val) => setFormType(val)}
                options={[
                  { value: 'file', label: 'Unggah File Dokumen (PDF / DOCX / PPT)' },
                  { value: 'url', label: 'Tautan URL Eksternal' },
                ]}
              />
            </div>

            {formType === 'file' ? (
              <FileUploadDropzone
                label="Unggah File Dokumen"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png"
                selectedFile={selectedFile}
                onFileSelect={(file) => setSelectedFile(file)}
                activeFilePath={wbsConfig?.filePath}
                activeFileName={wbsConfig?.fileName}
                helperText="Format didukung: PDF, DOCX, PPT, PPTX (Maks 20MB)"
              />
            ) : (
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: 8, color: 'var(--ink)' }}>
                  Tautan URL Dokumen
                </label>

                <input
                  type="url"
                  className="admin-input"
                  style={{ width: '100%' }}
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://..."
                  required={formType === 'url'}
                />

                {wbsConfig?.url && (
                  <p className="admin-note" style={{ marginTop: 10 }}>
                    Tautan Aktif:{' '}
                    <a href={wbsConfig.url} target="_blank" rel="noopener noreferrer" className="link" style={{ fontWeight: 600 }}>
                      {wbsConfig.url} (Buka tautan ↗)
                    </a>
                  </p>
                )}
              </div>
            )}

            <div style={{ marginTop: 4 }}>
              <button type="submit" className="btn btn-solid btn-sm" disabled={uploading}>
                {uploading ? 'Menyimpan...' : 'Simpan & Unggah Dokumen'}
              </button>
            </div>
          </form>
        </AdminCard>
      </div>
    </div>
  );
}
