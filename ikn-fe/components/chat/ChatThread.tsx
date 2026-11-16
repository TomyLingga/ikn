'use client';

import { useEffect, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import { tr } from '@/lib/cms';
import { orderLabel, orderVariant } from '@/lib/commerce';
import { formatMoney } from '@/lib/format';
import type { ChatContext, ChatMessage, ChatRole, Lang } from '@/lib/types';
import { useEditDeadlineTick } from './useChat';
import styles from './Chat.module.css';

export const CHAT_BODY_MAX = 2000;

/** Jarak (px) dari puncak utas yang memicu muat halaman pesan lebih lama. */
const TOP_TRIGGER_PX = 48;

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return lang === 'en' ? 'Today' : 'Hari ini';
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return lang === 'en' ? 'Yesterday' : 'Kemarin';
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function clock(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

interface ContextCardProps {
  context: ChatContext;
  lang: Lang;
  productHref: (slug: string) => string;
  orderHref: (number: string) => string;
}

// Kartu rujukan produk/pesanan yang dilampirkan customer pada pesan.
export function ChatContextCard({ context, lang, productHref, orderHref }: ContextCardProps) {
  if (context.type === 'product') {
    return (
      <Link href={productHref(context.slug)} className={styles.context}>
        <span className={styles.contextThumb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {context.image ? <img src={context.image} alt="" loading="lazy" /> : <Icon name="package" size={20} />}
        </span>
        <span className={styles.contextBody}>
          <small>{lang === 'en' ? 'Product' : 'Produk'}</small>
          <strong>{tr(context.name, lang)}</strong>
          {context.price != null && (
            <span>
              {formatMoney(context.price, context.currency)}
              {context.unit ? `/${context.unit}` : ''}
            </span>
          )}
        </span>
      </Link>
    );
  }

  return (
    <Link href={orderHref(context.number)} className={styles.context}>
      <span className={styles.contextThumb}>
        <Icon name="orders" size={20} />
      </span>
      <span className={styles.contextBody}>
        <small>{lang === 'en' ? 'Order' : 'Pesanan'}</small>
        <strong className="mono">{context.number}</strong>
        <span>
          {context.status ? orderLabel(context.status, orderVariant({ deliveryTerm: { family: context.family } }))[lang] : ''}
          {context.grandTotal != null ? ` · ${formatMoney(context.grandTotal, context.currency)}` : ''}
        </span>
      </span>
    </Link>
  );
}

interface ChatThreadProps {
  messages: ChatMessage[];
  /** Pihak yang sedang melihat: pesan miliknya tampil di kanan. */
  viewer: ChatRole;
  lang: Lang;
  productHref: (slug: string) => string;
  orderHref: (number: string) => string;
  /** Muatan awal utas sedang berjalan. */
  loading?: boolean;
  hasMore?: boolean;
  /** Halaman pesan lebih lama sedang dimuat (ikon loading di puncak utas). */
  loadingOlder?: boolean;
  /** Dipanggil otomatis saat pembaca menggulir ke puncak, dan dari tombol cadangan "Muat pesan sebelumnya". */
  onLoadOlder?: () => void;
  emptyText: string;
  /** Nama yang ditampilkan untuk pesan lawan bila API tidak mengirim senderName. */
  otherName: string;
  /** Edit/tarik pesan sendiri: tombolnya hanya tampil selama `editableUntil` pesan belum lewat (ASUMSI A-99). */
  onEdit?: (message: ChatMessage) => void;
  onRetract?: (message: ChatMessage) => void;
  /** Pesan yang sedang diedit di kotak tulis (disorot). */
  editingId?: number | null;
  /** Permintaan edit/tarik sedang berjalan. */
  actionsDisabled?: boolean;
  /** Lama jendela edit dari API (detik), untuk keterangan tombol Edit/Tarik. */
  editWindowSeconds?: number;
}

// Daftar gelembung pesan dengan pemisah hari. Hanya halaman terbaru yang dimuat saat dibuka; halaman lebih lama
// dimuat ketika pembaca menggulir ke puncak, dengan posisi baca dipertahankan. Menggulir ke bawah saat ada pesan
// baru, kecuali pembaca sedang melihat pesan lama (posisi gulir jauh dari dasar).
export function ChatThread({
  messages,
  viewer,
  lang,
  productHref,
  orderHref,
  loading,
  hasMore,
  loadingOlder,
  onLoadOlder,
  emptyText,
  otherName,
  onEdit,
  onRetract,
  editingId,
  actionsDisabled,
  editWindowSeconds = 0,
}: ChatThreadProps) {
  const box = useRef<HTMLDivElement>(null);
  const firstId = messages[0]?.id ?? 0;
  const lastId = messages[messages.length - 1]?.id ?? 0;
  const stick = useRef(true);
  // Keadaan render sebelumnya: id pesan teratas/terbawah dan posisi pesan teratas, untuk menjaga posisi baca.
  const prev = useRef({ first: 0, last: 0, anchorTop: 0 });
  const filledFor = useRef(0);
  const canLoadOlder = !!hasMore && !!onLoadOlder && !loading && !loadingOlder;
  const older = useRef({ can: canLoadOlder, load: onLoadOlder });
  older.current = { can: canLoadOlder, load: onLoadOlder };

  useEditDeadlineTick(messages);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      if (el.scrollTop < TOP_TRIGGER_PX && older.current.can) older.current.load?.();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    // Kotak utas mengecil/membesar (bilah edit atau galat muncul, kotak tulis bertambah tinggi): pembaca yang
    // sedang di dasar tetap di dasar, sehingga pesan terakhir dan tombolnya tidak tertutup.
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (stick.current) el.scrollTop = el.scrollHeight;
    });
    resize?.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      resize?.disconnect();
    };
  }, []);

  // Tanpa daftar dependensi: berjalan setelah setiap render agar posisi pesan teratas yang tersimpan selalu terbaru.
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const before = prev.current;
    if (lastId === 0) {
      stick.current = true; // utas dikosongkan (ganti percakapan): utas berikutnya mulai dari dasar
    } else if (before.last === 0 || (lastId !== before.last && stick.current)) {
      el.scrollTop = el.scrollHeight;
    } else if (before.first !== 0 && firstId < before.first) {
      // Halaman lama disisipkan di atas: geser sejauh perpindahan pesan yang tadinya teratas, sehingga pesan yang
      // sedang dibaca tetap di tempatnya.
      const anchor = el.querySelector<HTMLElement>(`[data-mid="${before.first}"]`);
      if (anchor) el.scrollTop += anchor.offsetTop - before.anchorTop;
    }
    const top = firstId ? el.querySelector<HTMLElement>(`[data-mid="${firstId}"]`) : null;
    prev.current = { first: firstId, last: lastId, anchorTop: top ? top.offsetTop : 0 };
  });

  // Halaman pertama belum memenuhi kotak (tidak ada yang bisa digulir): muat halaman lama sekali per pesan teratas.
  useEffect(() => {
    const el = box.current;
    if (!el || !canLoadOlder || firstId === 0 || filledFor.current === firstId) return;
    if (el.clientHeight > 0 && el.scrollHeight <= el.clientHeight + TOP_TRIGGER_PX) {
      filledFor.current = firstId;
      older.current.load?.();
    }
  }, [canLoadOlder, firstId]);

  const now = Date.now();
  const actionsHint =
    editWindowSeconds > 0
      ? lang === 'en'
        ? `You can edit or retract a message within ${editWindowSeconds} seconds of sending it`
        : `Pesan bisa diedit atau ditarik dalam ${editWindowSeconds} detik setelah dikirim`
      : undefined;
  let previousDay = '';

  return (
    <div className={styles.thread} ref={box} role="log" aria-live="polite">
      {hasMore && onLoadOlder && messages.length > 0 && (
        <div className={styles.olderSlot}>
          {loadingOlder ? (
            <Spinner size={16} label={lang === 'en' ? 'Loading earlier messages…' : 'Memuat pesan sebelumnya…'} />
          ) : (
            <button type="button" className={styles.older} onClick={onLoadOlder} disabled={loading}>
              {lang === 'en' ? 'Load earlier messages' : 'Muat pesan sebelumnya'}
            </button>
          )}
        </div>
      )}
      {messages.length === 0 &&
        (loading ? (
          <div className={styles.threadEmpty}>
            <Spinner block label={lang === 'en' ? 'Loading messages…' : 'Memuat pesan…'} />
          </div>
        ) : (
          <p className={styles.threadEmpty}>{emptyText}</p>
        ))}
      {messages.map((message) => {
        const mine = message.role === viewer;
        const day = dayKey(message.createdAt);
        const showDay = day !== previousDay;
        previousDay = day;
        const retracted = !!message.retracted;
        const canChange = !retracted && (message.editableUntil ?? 0) > now && (!!onEdit || !!onRetract);
        return (
          <div key={message.id} className={styles.row}>
            {showDay && <span className={styles.day}>{dayLabel(message.createdAt, lang)}</span>}
            {/* data-mid di baris gelembung (bukan di pembungkus berlabel hari) agar jangkar posisi baca tidak ikut
                bergeser saat label hari pindah ke pesan yang lebih lama. */}
            <div className={`${styles.bubbleRow} ${mine ? styles.mine : styles.theirs}`} data-mid={message.id}>
              <div className={styles.bubbleCol}>
                <div className={`${styles.bubble} ${retracted ? styles.retracted : ''} ${editingId === message.id ? styles.bubbleEditing : ''}`}>
                  {!mine && <span className={styles.sender}>{message.senderName || otherName}</span>}
                  {retracted ? (
                    <p className={styles.retractedText}>
                      <Icon name="cancelCircle" size={14} />
                      {lang === 'en' ? 'Message retracted' : 'Pesan ditarik'}
                    </p>
                  ) : (
                    <>
                      {message.context && <ChatContextCard context={message.context} lang={lang} productHref={productHref} orderHref={orderHref} />}
                      <p>{message.body}</p>
                    </>
                  )}
                  <span className={styles.meta}>
                    {!retracted && message.editedAt && <em className={styles.edited}>{lang === 'en' ? 'edited' : 'diedit'}</em>}
                    <time dateTime={message.createdAt}>{clock(message.createdAt, lang)}</time>
                  </span>
                </div>
                {canChange && (
                  <div className={styles.actions} title={actionsHint}>
                    {onEdit && (
                      <button type="button" className={styles.action} onClick={() => onEdit(message)} disabled={actionsDisabled}>
                        <Icon name="edit" size={13} />
                        Edit
                      </button>
                    )}
                    {onRetract && (
                      <button type="button" className={`${styles.action} ${styles.actionDanger}`} onClick={() => onRetract(message)} disabled={actionsDisabled}>
                        <Icon name="cancelCircle" size={13} />
                        {lang === 'en' ? 'Retract' : 'Tarik'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  /** Mengirim pesan baru, atau menyimpan perubahan bila `editing` terisi. */
  onSend: () => void;
  sending: boolean;
  lang: Lang;
  placeholder?: string;
  disabled?: boolean;
  /** Pesan yang sedang diedit: bilah "Sedang mengedit pesan" tampil di atas kotak tulis. */
  editing?: ChatMessage | null;
  onCancelEdit?: () => void;
}

// Kotak tulis pesan: Enter mengirim, Shift+Enter membuat baris baru. Saat mengedit, kotak yang sama dipakai untuk
// mengubah isi pesan; Escape atau tombol Batal membatalkan.
export function ChatComposer({ value, onChange, onSend, sending, lang, placeholder, disabled = false, editing = null, onCancelEdit }: ChatComposerProps) {
  const area = useRef<HTMLTextAreaElement>(null);
  const editingId = editing?.id ?? 0;

  // Tinggi mengikuti isi sampai batas, lalu bergulir.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  // Mulai mengedit: fokus ke kotak tulis dengan kursor di akhir isi.
  useEffect(() => {
    const el = area.current;
    if (!editingId || !el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [editingId]);

  const canSend = value.trim().length > 0 && !sending && !disabled;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSend();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape' && editing && onCancelEdit) {
      // Escape membatalkan edit saja; jangan sampai ikut menutup panel chat.
      event.preventDefault();
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onCancelEdit();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  const sendLabel = editing ? (lang === 'en' ? 'Save changes' : 'Simpan perubahan') : lang === 'en' ? 'Send message' : 'Kirim pesan';

  return (
    <div className={styles.composerWrap}>
      {editing && (
        <div className={styles.editBar} role="status">
          <Icon name="edit" size={16} />
          <span className={styles.editBarText}>
            <strong>{lang === 'en' ? 'Editing message' : 'Sedang mengedit pesan'}</strong>
            <small>{editing.body}</small>
          </span>
          <button type="button" className={styles.editCancel} onClick={onCancelEdit} disabled={sending}>
            {lang === 'en' ? 'Cancel' : 'Batal'}
          </button>
        </div>
      )}
      <form className={styles.composer} onSubmit={submit}>
        <textarea
          ref={area}
          rows={1}
          value={value}
          maxLength={CHAT_BODY_MAX}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={editing ? (lang === 'en' ? 'Edit your message…' : 'Ubah isi pesan…') : placeholder || (lang === 'en' ? 'Write a message…' : 'Tulis pesan…')}
          aria-label={editing ? (lang === 'en' ? 'Edit message' : 'Edit pesan') : lang === 'en' ? 'Message' : 'Pesan'}
        />
        <button type="submit" className={styles.send} disabled={!canSend} aria-label={sendLabel} title={sendLabel}>
          <Icon name={editing ? 'check' : 'send'} size={18} />
        </button>
      </form>
    </div>
  );
}
