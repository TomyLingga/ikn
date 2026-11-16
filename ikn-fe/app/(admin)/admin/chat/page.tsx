'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import Spinner from '@/components/Spinner';
import { confirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { ChatComposer, ChatThread, useChatEditing, useChatMessages } from '@/components/chat';
import { AdminPageHead } from '@/components/admin/AdminPage';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, type Envelope } from '@/lib/api';
import type { PagedMeta } from '@/lib/cms';
import { queryString, refreshAdminBadges, type AdminChatConversation } from '@/lib/admin';
import { timeAgo } from '@/lib/shop';
import type { ChatMessage, ChatThreadPage } from '@/lib/types';
import styles from './page.module.css';

const LIST_POLL_MS = 8000;
const THREAD_POLL_MS = 4000;
/** Percakapan per muatan daftar; bertambah saat "Muat lebih banyak" sampai batas perPage API. */
const LIST_STEP = 30;
const LIST_MAX = 100;

type View = 'inbox' | 'archive';

interface ThreadResponse extends ChatThreadPage {
  conversation: AdminChatConversation;
}

type ListMeta = PagedMeta & { unreadConversations?: number; archivedConversations?: number };

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
// ASUMSI A-99: utas dimuat per halaman (gulir ke atas untuk pesan lama), admin bisa mengedit/menarik pesannya
// sendiri selama batas waktu, dan percakapan hanya bisa diarsipkan (tab Arsip), tidak pernah dihapus.
function AdminChat() {
  const { lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [view, setView] = useState<View>('inbox');
  const [conversations, setConversations] = useState<AdminChatConversation[]>([]);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(LIST_STEP);
  const [total, setTotal] = useState(0);
  const [archivedCount, setArchivedCount] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [active, setActive] = useState<AdminChatConversation | null>(null);
  const { messages, hasMore, loadingOlder, editWindow, reset: resetMessages, token: threadToken, upsert, applyPage, pollQuery, loadOlder: loadOlderPage } = useChatMessages();
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const activeId = active?.id ?? null;
  const listRequest = useRef(0);

  const loadList = useCallback(async () => {
    const request = ++listRequest.current;
    try {
      const res = await api<Envelope<AdminChatConversation[]>>(
        `/admin/chats${queryString({ q, unread: unreadOnly ? 1 : '', archived: view === 'archive' ? 1 : '', perPage: limit })}`,
        { raw: true },
      );
      if (request !== listRequest.current) return; // filter berubah selagi request berjalan
      const meta = res.meta as ListMeta | undefined;
      setConversations(res.data || []);
      setTotal(meta?.total ?? (res.data || []).length);
      setArchivedCount(meta?.archivedConversations ?? 0);
      setListError('');
    } catch (err) {
      if (request === listRequest.current) setListError(errorMessage(err));
    } finally {
      if (request === listRequest.current) setListLoading(false);
    }
  }, [q, unreadOnly, view, limit]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  // Filter berubah: mulai lagi dari muatan pertama.
  useEffect(() => {
    setLimit(LIST_STEP);
  }, [q, unreadOnly, view]);

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadList();
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList]);

  const switchView = (next: View) => {
    if (next === view) return;
    setView(next);
    setConversations([]);
    setListLoading(true);
    if (next === 'archive') setUnreadOnly(false);
  };

  const markRead = useCallback(async (id: number) => {
    try {
      await api(`/admin/chats/${id}/read`, { method: 'POST' });
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
      refreshAdminBadges();
    } catch {
      // Penghitung akan sinkron pada polling berikutnya.
    }
  }, []);

  // Edit/tarik pesan milik admin ini sendiri: kotak tulis yang sama dipakai untuk mengedit; tarik meminta konfirmasi.
  const messagePath = (id: number) => `/admin/chats/${activeId}/messages/${id}`;
  const { editing, busy: editBusy, startEdit, cancelEdit, submitEdit, retract, resetEditing } = useChatEditing({
    lang,
    draft,
    setDraft,
    editRequest: async (message, body) => (await api<{ message: ChatMessage }>(messagePath(message.id), { method: 'PUT', body: { body } })).message,
    retractRequest: async (message) => (await api<{ message: ChatMessage }>(`${messagePath(message.id)}/retract`, { method: 'POST' })).message,
    onChanged: (message) => upsert([message]),
    onError: setThreadError,
    onDone: () => void loadList(),
  });

  const open = useCallback(
    async (conversation: AdminChatConversation) => {
      resetMessages();
      resetEditing();
      const forThread = threadToken();
      setActive(conversation);
      setDraft('');
      setThreadError('');
      setThreadLoading(true);
      try {
        const res = await api<ThreadResponse>(`/admin/chats/${conversation.id}`);
        if (!applyPage(res, 'initial', forThread)) return; // admin sudah membuka percakapan lain
        setActive(res.conversation);
        if (res.conversation.unread > 0) void markRead(conversation.id);
      } catch (err) {
        if (forThread === threadToken()) setThreadError(errorMessage(err));
      } finally {
        if (forThread === threadToken()) setThreadLoading(false);
      }
    },
    [resetMessages, resetEditing, threadToken, applyPage, markRead],
  );

  const close = () => {
    resetMessages();
    resetEditing();
    setActive(null);
    setDraft('');
    setThreadError('');
    setThreadLoading(false);
  };

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

  // Polling utas yang terbuka: `after` membawa pesan baru, `rev` membawa pesan lama yang diedit/ditarik customer.
  useEffect(() => {
    if (!activeId || threadLoading) return;
    const tick = async () => {
      if (document.hidden) return;
      const forThread = threadToken();
      try {
        const res = await api<ThreadResponse>(`/admin/chats/${activeId}?${pollQuery()}`);
        if (!applyPage(res, 'poll', forThread)) return;
        // Status arsip bisa berubah dari tempat lain (admin lain, atau pesan baru customer mengeluarkannya).
        setActive((current) => (current && current.id === res.conversation.id ? res.conversation : current));
        if (res.messages.some((m) => m.role === 'customer')) void markRead(activeId);
      } catch {
        // Jaringan putus sesaat: coba lagi pada putaran berikutnya.
      }
    };
    const timer = window.setInterval(tick, THREAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [activeId, threadLoading, threadToken, pollQuery, applyPage, markRead]);

  // Dipanggil ChatThread saat menggulir ke puncak (dan dari tombol cadangan): satu halaman lebih lama per panggilan.
  function loadOlder() {
    if (!activeId) return;
    loadOlderPage((before) => api<ThreadResponse>(`/admin/chats/${activeId}?before=${before}`)).catch((err) => setThreadError(errorMessage(err)));
  }

  async function send() {
    const body = draft.trim();
    if (!activeId || !body || sending) return;
    setSending(true);
    setThreadError('');
    try {
      const res = await api<{ conversation: AdminChatConversation; message: ChatMessage }>(`/admin/chats/${activeId}/messages`, { method: 'POST', body: { body } });
      upsert([res.message]);
      setDraft('');
      setActive(res.conversation);
      void loadList();
    } catch (err) {
      setThreadError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  // Arsip adalah satu-satunya cara menyingkirkan percakapan dari kotak masuk; tidak ada hapus.
  async function setArchived(conversation: AdminChatConversation, archived: boolean) {
    if (archiving) return;
    if (archived) {
      const ok = await confirmDialog({
        title: t('Arsipkan percakapan ini?', 'Archive this conversation?'),
        message: t(
          'Percakapan dipindahkan ke tab Arsip dan tidak lagi dihitung di lencana chat. Isinya tetap tersimpan, dan percakapan kembali ke kotak masuk bila customer mengirim pesan baru.',
          'The conversation moves to the Archive tab and no longer counts in the chat badge. Its messages are kept, and it returns to the inbox when the customer sends a new message.',
        ),
        confirmLabel: t('Ya, arsipkan', 'Yes, archive'),
        tone: 'primary',
      });
      if (!ok) return;
    }
    setArchiving(true);
    setThreadError('');
    try {
      const updated = await api<AdminChatConversation>(`/admin/chats/${conversation.id}/${archived ? 'archive' : 'unarchive'}`, { method: 'POST' });
      setActive((current) => (current && current.id === updated.id ? updated : current));
      toast({
        title: archived ? t('Percakapan diarsipkan', 'Conversation archived') : t('Percakapan dikembalikan ke kotak masuk', 'Conversation moved back to the inbox'),
        icon: 'chat',
        tone: 'success',
      });
      refreshAdminBadges();
      void loadList();
    } catch (err) {
      setThreadError(errorMessage(err));
    } finally {
      setArchiving(false);
    }
  }

  const customer = active?.customer;
  const guest = active?.guest;
  // Nama pihak lawan: perusahaan/nama akun, atau nama yang diisi tamu; akun yang sudah dihapus = "Customer dihapus".
  const partyName = (c: AdminChatConversation) =>
    c.kind === 'guest' ? c.guest?.name || t('Tamu', 'Guest') : c.customer?.company || c.customer?.name || t('Customer dihapus', 'Deleted customer');
  const previewOf = (c: AdminChatConversation) => (c.lastMessageRetracted ? t('Pesan ditarik', 'Message retracted') : c.lastMessagePreview || '—');
  const canLoadMore = conversations.length < total && limit < LIST_MAX;

  return (
    <div>
      <AdminPageHead
        title="Live Chat"
        desc={t(
          'Percakapan dengan customer dari portal. Balasan Anda langsung muncul di widget chat customer. Percakapan tidak bisa dihapus, hanya diarsipkan.',
          'Conversations with customers from the portal. Your replies show up in the customer chat widget right away. Conversations cannot be deleted, only archived.',
        )}
      />

      <div className={`${styles.inbox} ${active ? styles.hasActive : ''}`}>
        <aside className={styles.list} aria-label={t('Daftar percakapan', 'Conversation list')}>
          <div className={styles.listTools}>
            <div className={styles.viewTabs} role="tablist" aria-label={t('Kelompok percakapan', 'Conversation groups')}>
              <button type="button" role="tab" aria-selected={view === 'inbox'} className={`${styles.viewTab} ${view === 'inbox' ? styles.viewTabOn : ''}`} onClick={() => switchView('inbox')}>
                {t('Kotak masuk', 'Inbox')}
              </button>
              <button type="button" role="tab" aria-selected={view === 'archive'} className={`${styles.viewTab} ${view === 'archive' ? styles.viewTabOn : ''}`} onClick={() => switchView('archive')}>
                {t('Arsip', 'Archive')}
                {archivedCount > 0 && <em className={styles.viewCount}>{archivedCount > 99 ? '99+' : archivedCount}</em>}
              </button>
            </div>
            <label className={styles.search}>
              <Icon name="search" size={17} />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Cari nama, perusahaan, email', 'Search name, company, email')} aria-label={t('Cari percakapan', 'Search conversations')} />
            </label>
            {view === 'inbox' && (
              <label className={styles.unreadToggle}>
                <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                <span>{t('Belum dibaca saja', 'Unread only')}</span>
              </label>
            )}
          </div>

          {listError && <p className="form-error">{listError}</p>}

          <div className={styles.rows}>
            {conversations.length === 0 && (
              <p className={styles.listEmpty}>
                {listLoading ? (
                  <Spinner size={18} label={t('Memuat percakapan…', 'Loading conversations…')} />
                ) : q || unreadOnly ? (
                  t('Tidak ada percakapan yang cocok.', 'No matching conversations.')
                ) : view === 'archive' ? (
                  t('Arsip kosong. Percakapan yang Anda arsipkan muncul di sini.', 'The archive is empty. Conversations you archive show up here.')
                ) : (
                  t('Belum ada percakapan. Pesan dari customer akan muncul di sini.', 'No conversations yet. Customer messages will show up here.')
                )}
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
                    <span className={`${styles.rowPreview} ${conversation.lastMessageRetracted ? styles.rowPreviewMuted : ''}`}>
                      {conversation.lastSenderRole === 'admin' ? `${t('Anda', 'You')}: ` : ''}
                      {previewOf(conversation)}
                    </span>
                  </span>
                  {conversation.unread > 0 && <em className={styles.rowBadge}>{conversation.unread > 99 ? '99+' : conversation.unread}</em>}
                </button>
              );
            })}
            {conversations.length > 0 && canLoadMore && (
              <button type="button" className={styles.moreBtn} onClick={() => setLimit((n) => Math.min(LIST_MAX, n + LIST_STEP))}>
                {t('Muat lebih banyak', 'Load more')} ({conversations.length}/{total})
              </button>
            )}
            {conversations.length > 0 && !canLoadMore && conversations.length < total && (
              <p className={styles.listNote}>
                {t(
                  `Menampilkan ${conversations.length} percakapan terbaru dari ${total}. Pakai kolom cari untuk menemukan yang lain.`,
                  `Showing the ${conversations.length} most recent of ${total} conversations. Use search to find the others.`,
                )}
              </p>
            )}
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
                <button type="button" className={styles.backBtn} onClick={close} aria-label={t('Kembali ke daftar', 'Back to list')}>
                  <Icon name="chevronLeft" size={18} />
                </button>
                <div className={styles.threadWho}>
                  <strong>
                    {partyName(active)}
                    {active.kind === 'guest' && <em className={styles.guestTag}>{t('Tamu', 'Guest')}</em>}
                    {active.archived && <em className={styles.archivedTag}>{t('Arsip', 'Archived')}</em>}
                  </strong>
                  <small>
                    {active.kind === 'guest'
                      ? [guest?.email, guest?.phone, t('belum login', 'not logged in')].filter(Boolean).join(' · ')
                      : `${customer?.company ? `${customer.name} · ` : ''}${customer?.email ?? ''}`}
                  </small>
                </div>
                <div className={styles.threadLinks}>
                  {customer && (
                    <>
                      <Link href={`/admin/customers?q=${encodeURIComponent(customer.email)}`} className={`btn btn-line btn-sm ${styles.wideOnly}`}>
                        {t('Profil', 'Profile')}
                      </Link>
                      <Link href={`/admin/orders?q=${encodeURIComponent(customer.email)}`} className={`btn btn-line btn-sm ${styles.wideOnly}`}>
                        {t('Order', 'Orders')}
                      </Link>
                    </>
                  )}
                  <button type="button" className="btn btn-line btn-sm" onClick={() => void setArchived(active, !active.archived)} disabled={archiving}>
                    {active.archived ? t('Keluarkan dari arsip', 'Unarchive') : t('Arsipkan', 'Archive')}
                  </button>
                </div>
              </header>

              {active.archived && (
                <p className={styles.archivedNote}>
                  {active.archivedBy?.name
                    ? t(`Diarsipkan oleh ${active.archivedBy.name}. `, `Archived by ${active.archivedBy.name}. `)
                    : t('Percakapan ini diarsipkan. ', 'This conversation is archived. ')}
                  {t(
                    'Anda tetap bisa membalas; percakapan kembali ke kotak masuk saat customer mengirim pesan baru.',
                    'You can still reply; it returns to the inbox when the customer sends a new message.',
                  )}
                </p>
              )}

              <ChatThread
                messages={messages}
                viewer="admin"
                lang={lang}
                productHref={(slug) => `/catalog/${encodeURIComponent(slug)}`}
                orderHref={(number) => `/admin/orders/${encodeURIComponent(number)}`}
                loading={threadLoading}
                hasMore={hasMore}
                loadingOlder={loadingOlder}
                onLoadOlder={loadOlder}
                onEdit={startEdit}
                onRetract={(message) => void retract(message)}
                editingId={editing?.id ?? null}
                actionsDisabled={editBusy}
                editWindowSeconds={editWindow}
                otherName={active.kind === 'guest' ? guest?.name || 'Tamu' : customer?.name || 'Customer'}
                emptyText={t('Belum ada pesan. Tulis pesan pertama untuk customer ini.', 'No messages yet. Write the first message to this customer.')}
              />

              {threadError && (
                <p className={styles.threadError} role="alert">
                  {threadError}
                </p>
              )}

              <ChatComposer
                value={draft}
                onChange={setDraft}
                onSend={() => void (editing ? submitEdit() : send())}
                sending={sending || editBusy}
                lang={lang}
                placeholder={t('Tulis balasan… (Enter untuk kirim)', 'Write a reply… (Enter to send)')}
                editing={editing}
                onCancelEdit={cancelEdit}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
