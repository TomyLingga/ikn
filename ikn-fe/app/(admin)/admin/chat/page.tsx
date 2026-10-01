'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { ChatComposer, ChatThread } from '@/components/chat';
import { AdminPageHead } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, type Envelope } from '@/lib/api';
import { queryString, refreshAdminBadges, type AdminChatConversation } from '@/lib/admin';
import { timeAgo } from '@/lib/shop';
import type { ChatMessage } from '@/lib/types';
import styles from './page.module.css';

const LIST_POLL_MS = 8000;
const THREAD_POLL_MS = 4000;

interface ThreadResponse {
  conversation: AdminChatConversation;
  messages: ChatMessage[];
  hasMore: boolean;
}

export default function AdminChatPage() {
  return (
    <Suspense fallback={null}>
      <AdminChat />
    </Suspense>
  );
}

// Kotak masuk live chat (ASUMSI A-73, modul `chat`): daftar percakapan di kiri, utas di kanan.
// Daftar dan utas diperbarui lewat polling; membuka utas menandai pesan customer sudah dibaca.
// `?customer={id}` (dari halaman order/customer) membuka atau membuat percakapan dengan customer itu.
function AdminChat() {
  const { lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [conversations, setConversations] = useState<AdminChatConversation[]>([]);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [active, setActive] = useState<AdminChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const activeId = active?.id ?? null;

  const loadList = useCallback(async () => {
    try {
      const res = await api<Envelope<AdminChatConversation[]>>(`/admin/chats${queryString({ q, unread: unreadOnly ? 1 : '', perPage: 50 })}`, { raw: true });
      setConversations(res.data || []);
      setListError('');
    } catch (err) {
      setListError(errorMessage(err));
    } finally {
      setListLoading(false);
    }
  }, [q, unreadOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadList();
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList]);

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

  const markRead = useCallback(
    async (id: number) => {
      try {
        await api(`/admin/chats/${id}/read`, { method: 'POST' });
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
        refreshAdminBadges();
      } catch {
        // Penghitung akan sinkron pada polling berikutnya.
      }
    },
    [],
  );

  const open = useCallback(
    async (conversation: AdminChatConversation) => {
      setActive(conversation);
      setMessages([]);
      setHasMore(false);
      setDraft('');
      setThreadError('');
      setThreadLoading(true);
      lastId.current = 0;
      try {
        const res = await api<ThreadResponse>(`/admin/chats/${conversation.id}`);
        setActive(res.conversation);
        merge(res.messages);
        setHasMore(res.hasMore);
        if (res.conversation.unread > 0) void markRead(conversation.id);
      } catch (err) {
        setThreadError(errorMessage(err));
      } finally {
        setThreadLoading(false);
      }
    },
    [merge, markRead],
  );

  // ?customer={id}: buka (atau buat) percakapan dengan customer itu, lalu bersihkan query.
  const customerParam = params.get('customer');
  useEffect(() => {
    if (!customerParam) return;
    let cancelled = false;
    api<AdminChatConversation>('/admin/chats', { method: 'POST', body: { customerId: Number(customerParam) } })
      .then((conversation) => {
        if (cancelled) return;
        void open(conversation);
        router.replace('/admin/chat', { scroll: false });
      })
      .catch((err) => {
        if (!cancelled) setListError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [customerParam, open, router]);

  // Polling pesan baru pada utas yang terbuka.
  useEffect(() => {
    if (!activeId || threadLoading) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await api<ThreadResponse>(`/admin/chats/${activeId}?after=${lastId.current}`);
        merge(res.messages);
        if (res.messages.some((m) => m.role === 'customer')) void markRead(activeId);
      } catch {
        // Jaringan putus sesaat: coba lagi pada putaran berikutnya.
      }
    };
    const timer = window.setInterval(tick, THREAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeId, threadLoading, merge, markRead]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!activeId || !oldest || threadLoading) return;
    try {
      const res = await api<ThreadResponse>(`/admin/chats/${activeId}?before=${oldest.id}`);
      merge(res.messages, true);
      setHasMore(res.hasMore);
    } catch (err) {
      setThreadError(errorMessage(err));
    }
  }

  async function send() {
    const body = draft.trim();
    if (!activeId || !body || sending) return;
    setSending(true);
    setThreadError('');
    try {
      const res = await api<{ conversation: AdminChatConversation; message: ChatMessage }>(`/admin/chats/${activeId}/messages`, { method: 'POST', body: { body } });
      merge([res.message]);
      setDraft('');
      setActive(res.conversation);
      void loadList();
    } catch (err) {
      setThreadError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const customer = active?.customer;
  const guest = active?.guest;
  // Nama pihak lawan: perusahaan/nama akun, atau nama yang diisi tamu; akun yang sudah dihapus = "Customer dihapus".
  const partyName = (c: AdminChatConversation) =>
    c.kind === 'guest' ? c.guest?.name || t('Tamu', 'Guest') : c.customer?.company || c.customer?.name || t('Customer dihapus', 'Deleted customer');

  return (
    <div>
      <AdminPageHead
        title="Live Chat"
        desc={t('Percakapan dengan customer dari portal. Balasan Anda langsung muncul di widget chat customer.', 'Conversations with customers from the portal. Your replies show up in the customer chat widget right away.')}
      />

      <div className={`${styles.inbox} ${active ? styles.hasActive : ''}`}>
        <aside className={styles.list} aria-label={t('Daftar percakapan', 'Conversation list')}>
          <div className={styles.listTools}>
            <label className={styles.search}>
              <Icon name="search" size={17} />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari nama, perusahaan, email', 'Search name, company, email')} aria-label={t('Cari percakapan', 'Search conversations')} />
            </label>
            <label className={styles.unreadToggle}>
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
              <span>{t('Belum dibaca saja', 'Unread only')}</span>
            </label>
          </div>

          {listError && <p className="form-error">{listError}</p>}

          <div className={styles.rows}>
            {conversations.length === 0 && (
              <p className={styles.listEmpty}>
                {listLoading
                  ? t('Memuat percakapan…', 'Loading conversations…')
                  : q || unreadOnly
                    ? t('Tidak ada percakapan yang cocok.', 'No matching conversations.')
                    : t('Belum ada percakapan. Pesan dari customer akan muncul di sini.', 'No conversations yet. Customer messages will show up here.')}
              </p>
            )}
            {conversations.map((conversation) => {
              const name = partyName(conversation);
              const selected = conversation.id === activeId;
              return (
                <button key={conversation.id} type="button" className={`${styles.row} ${selected ? styles.rowOn : ''} ${conversation.unread > 0 ? styles.rowUnread : ''}`} onClick={() => void open(conversation)} aria-current={selected}>
                  <span className={styles.avatar}>{name.slice(0, 2).toUpperCase()}</span>
                  <span className={styles.rowBody}>
                    <span className={styles.rowTop}>
                      <strong>
                        {name}
                        {conversation.kind === 'guest' && <em className={styles.guestTag}>{t('Tamu', 'Guest')}</em>}
                      </strong>
                      <small>{timeAgo(conversation.lastMessageAt, lang)}</small>
                    </span>
                    <span className={styles.rowPreview}>
                      {conversation.lastSenderRole === 'admin' ? `${t('Anda', 'You')}: ` : ''}
                      {conversation.lastMessagePreview || '—'}
                    </span>
                  </span>
                  {conversation.unread > 0 && <em className={styles.rowBadge}>{conversation.unread > 99 ? '99+' : conversation.unread}</em>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className={styles.thread} aria-label={t('Utas percakapan', 'Conversation thread')}>
          {!active ? (
            <div className={styles.placeholder}>
              <Icon name="chat" size={40} strokeWidth={1.2} />
              <p>{t('Pilih percakapan di kiri untuk membaca dan membalas.', 'Pick a conversation on the left to read and reply.')}</p>
            </div>
          ) : (
            <>
              <header className={styles.threadHead}>
                <button type="button" className={styles.backBtn} onClick={() => setActive(null)} aria-label={t('Kembali ke daftar', 'Back to list')}>
                  <Icon name="chevronLeft" size={18} />
                </button>
                <div className={styles.threadWho}>
                  <strong>
                    {partyName(active)}
                    {active.kind === 'guest' && <em className={styles.guestTag}>{t('Tamu', 'Guest')}</em>}
                  </strong>
                  <small>
                    {active.kind === 'guest'
                      ? [guest?.email, guest?.phone, t('belum login', 'not logged in')].filter(Boolean).join(' · ')
                      : `${customer?.company ? `${customer.name} · ` : ''}${customer?.email ?? ''}`}
                  </small>
                </div>
                {customer && (
                  <div className={styles.threadLinks}>
                    <Link href={`/admin/customers?q=${encodeURIComponent(customer.email)}`} className="btn btn-line btn-sm">
                      {t('Profil', 'Profile')}
                    </Link>
                    <Link href={`/admin/orders?q=${encodeURIComponent(customer.email)}`} className="btn btn-line btn-sm">
                      {t('Order', 'Orders')}
                    </Link>
                  </div>
                )}
              </header>

              <ChatThread
                messages={messages}
                viewer="admin"
                lang={lang}
                productHref={(slug) => `/catalog/${encodeURIComponent(slug)}`}
                orderHref={(number) => `/admin/orders/${encodeURIComponent(number)}`}
                loading={threadLoading}
                hasMore={hasMore}
                onLoadOlder={() => void loadOlder()}
                otherName={active.kind === 'guest' ? guest?.name || 'Tamu' : customer?.name || 'Customer'}
                emptyText={t('Belum ada pesan. Tulis pesan pertama untuk customer ini.', 'No messages yet. Write the first message to this customer.')}
              />

              {threadError && <p className={styles.threadError}>{threadError}</p>}

              <ChatComposer value={draft} onChange={setDraft} onSend={() => void send()} sending={sending} lang={lang} placeholder={t('Tulis balasan… (Enter untuk kirim)', 'Write a reply… (Enter to send)')} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
