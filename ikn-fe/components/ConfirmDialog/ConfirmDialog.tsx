'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/Icon';
import styles from './ConfirmDialog.module.css';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger = aksi merusak (hapus, batalkan, tolak); tombol utama berwarna merah. */
  tone?: 'primary' | 'danger';
}

type Request = ConfirmOptions & { resolve: (ok: boolean) => void };

let pending: Request | null = null;
let listener: ((request: Request | null) => void) | null = null;

/**
 * Pengganti await confirmDialog(): dialog bergaya aplikasi yang mengembalikan Promise<boolean>.
 * Pakai `if (!(await confirmDialog('Hapus item ini?'))) return;` dari fungsi async mana pun.
 * ConfirmHost (dipasang sekali di root layout) yang merender dialognya; tanpa host, jatuh ke window.confirm.
 */
export function confirmDialog(options: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  if (!listener) return Promise.resolve(typeof window !== 'undefined' ? window.confirm(opts.message) : false);
  // Satu dialog pada satu waktu: permintaan sebelumnya dianggap dibatalkan.
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => {
    pending = { ...opts, resolve };
    listener?.(pending);
  });
}

// Tebak nada dan label dari kalimatnya (teks tombol tetap bisa diatur lewat options).
function inferTone(message: string, title?: string): 'primary' | 'danger' {
  return /^(hapus|batalkan|tolak|nonaktifkan|delete|cancel|reject|deactivate|remove)/i.test((title || message).trim()) ? 'danger' : 'primary';
}

export default function ConfirmHost() {
  const [request, setRequest] = useState<Request | null>(null);
  const [lang, setLang] = useState<'id' | 'en'>('id');
  const confirmBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    listener = (next) => {
      setLang(document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'id');
      setRequest(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!request) return;
    confirmBtn.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        settle(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  function settle(ok: boolean) {
    const current = request;
    setRequest(null);
    pending = null;
    current?.resolve(ok);
  }

  if (!request) return null;

  const tone = request.tone || inferTone(request.message, request.title);
  const title = request.title || (lang === 'en' ? 'Please confirm' : 'Konfirmasi');
  const isDelete = /^(hapus|delete|remove)/i.test((request.title || request.message).trim());
  const confirmLabel = request.confirmLabel || (isDelete ? (lang === 'en' ? 'Yes, delete' : 'Ya, hapus') : lang === 'en' ? 'Yes, continue' : 'Ya, lanjutkan');
  const cancelLabel = request.cancelLabel || (lang === 'en' ? 'Cancel' : 'Batal');

  return createPortal(
    <div className={styles.backdrop} onMouseDown={(event) => event.target === event.currentTarget && settle(false)}>
      <div className={styles.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <span className={`${styles.icon} ${tone === 'danger' ? styles.iconDanger : ''}`}>
          <Icon name={tone === 'danger' ? 'trash' : 'checkCircle'} size={22} />
        </span>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{request.message}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.cancel} onClick={() => settle(false)}>
            {cancelLabel}
          </button>
          <button ref={confirmBtn} type="button" className={`${styles.confirm} ${tone === 'danger' ? styles.confirmDanger : ''}`} onClick={() => settle(true)}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
