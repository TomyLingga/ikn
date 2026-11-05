'use client';

import { useState } from 'react';
import Select from '@/components/Select';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';
import type { MediaItem } from '@/lib/cms';

export type MediaUrlKind = 'auto' | 'image' | 'video';

// Tautkan foto/video dari URL tanpa mengunggah (ASUMSI A-92, POST /admin/media/url): YouTube, Vimeo, Google Drive
// (berkas dibagikan "Siapa saja yang memiliki link"), atau URL langsung berkas gambar/video. Hasilnya media library biasa.
export default function MediaUrlForm({
  kind = 'auto',
  collection = 'general',
  onDone,
  onCancel,
}: {
  /** Jenis yang diterima field; 'auto' = admin boleh memilih (field gambar atau video). */
  kind?: MediaUrlKind;
  collection?: string;
  onDone: (media: MediaItem) => void;
  onCancel?: () => void;
}) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<MediaUrlKind>(kind);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (!url.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      const media = await api<MediaItem>('/admin/media/url', { method: 'POST', body: { url: url.trim(), kind: chosen, name: name.trim() || undefined, collection } });
      setUrl('');
      setName('');
      onDone(media);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-form media-url-form">
      <label>
        <span className="field-label">{t('URL foto/video', 'Photo/video URL')}</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder="https://youtu.be/…, https://drive.google.com/file/d/…"
          inputMode="url"
        />
      </label>
      <div className="media-url-row">
        {kind === 'auto' && (
          <label>
            <span className="field-label">{t('Jenis media', 'Media type')}</span>
            <Select value={chosen} onChange={(e) => setChosen(e.target.value as MediaUrlKind)}>
              <option value="auto">{t('Otomatis dari URL', 'Detect from URL')}</option>
              <option value="image">{t('Gambar', 'Image')}</option>
              <option value="video">{t('Video', 'Video')}</option>
            </Select>
          </label>
        )}
        <label>
          <span className="field-label">{t('Nama tampilan (opsional)', 'Display name (optional)')}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </label>
      </div>
      <small className="admin-field-hint">
        {t(
          'YouTube, Vimeo, Google Drive, atau tautan langsung berkas gambar/video. Berkas Google Drive harus dibagikan "Siapa saja yang memiliki link"; video Drive tidak bisa diputar otomatis sebagai latar, gunakan YouTube untuk video latar.',
          'YouTube, Vimeo, Google Drive, or a direct image/video file link. Google Drive files must be shared with "Anyone with the link"; Drive videos cannot autoplay as backgrounds, use YouTube for background videos.',
        )}
      </small>
      {error && <small className="cms-field-error">{error}</small>}
      <div className="media-url-actions">
        <button type="button" className="btn btn-solid btn-sm" onClick={() => void submit()} disabled={busy || !url.trim()}>
          {busy ? t('Menyimpan…', 'Saving…') : t('Simpan tautan', 'Save link')}
        </button>
        {onCancel && (
          <button type="button" className="btn btn-line btn-sm" onClick={onCancel}>
            {t('Batal', 'Cancel')}
          </button>
        )}
      </div>
    </div>
  );
}
