'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import type { IconName } from '@/lib/types';
import styles from './Toast.module.css';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  title: string;
  body?: string;
  /** Path tujuan saat toast diklik (router Next). */
  href?: string;
  icon?: IconName;
  tone?: ToastTone;
  /** Dipanggil saat toast diklik, sebelum pindah halaman (mis. menandai notifikasi dibaca). */
  onClick?: () => void;
}

type ToastItem = ToastOptions & { id: number };

const DURATION_MS = 6000;
// Setelah dijeda (hover/fokus/tab tersembunyi), toast tidak langsung hilang begitu dilepas.
const MIN_RESUME_MS = 1500;
const EXIT_MS = 180;
const MAX_VISIBLE = 4;

let nextId = 1;
// null = kosongkan semua toast (dismissToasts).
let listener: ((item: ToastItem | null) => void) | null = null;

/**
 * Tampilkan toast di pojok kanan atas (di bawah top bar) dari komponen klien mana pun.
 * ToastHost (dipasang sekali di root layout) yang merendernya; tanpa host, panggilan diabaikan.
 */
export function toast(options: ToastOptions): void {
  listener?.({ ...options, id: nextId++ });
}

/** Tutup semua toast sekaligus (mis. saat panel lonceng dibuka, agar daftar notifikasi tidak tertutup). */
export function dismissToasts(): void {
  listener?.(null);
}

function ToastCard({ item, closeLabel, onDone }: { item: ToastItem; closeLabel: string; onDone: (id: number) => void }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  const remaining = useRef(DURATION_MS);
  const startedAt = useRef(0);

  const close = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setLeaving(true);
    window.setTimeout(() => onDone(item.id), EXIT_MS);
  }, [item.id, onDone]);

  const pause = useCallback(() => {
    if (timer.current === null) return;
    window.clearTimeout(timer.current);
    timer.current = null;
    remaining.current -= Date.now() - startedAt.current;
  }, []);

  const resume = useCallback(() => {
    if (timer.current !== null || document.hidden) return;
    startedAt.current = Date.now();
    remaining.current = Math.max(remaining.current, MIN_RESUME_MS);
    timer.current = window.setTimeout(close, remaining.current);
  }, [close]);

  // Hitung mundur berjalan hanya selagi tab terlihat, agar toast tidak lewat tanpa terbaca.
  useEffect(() => {
    const onVisibility = () => (document.hidden ? pause() : resume());
    resume();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
  }, [pause, resume]);

  function activate() {
    item.onClick?.();
    if (item.href) router.push(item.href);
    close();
  }

  const content = (
    <>
      <span className={styles.icon}>
        <Icon name={item.icon || 'bell'} size={18} />
      </span>
      <span className={styles.text}>
        <strong>{item.title}</strong>
        {item.body && <span>{item.body}</span>}
      </span>
    </>
  );

  return (
    <div
      className={`${styles.toast} ${styles[item.tone || 'info']} ${leaving ? styles.leaving : ''}`}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {item.href || item.onClick ? (
        <button type="button" className={styles.main} onClick={activate}>
          {content}
        </button>
      ) : (
        <div className={styles.main}>{content}</div>
      )}
      <button type="button" className={styles.close} aria-label={closeLabel} onClick={close}>
        <Icon name="close" size={15} strokeWidth={2} />
      </button>
    </div>
  );
}

export default function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const [lang, setLang] = useState<'id' | 'en'>('id');

  useEffect(() => {
    listener = (item) => {
      if (!item) {
        setItems([]);
        return;
      }
      setLang(document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'id');
      setItems((prev) => [...prev, item]);
    };
    return () => {
      listener = null;
    };
  }, []);

  const remove = useCallback((id: number) => setItems((prev) => prev.filter((item) => item.id !== id)), []);

  // Wadah selalu ada agar pembaca layar mengumumkan toast yang masuk; sisanya antre sampai ada tempat.
  return (
    <div className={styles.stack} role="status" aria-live="polite">
      {items.slice(0, MAX_VISIBLE).map((item) => (
        <ToastCard key={item.id} item={item} closeLabel={lang === 'en' ? 'Dismiss' : 'Tutup'} onDone={remove} />
      ))}
    </div>
  );
}
