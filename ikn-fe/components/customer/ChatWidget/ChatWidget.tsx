'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Icon from '@/components/Icon';
import { ChatComposer, ChatThread } from '@/components/chat';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, ApiError } from '@/lib/api';
import { CHAT_OPEN_EVENT, refreshCustomerBadges, shopPaths, type ChatAttachment } from '@/lib/shop';
import type { ChatMessage, CustomerChat } from '@/lib/types';
import styles from './ChatWidget.module.css';

const POLL_OPEN_MS = 4000;
const POLL_CLOSED_MS = 20000;
export const GUEST_TOKEN_KEY = 'ikn-chat-guest-token';

type Stage = 'welcome' | 'form' | 'thread';

interface ChatWidgetProps {
  open: boolean;
  onClose: () => void;
  onOpen: () => void;
  /** Pesan admin belum dibaca milik customer login (dari GET /customer/badges). */
  badgeUnread?: number;
  /** Tamu: jumlah belum dibaca hasil polling widget, untuk lencana tombol melayang. */
  onGuestUnread?: (unread: number) => void;
}

function readGuestToken(): string {
  try {
    return window.localStorage.getItem(GUEST_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function writeGuestToken(token: string): void {
  try {
    if (token) window.localStorage.setItem(GUEST_TOKEN_KEY, token);
    else window.localStorage.removeItem(GUEST_TOKEN_KEY);
  } catch {
    // Penyimpanan diblokir (mode privat): percakapan tamu hanya hidup selama halaman terbuka.
  }
}

// Live chat dengan penjual (ASUMSI A-73). Customer login langsung ke utas (GET/POST /customer/chat*);
// pengunjung yang belum login mengisi nama/email/telepon dulu (POST /chat/guest) dan dikenali lewat token di
// browser. Setelah login, percakapan tamu diambil alih akun (POST /customer/chat/claim).
// Panel dibuka dari tombol melayang (FloatingContacts) atau openChat() dari halaman produk/pesanan.
export default function ChatWidget({ open, onClose, onOpen, badgeUnread = 0, onGuestUnread }: ChatWidgetProps) {
  const { lang } = useLang();
  const { customer, ready } = useAuth();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const guest = ready && !customer;
  const paths = shopPaths(!!customer);

  const [guestToken, setGuestToken] = useState('');
  const [stage, setStage] = useState<Stage>('thread');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachment, setAttachment] = useState<ChatAttachment | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', body: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [guestUnread, setGuestUnread] = useState(0);
  const lastId = useRef(0);

  // Token tamu dibaca sekali di browser; tahap awal mengikuti keadaan sesi.
  useEffect(() => {
    if (!ready) return;
    const token = readGuestToken();
    setGuestToken(token);
    setStage(customer || token ? 'thread' : 'welcome');
  }, [ready, customer]);

  const endpoint = useCallback(
    (suffix: 'show' | 'send' | 'read', query = '') => {
      if (customer) {
        return suffix === 'show' ? `/customer/chat${query}` : suffix === 'send' ? '/customer/chat/messages' : '/customer/chat/read';
      }
      const tokenQuery = `token=${encodeURIComponent(guestToken)}`;
      return suffix === 'show' ? `/chat/guest?${tokenQuery}${query ? `&${query.slice(1)}` : ''}` : suffix === 'send' ? '/chat/guest/messages' : '/chat/guest/read';
    },
    [customer, guestToken],
  );
  const guestBody = useCallback((body: Record<string, unknown> = {}) => (customer ? body : { token: guestToken, ...body }), [customer, guestToken]);

  const reset = useCallback(() => {
    setMessages([]);
    setHasMore(false);
    setLoaded(false);
    lastId.current = 0;
  }, []);

  const merge = useCallback((incoming: ChatMessage[], prepend = false) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const known = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !known.has(m.id));
      if (fresh.length === 0) return prev;
      const next = prepend ? [...fresh, ...prev] : [...prev, ...fresh];
      lastId.current = Math.max(lastId.current, ...next.map((m) => m.id));
      return next;
    });
  }, []);

  const reportGuestUnread = useCallback(
    (unread: number) => {
      setGuestUnread(unread);
      onGuestUnread?.(unread);
    },
    [onGuestUnread],
  );

  const markRead = useCallback(async () => {
    try {
      await api(endpoint('read'), { method: 'POST', body: guestBody() });
      if (customer) refreshCustomerBadges();
      else reportGuestUnread(0);
    } catch {
      // Penghitung akan sinkron pada polling berikutnya.
    }
  }, [endpoint, guestBody, customer, reportGuestUnread]);

  // Token tamu yang kedaluwarsa/dihapus di server: mulai lagi dari formulir.
  const dropGuestToken = useCallback(() => {
    writeGuestToken('');
    setGuestToken('');
    reset();
    setStage('welcome');
    reportGuestUnread(0);
  }, [reset, reportGuestUnread]);

  // Tamu yang baru login: percakapan tamunya diambil alih akun, lalu utas dimuat ulang sebagai customer.
  useEffect(() => {
    if (!customer) return;
    const token = readGuestToken();
    if (!token) return;
    setGuestToken('');
    // Token tamu baru dihapus setelah klaim berhasil atau ditolak permanen (404/422); gagal jaringan → dicoba lagi lain kali.
    api('/customer/chat/claim', { method: 'POST', body: { token } })
      .then(() => writeGuestToken(''))
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) writeGuestToken('');
      })
      .finally(() => {
        reset();
        refreshCustomerBadges();
      });
  }, [customer, reset]);

  // Dibuka dari halaman lain (tombol "Chat penjual" di produk, "Tanya pesanan ini" di detail pesanan).
  useEffect(() => {
    const onOpenEvent = (event: Event) => {
      const detail = (event as CustomEvent<ChatAttachment | undefined>).detail;
      if (detail) {
        if (customer) setAttachment(detail);
        else setForm((f) => ({ ...f, body: f.body || (lang === 'en' ? `Hello, I would like to ask about ${detail.label}.` : `Halo, saya ingin bertanya tentang ${detail.label}.`) }));
      }
      onOpen();
    };
    window.addEventListener(CHAT_OPEN_EVENT, onOpenEvent);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, onOpenEvent);
  }, [customer, lang, onOpen]);

  const canLoad = ready && (customer ? true : !!guestToken);

  // Muatan awal saat panel pertama kali dibuka (customer) atau saat token tamu ada (untuk lencana).
  useEffect(() => {
    if (!canLoad || loaded || (!open && !!customer)) return;
    let cancelled = false;
    setLoading(true);
    api<CustomerChat>(endpoint('show'))
      .then((res) => {
        if (cancelled) return;
        merge(res.messages);
        setHasMore(res.hasMore);
        setLoaded(true);
        const unread = res.conversation?.unread ?? 0;
        if (open && unread > 0) void markRead();
        else if (!customer) reportGuestUnread(unread);
      })
      .catch((err) => {
        if (cancelled) return;
        if (!customer && err instanceof ApiError && err.status === 404) dropGuestToken();
        else setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoad, loaded, open, customer, endpoint, merge, markRead, reportGuestUnread, dropGuestToken]);

  // Polling: tiap 4 detik saat panel terbuka; tamu dengan token juga memolling pelan saat tertutup (lencana).
  useEffect(() => {
    if (!canLoad || !loaded) return;
    if (!open && customer) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await api<CustomerChat>(endpoint('show', `?after=${lastId.current}`));
        merge(res.messages);
        if (open && res.messages.some((m) => m.role === 'admin')) void markRead();
        else if (!open && !customer) reportGuestUnread(res.conversation?.unread ?? 0);
      } catch {
        // Jaringan putus sesaat: coba lagi pada putaran berikutnya.
      }
    };
    const timer = window.setInterval(tick, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => window.clearInterval(timer);
  }, [canLoad, loaded, open, customer, endpoint, merge, markRead, reportGuestUnread]);

  // Panel dibuka ketika ada pesan belum dibaca: tandai dibaca.
  useEffect(() => {
    if (!open || !loaded) return;
    const unread = customer ? badgeUnread : guestUnread;
    if (unread > 0) void markRead();
  }, [open, loaded, customer, badgeUnread, guestUnread, markRead]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function loadOlder() {
    const oldest = messages[0];
    if (loading || !oldest) return;
    setLoading(true);
    try {
      const res = await api<CustomerChat>(endpoint('show', `?before=${oldest.id}`));
      merge(res.messages, true);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError('');
    try {
      const context = customer && attachment ? (attachment.type === 'product' ? { type: 'product', slug: attachment.slug } : { type: 'order', number: attachment.number }) : undefined;
      const res = await api<{ message: ChatMessage }>(endpoint('send'), { method: 'POST', body: guestBody({ body, context }) });
      merge([res.message]);
      setDraft('');
      setAttachment(null);
    } catch (err) {
      if (!customer && err instanceof ApiError && err.status === 404) dropGuestToken();
      else setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  // Tamu: formulir perkenalan + pesan pertama → token disimpan, lanjut ke utas.
  async function startGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setFormErrors({});
    setError('');
    try {
      const res = await api<{ token: string; message: ChatMessage }>('/chat/guest', { method: 'POST', body: form });
      writeGuestToken(res.token);
      setGuestToken(res.token);
      reset();
      merge([res.message]);
      setLoaded(true);
      setStage('thread');
      setForm((f) => ({ ...f, body: '' }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setFormErrors(Object.fromEntries(Object.entries(err.errors).map(([key, list]) => [key, list[0] || ''])));
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const brand = (
    <span className={styles.brand}>
      <Image src="/img/rubin-logo.png" alt="" width={36} height={36} />
    </span>
  );
  const status = t('Biasanya membalas dalam beberapa menit', 'Usually replies within minutes');

  return (
    <section className={styles.panel} role="dialog" aria-label={t('Chat dengan penjual', 'Chat with the seller')}>
      {stage === 'welcome' ? (
        <div className={styles.welcome}>
          <div className={styles.welcomeTop}>
            {brand}
            <button type="button" className={styles.closeDark} onClick={onClose} aria-label={t('Tutup chat', 'Close chat')}>
              <Icon name="close" size={20} />
            </button>
          </div>
          <h2>{t('Hai, kami siap membantu Anda', 'Hi, we are here to help')}</h2>
          <p>{t('Hubungi kami kapan saja, kami membuat segalanya mudah untuk Anda.', 'Reach out any time; we make everything easy for you.')}</p>
          <button type="button" className={styles.startCard} onClick={() => setStage('form')}>
            <span className={styles.startText}>
              <strong>{t('Kami sedang online', 'We are online')}</strong>
              <small>{status}</small>
              <em>
                {t('Mulai Percakapan', 'Start a conversation')} <Icon name="arrow" size={16} />
              </em>
            </span>
            <span className={styles.startAvatar}>
              <Icon name="users" size={26} />
            </span>
          </button>
        </div>
      ) : (
        <>
          <header className={styles.head}>
            {guest && (
              <button type="button" className={styles.headBtn} onClick={() => setStage('welcome')} aria-label={t('Kembali', 'Back')}>
                <Icon name="chevronLeft" size={20} />
              </button>
            )}
            {brand}
            <span className={styles.headText}>
              <strong>
                PT Industri Karet Nusantara <i className={styles.online} aria-label="online" />
              </strong>
              <small>{status}</small>
            </span>
            <button type="button" className={styles.headBtn} onClick={onClose} aria-label={t('Tutup chat', 'Close chat')}>
              <Icon name="close" size={20} />
            </button>
          </header>

          {stage === 'form' ? (
            <form className={styles.form} onSubmit={startGuest}>
              <p className={styles.formLead}>{t('Perkenalkan diri Anda dan mulai chat', 'Introduce yourself and start chatting')}</p>
              <label>
                <span className="sr-only">{t('Nama', 'Name')}</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Nama Anda', 'Your name')} autoComplete="name" required />
                {formErrors.name && <small>{formErrors.name}</small>}
              </label>
              <label>
                <span className="sr-only">Email</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t('Email Anda', 'Your email')} autoComplete="email" required />
                {formErrors.email && <small>{formErrors.email}</small>}
              </label>
              <label className={styles.phoneField}>
                <span className="sr-only">{t('Telepon', 'Phone')}</span>
                <span className={styles.phonePrefix} aria-hidden="true">
                  <Icon name="phone" size={16} /> +62
                </span>
                <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder={t('Telepon Anda (opsional)', 'Your phone (optional)')} autoComplete="tel" />
                {formErrors.phone && <small>{formErrors.phone}</small>}
              </label>
              <label>
                <span className={styles.fieldLabel}>{t('Pesan', 'Message')}</span>
                <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={t('Tulis pesan Anda', 'Write your message')} required maxLength={2000} />
                {formErrors.body && <small>{formErrors.body}</small>}
              </label>
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className={styles.submit} disabled={sending}>
                {sending ? t('Mengirim…', 'Sending…') : t('Mulai Percakapan', 'Start a conversation')}
              </button>
            </form>
          ) : (
            <>
              <ChatThread
                messages={messages}
                viewer="customer"
                lang={lang}
                productHref={paths.product}
                orderHref={paths.order}
                loading={loading}
                hasMore={hasMore}
                onLoadOlder={() => void loadOlder()}
                otherName="PT IKN"
                emptyText={t(
                  'Halo! Ada yang bisa kami bantu? Tanyakan stok, harga, atau status pesanan Anda di sini.',
                  'Hello! How can we help? Ask about stock, pricing, or your order status here.',
                )}
              />
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              {attachment && (
                <div className={styles.attachment}>
                  <Icon name={attachment.type === 'product' ? 'package' : 'orders'} size={16} />
                  <span>
                    <small>{attachment.type === 'product' ? t('Menanyakan produk', 'Asking about product') : t('Menanyakan pesanan', 'Asking about order')}</small>
                    <strong>{attachment.label}</strong>
                  </span>
                  <button type="button" onClick={() => setAttachment(null)} aria-label={t('Lepas rujukan', 'Remove reference')}>
                    <Icon name="close" size={14} />
                  </button>
                </div>
              )}
              <ChatComposer value={draft} onChange={setDraft} onSend={() => void send()} sending={sending} lang={lang} />
            </>
          )}
        </>
      )}
    </section>
  );
}
