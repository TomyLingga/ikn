'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/Icon';
import { dismissUpload, formatMb, subscribeUploads, type UploadItem } from '@/lib/upload-progress';
import styles from './UploadProgress.module.css';

// Dialog unggah global (dipasang sekali di root layout). Setiap request multipart lewat lib/api.ts muncul di sini:
// persentase + ukuran terkirim, "Memproses…" setelah berkas terkirim, galat tetap tampil sampai ditutup.
export default function UploadProgressHost() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => subscribeUploads((next) => {
    setLang(document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'id');
    setItems(next);
  }), []);

  const hasError = items.some((item) => item.status === 'error');
  useEffect(() => {
    if (hasError) closeRef.current?.focus();
  }, [hasError]);

  useEffect(() => {
    if (!hasError) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') items.filter((i) => i.status === 'error').forEach((i) => dismissUpload(i.id));
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hasError, items]);

  if (items.length === 0) return null;
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  return createPortal(
    <div className={styles.backdrop}>
      <div className={styles.dialog} role={hasError ? 'alertdialog' : 'dialog'} aria-modal="true" aria-label={t('Unggah berkas', 'File upload')}>
        {items.map((item, index) => {
          const pct = item.total ? Math.min(100, Math.round((item.loaded / item.total) * 100)) : 0;
          const shown = item.status === 'processing' || item.status === 'done' ? 100 : pct;
          const error = item.status === 'error';
          return (
            <section key={item.id} className={`${styles.item} ${error ? styles.isError : ''} ${item.status === 'done' ? styles.isDone : ''}`}>
              <div className={styles.head}>
                <span className={styles.icon}>
                  <Icon name={error ? 'cancelCircle' : item.status === 'done' ? 'checkCircle' : 'arrow'} size={20} style={!error && item.status !== 'done' ? { transform: 'rotate(-90deg)' } : undefined} />
                </span>
                <div className={styles.titles}>
                  <strong>
                    {error
                      ? t('Unggahan gagal', 'Upload failed')
                      : item.status === 'done'
                        ? t('Unggahan selesai', 'Upload complete')
                        : item.status === 'processing'
                          ? t('Memproses di server…', 'Processing on the server…')
                          : t('Mengunggah berkas…', 'Uploading file…')}
                  </strong>
                  <span className={styles.name} title={item.name}>
                    {item.name}
                  </span>
                </div>
                {!error && <span className={styles.pct}>{shown}%</span>}
              </div>

              {error ? (
                <p className={styles.message} role="alert">
                  {item.message}
                </p>
              ) : (
                <>
                  <div className={styles.bar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={shown} aria-label={item.name}>
                    <span className={`${styles.fill} ${item.status === 'processing' ? styles.pulse : ''}`} style={{ width: `${shown}%` }} />
                  </div>
                  <div className={styles.meta}>
                    <span>
                      {formatMb(item.status === 'uploading' ? item.loaded : item.total)} / {formatMb(item.total)}
                    </span>
                    {item.cancel && item.status === 'uploading' && (
                      <button type="button" className={styles.cancel} onClick={item.cancel}>
                        {t('Batalkan', 'Cancel')}
                      </button>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className={styles.actions}>
                  <button ref={index === items.findIndex((i) => i.status === 'error') ? closeRef : undefined} type="button" className="btn btn-solid btn-sm" onClick={() => dismissUpload(item.id)}>
                    {t('Tutup', 'Close')}
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
