'use client';

import { useEffect, useLayoutEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { tr } from '@/lib/cms';
import { orderLabel } from '@/lib/commerce';
import { formatIDR } from '@/lib/format';
import type { ChatContext, ChatMessage, ChatRole, Lang } from '@/lib/types';
import styles from './Chat.module.css';

export const CHAT_BODY_MAX = 2000;

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
              {formatIDR(context.price)}
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
          {context.status ? orderLabel(context.status)[lang] : ''}
          {context.grandTotal != null ? ` · ${formatIDR(context.grandTotal)}` : ''}
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
  loading?: boolean;
  hasMore?: boolean;
  onLoadOlder?: () => void;
  emptyText: string;
  /** Nama yang ditampilkan untuk pesan lawan bila API tidak mengirim senderName. */
  otherName: string;
}

// Daftar gelembung pesan dengan pemisah hari. Menggulir ke bawah saat ada pesan baru, kecuali pembaca
// sedang melihat pesan lama (posisi gulir jauh dari dasar).
export function ChatThread({ messages, viewer, lang, productHref, orderHref, loading, hasMore, onLoadOlder, emptyText, otherName }: ChatThreadProps) {
  const box = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id ?? 0;
  const stick = useRef(true);
  const prevLast = useRef(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el || lastId === prevLast.current) return;
    const first = prevLast.current === 0;
    prevLast.current = lastId;
    if (first || stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  let previousDay = '';

  return (
    <div className={styles.thread} ref={box} role="log" aria-live="polite">
      {hasMore && onLoadOlder && (
        <button type="button" className={styles.older} onClick={onLoadOlder} disabled={loading}>
          {lang === 'en' ? 'Load earlier messages' : 'Muat pesan sebelumnya'}
        </button>
      )}
      {messages.length === 0 && <p className={styles.threadEmpty}>{loading ? (lang === 'en' ? 'Loading messages…' : 'Memuat pesan…') : emptyText}</p>}
      {messages.map((message) => {
        const mine = message.role === viewer;
        const day = dayKey(message.createdAt);
        const showDay = day !== previousDay;
        previousDay = day;
        return (
          <div key={message.id} className={styles.row}>
            {showDay && <span className={styles.day}>{dayLabel(message.createdAt, lang)}</span>}
            <div className={`${styles.bubbleRow} ${mine ? styles.mine : styles.theirs}`}>
              <div className={styles.bubble}>
                {!mine && <span className={styles.sender}>{message.senderName || otherName}</span>}
                {message.context && <ChatContextCard context={message.context} lang={lang} productHref={productHref} orderHref={orderHref} />}
                <p>{message.body}</p>
                <time dateTime={message.createdAt}>{clock(message.createdAt, lang)}</time>
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
  onSend: () => void;
  sending: boolean;
  lang: Lang;
  placeholder?: string;
  disabled?: boolean;
}

// Kotak tulis pesan: Enter mengirim, Shift+Enter membuat baris baru.
export function ChatComposer({ value, onChange, onSend, sending, lang, placeholder, disabled = false }: ChatComposerProps) {
  const area = useRef<HTMLTextAreaElement>(null);

  // Tinggi mengikuti isi sampai batas, lalu bergulir.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && !sending && !disabled;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSend) onSend();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <form className={styles.composer} onSubmit={submit}>
      <textarea
        ref={area}
        rows={1}
        value={value}
        maxLength={CHAT_BODY_MAX}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder || (lang === 'en' ? 'Write a message…' : 'Tulis pesan…')}
        aria-label={lang === 'en' ? 'Message' : 'Pesan'}
      />
      <button type="submit" className={styles.send} disabled={!canSend} aria-label={lang === 'en' ? 'Send message' : 'Kirim pesan'}>
        <Icon name="send" size={18} />
      </button>
    </form>
  );
}
