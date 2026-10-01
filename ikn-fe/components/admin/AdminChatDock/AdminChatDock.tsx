'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { ChatComposer, ChatThread } from '@/components/chat';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, type Envelope } from '@/lib/api';
import { queryString, refreshAdminBadges, type AdminChatConversation } from '@/lib/admin';
import { timeAgo } from '@/lib/shop';
import type { ChatMessage, Lang } from '@/lib/types';
import styles from './AdminChatDock.module.css';

const LIST_POLL_MS = 15000;
const THREAD_POLL_MS = 4000;
const MAX_WINDOWS = 2;
const STORAGE_KEY = 'ikn-admin-chat-dock';
const PHONE_QUERY = '(max-width: 640px)';
const NARROW_QUERY = '(max-width: 1100px)';

interface ThreadResponse {
  conversation: AdminChatConversation;
  messages: ChatMessage[];
  hasMore: boolean;
}

interface DockWindow {
  id: number;
  minimized: boolean;
}

interface DockState {
  expanded: boolean;
  windows: DockWindow[];
}

type Translate = (id: string, en: string) => string;

function readStored(): DockState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DockState>;
    const windows = Array.isArray(parsed.windows)
      ? parsed.windows
          .filter((w, i, all): w is DockWindow => !!w && Number.isInteger(w.id) && w.id > 0 && all.findIndex((x) => x?.id === w.id) === i)
          .map((w) => ({ id: w.id, minimized: !!w.minimized }))
      : [];
    return { expanded: !!parsed.expanded, windows: windows.slice(-MAX_WINDOWS) };
  } catch {
    return null;
  }
}

function writeStored(state: DockState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked (private mode): the dock simply starts collapsed next time.
  }
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || '?'
  );
}

function partyName(c: AdminChatConversation, t: Translate): string {
  return c.kind === 'guest' ? c.guest?.name || t('Tamu', 'Guest') : c.customer?.company || c.customer?.name || t('Customer dihapus', 'Deleted customer');
}

function partyStatus(c: AdminChatConversation, t: Translate): string {
  if (c.kind === 'guest') return [c.guest?.email, t('Tamu, belum login', 'Guest, not logged in')].filter(Boolean).join(' · ');
  if (!c.customer) return t('Akun tidak tersedia', 'Account unavailable');
  return c.customer.company ? `${c.customer.name} · ${c.customer.email}` : c.customer.email;
}

function fullPageHref(c: AdminChatConversation | null): string {
  return c?.kind === 'customer' && c.customer ? `/admin/chat?customer=${c.customer.id}` : '/admin/chat';
}

function countLabel(n: number): string {
  return n > 99 ? '99+' : String(n);
}

// One open conversation: initial load, `?after=` polling while active, older pages, sending, read receipts.
function useAdminThread(id: number | null, active: boolean, onRead: (id: number) => void, onSent: () => void) {
  const [conversation, setConversation] = useState<AdminChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const lastId = useRef(0);
  const unreadRef = useRef(0);
  const activeRef = useRef(active);
  activeRef.current = active;

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
    async (conversationId: number) => {
      try {
        await api(`/admin/chats/${conversationId}/read`, { method: 'POST' });
        unreadRef.current = 0;
        setConversation((c) => (c ? { ...c, unread: 0 } : c));
        onRead(conversationId);
        refreshAdminBadges();
      } catch {
        // Counters resync on the next poll.
      }
    },
    [onRead],
  );

  // Initial load whenever the conversation changes.
  useEffect(() => {
    setConversation(null);
    setMessages([]);
    setHasMore(false);
    setDraft('');
    setError('');
    lastId.current = 0;
    unreadRef.current = 0;
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    api<ThreadResponse>(`/admin/chats/${id}`)
      .then((res) => {
        if (cancelled) return;
        setConversation(res.conversation);
        merge(res.messages);
        setHasMore(res.hasMore);
        unreadRef.current = res.conversation.unread;
        if (res.conversation.unread > 0 && activeRef.current) void markRead(id);
      })
      .catch((err) => {
        if (!cancelled) setError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, merge, markRead]);

  // Re-activated (un-minimized) with unread messages: mark them read.
  useEffect(() => {
    if (id && active && !loading && unreadRef.current > 0) void markRead(id);
  }, [id, active, loading, markRead]);

  // Poll for new messages only while the window is visible and the conversation loaded (a 404 stops polling).
  const loaded = conversation !== null;
  useEffect(() => {
    if (!id || !active || loading || !loaded) return;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const res = await api<ThreadResponse>(`/admin/chats/${id}?after=${lastId.current}`);
        merge(res.messages);
        if (res.messages.some((m) => m.role === 'customer')) void markRead(id);
      } catch {
        // Transient network failure: retry next tick.
      }
    };
    const timer = window.setInterval(tick, THREAD_POLL_MS);
    return () => window.clearInterval(timer);
  }, [id, active, loading, loaded, merge, markRead]);

  const loadOlder = useCallback(async () => {
    const oldest = messages[0];
    if (!id || !oldest || loading) return;
    try {
      const res = await api<ThreadResponse>(`/admin/chats/${id}?before=${oldest.id}`);
      merge(res.messages, true);
      setHasMore(res.hasMore);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id, messages, loading, merge]);

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!id || !body || sending) return;
    setSending(true);
    setError('');
    try {
      const res = await api<{ conversation: AdminChatConversation; message: ChatMessage }>(`/admin/chats/${id}/messages`, { method: 'POST', body: { body } });
      merge([res.message]);
      setDraft('');
      setConversation(res.conversation);
      onSent();
      refreshAdminBadges();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }, [id, draft, sending, merge, onSent]);

  return { conversation, messages, hasMore, loading, error, draft, setDraft, sending, send, loadOlder };
}

interface ThreadBodyProps {
  thread: ReturnType<typeof useAdminThread>;
  lang: Lang;
  t: Translate;
}

function ThreadBody({ thread, lang, t }: ThreadBodyProps) {
  const c = thread.conversation;
  const other = c ? (c.kind === 'guest' ? c.guest?.name || t('Tamu', 'Guest') : c.customer?.name || 'Customer') : '';
  return (
    <>
      <ChatThread
        messages={thread.messages}
        viewer="admin"
        lang={lang}
        productHref={(slug) => `/catalog/${encodeURIComponent(slug)}`}
        orderHref={(number) => `/admin/orders/${encodeURIComponent(number)}`}
        loading={thread.loading}
        hasMore={thread.hasMore}
        onLoadOlder={() => void thread.loadOlder()}
        otherName={other}
        emptyText={thread.error ? '' : t('Belum ada pesan. Tulis pesan pertama.', 'No messages yet. Write the first message.')}
      />
      {thread.error && <p className={styles.error}>{thread.error}</p>}
      <ChatComposer
        value={thread.draft}
        onChange={thread.setDraft}
        onSend={() => void thread.send()}
        sending={thread.sending}
        disabled={!c}
        lang={lang}
        placeholder={t('Tulis balasan…', 'Write a reply…')}
      />
    </>
  );
}

interface ConversationListProps {
  conversations: AdminChatConversation[];
  loading: boolean;
  error: string;
  query: string;
  activeIds: number[];
  lang: Lang;
  t: Translate;
  onOpen: (c: AdminChatConversation) => void;
}

function ConversationList({ conversations, loading, error, query, activeIds, lang, t, onOpen }: ConversationListProps) {
  return (
    <div className={styles.rows}>
      {error && <p className={styles.error}>{error}</p>}
      {conversations.length === 0 && !error && (
        <p className={styles.empty}>
          {loading
            ? t('Memuat percakapan…', 'Loading conversations…')
            : query
              ? t('Tidak ada percakapan yang cocok.', 'No matching conversations.')
              : t('Belum ada percakapan.', 'No conversations yet.')}
        </p>
      )}
      {conversations.map((c) => {
        const name = partyName(c, t);
        const unread = c.unread > 0;
        return (
          <button
            key={c.id}
            type="button"
            className={`${styles.row} ${unread ? styles.rowUnread : ''} ${activeIds.includes(c.id) ? styles.rowOn : ''}`}
            onClick={() => onOpen(c)}
          >
            <span className={`${styles.avatar} ${c.kind === 'guest' ? styles.avatarGuest : ''}`} aria-hidden="true">
              {initialsOf(name)}
            </span>
            <span className={styles.rowBody}>
              <span className={styles.rowTop}>
                <strong className={styles.rowName}>{name}</strong>
                {c.kind === 'guest' && <em className={styles.guestTag}>{t('Tamu', 'Guest')}</em>}
                <small className={styles.rowTime}>{timeAgo(c.lastMessageAt, lang)}</small>
              </span>
              <span className={styles.rowBottom}>
                <span className={styles.rowPreview}>
                  {c.lastSenderRole === 'admin' ? `${t('Anda', 'You')}: ` : ''}
                  {c.lastMessagePreview || '—'}
                </span>
                {unread && (
                  <em className={styles.count} aria-label={`${c.unread} ${t('belum dibaca', 'unread')}`}>
                    {countLabel(c.unread)}
                  </em>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ChatWindowProps {
  win: DockWindow;
  summary: AdminChatConversation | undefined;
  lang: Lang;
  t: Translate;
  onToggle: () => void;
  onClose: () => void;
  onRead: (id: number) => void;
  onSent: () => void;
}

// Docked chat window to the left of the conversation panel.
function ChatWindow({ win, summary, lang, t, onToggle, onClose, onRead, onSent }: ChatWindowProps) {
  const thread = useAdminThread(win.id, !win.minimized, onRead, onSent);
  const c = thread.conversation ?? summary ?? null;
  const name = c ? partyName(c, t) : thread.error ? t('Percakapan tidak tersedia', 'Conversation unavailable') : t('Memuat…', 'Loading…');
  const unread = win.minimized ? summary?.unread ?? 0 : 0;

  return (
    <section className={`${styles.window} ${win.minimized ? styles.windowMin : ''}`} aria-label={name}>
      <header className={styles.winHead}>
        <button type="button" className={styles.winTitle} onClick={onToggle} aria-expanded={!win.minimized}>
          <span className={`${styles.avatar} ${styles.avatarSm} ${c?.kind === 'guest' || !c ? styles.avatarGuest : ''}`} aria-hidden="true">
            {c ? initialsOf(name) : <Icon name="chat" size={16} />}
          </span>
          <span className={styles.winWho}>
            <strong>
              {name}
              {c?.kind === 'guest' && <em className={styles.guestTag}>{t('Tamu', 'Guest')}</em>}
            </strong>
            {!win.minimized && c && <small>{partyStatus(c, t)}</small>}
          </span>
          {unread > 0 && <em className={styles.count}>{countLabel(unread)}</em>}
        </button>
        <span className={styles.winActions}>
          <Link href={fullPageHref(c)} className={styles.iconBtn} title={t('Buka halaman penuh', 'Open full page')} aria-label={t('Buka halaman penuh', 'Open full page')}>
            <Icon name="expand" size={16} />
          </Link>
          <button type="button" className={styles.iconBtn} onClick={onToggle} title={win.minimized ? t('Perbesar', 'Expand') : t('Perkecil', 'Minimize')} aria-label={win.minimized ? t('Perbesar', 'Expand') : t('Perkecil', 'Minimize')}>
            <Icon name="minus" size={16} />
          </button>
          <button type="button" className={styles.iconBtn} onClick={onClose} title={t('Tutup', 'Close')} aria-label={t('Tutup percakapan', 'Close conversation')}>
            <Icon name="close" size={16} />
          </button>
        </span>
      </header>
      {!win.minimized && (
        <div className={styles.winBody}>
          <ThreadBody thread={thread} lang={lang} t={t} />
        </div>
      )}
    </section>
  );
}

// Full-screen thread inside the phone sheet.
function SheetThread({ id, summary, lang, t, onBack, onClose, onRead, onSent }: { id: number; summary: AdminChatConversation | undefined; lang: Lang; t: Translate; onBack: () => void; onClose: () => void; onRead: (id: number) => void; onSent: () => void }) {
  const thread = useAdminThread(id, true, onRead, onSent);
  const c = thread.conversation ?? summary ?? null;
  const name = c ? partyName(c, t) : thread.error ? t('Percakapan tidak tersedia', 'Conversation unavailable') : t('Memuat…', 'Loading…');
  return (
    <>
      <header className={styles.sheetHead}>
        <button type="button" className={styles.iconBtn} onClick={onBack} aria-label={t('Kembali ke daftar', 'Back to list')}>
          <Icon name="chevronLeft" size={20} />
        </button>
        <span className={styles.winWho}>
          <strong>
            {name}
            {c?.kind === 'guest' && <em className={styles.guestTag}>{t('Tamu', 'Guest')}</em>}
          </strong>
          {c && <small>{partyStatus(c, t)}</small>}
        </span>
        <Link href={fullPageHref(c)} className={styles.iconBtn} aria-label={t('Buka halaman penuh', 'Open full page')} onClick={onClose}>
          <Icon name="expand" size={18} />
        </Link>
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label={t('Tutup', 'Close')}>
          <Icon name="close" size={18} />
        </button>
      </header>
      <div className={styles.sheetBody}>
        <ThreadBody thread={thread} lang={lang} t={t} />
      </div>
    </>
  );
}

interface AdminChatDockProps {
  /** Unread conversation count from GET /admin/badges (same number as the sidebar badge). */
  unread: number;
  adminName: string;
}

// LinkedIn-style messaging dock for the admin panel (live chat, A-73): a collapsible conversation panel docked
// bottom-right plus up to two chat windows beside it. On phones it becomes a round button opening a full-screen sheet.
export default function AdminChatDock({ unread, adminName }: AdminChatDockProps) {
  const { lang } = useLang();
  const t: Translate = useCallback((id, en) => (lang === 'en' ? en : id), [lang]);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const isNarrow = useMediaQuery(NARROW_QUERY);

  // AdminShell only mounts the dock client-side (after the session loads), so localStorage is safe to read here.
  const [state, setState] = useState<DockState>(() => (typeof window === 'undefined' ? null : readStored()) ?? { expanded: false, windows: [] });
  const [conversations, setConversations] = useState<AdminChatConversation[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const unreadSignature = useRef<string | null>(null);

  useEffect(() => {
    writeStored(state);
  }, [state]);

  useEffect(() => {
    const timer = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadList = useCallback(async () => {
    try {
      const res = await api<Envelope<AdminChatConversation[]>>(`/admin/chats${queryString({ q, perPage: 30 })}`, { raw: true });
      const rows = res.data || [];
      setConversations(rows);
      setListError('');
      // Unread counts changed (new customer message or read elsewhere): resync the sidebar/dock badge.
      if (!q) {
        const signature = rows
          .filter((c) => c.unread > 0)
          .map((c) => `${c.id}:${c.unread}`)
          .join(',');
        if (unreadSignature.current !== null && signature !== unreadSignature.current) refreshAdminBadges();
        unreadSignature.current = signature;
      }
    } catch (err) {
      setListError(errorMessage(err));
    } finally {
      setListLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void loadList();
    const timer = window.setInterval(() => {
      if (!document.hidden) void loadList();
    }, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadList]);

  // The sidebar badge changed (refreshAdminBadges() anywhere, 30 s shell poll): refresh the list too.
  const lastUnread = useRef(unread);
  useEffect(() => {
    if (lastUnread.current !== unread) {
      lastUnread.current = unread;
      void loadList();
    }
  }, [unread, loadList]);

  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) void loadList();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [loadList]);

  const onRead = useCallback((id: number) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)));
  }, []);

  const onSent = useCallback(() => {
    void loadList();
  }, [loadList]);

  const openConversation = useCallback(
    (c: AdminChatConversation) => {
      if (isPhone) {
        setSheetId(c.id);
        return;
      }
      setState((s) => {
        if (s.windows.some((w) => w.id === c.id)) {
          return { ...s, windows: s.windows.map((w) => (w.id === c.id ? { ...w, minimized: false } : w)) };
        }
        return { ...s, windows: [...s.windows, { id: c.id, minimized: false }].slice(-MAX_WINDOWS) };
      });
    },
    [isPhone],
  );

  const toggleWindow = (id: number) => setState((s) => ({ ...s, windows: s.windows.map((w) => (w.id === id ? { ...w, minimized: !w.minimized } : w)) }));
  const closeWindow = (id: number) => setState((s) => ({ ...s, windows: s.windows.filter((w) => w.id !== id) }));

  // Phone sheet: Escape closes it, the page behind does not scroll.
  useEffect(() => {
    if (!isPhone || !sheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isPhone, sheetOpen]);

  const byId = (id: number) => conversations.find((c) => c.id === id);
  const badge = unread > 0 ? countLabel(unread) : null;
  const title = t('Pesan', 'Messaging');

  if (isPhone) {
    return (
      <>
        {!sheetOpen && (
          <button type="button" className={styles.fab} onClick={() => setSheetOpen(true)} aria-label={badge ? `${title}, ${unread} ${t('percakapan belum dibaca', 'unread conversations')}` : title}>
            <Icon name="chat" size={24} />
            {badge && <em className={styles.fabBadge}>{badge}</em>}
          </button>
        )}
        {sheetOpen && (
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
            {sheetId ? (
              <SheetThread
                id={sheetId}
                summary={byId(sheetId)}
                lang={lang}
                t={t}
                onBack={() => setSheetId(null)}
                onClose={() => setSheetOpen(false)}
                onRead={onRead}
                onSent={onSent}
              />
            ) : (
              <>
                <header className={styles.sheetHead}>
                  <span className={`${styles.avatar} ${styles.avatarSm} ${styles.avatarMe}`} aria-hidden="true">
                    {initialsOf(adminName)}
                  </span>
                  <strong className={styles.barTitle}>{title}</strong>
                  {badge && <em className={styles.count}>{badge}</em>}
                  <button type="button" className={styles.iconBtn} onClick={() => setSheetOpen(false)} aria-label={t('Tutup', 'Close')}>
                    <Icon name="close" size={18} />
                  </button>
                </header>
                <SearchBox value={search} onChange={setSearch} t={t} />
                <ConversationList conversations={conversations} loading={listLoading} error={listError} query={q} activeIds={[]} lang={lang} t={t} onOpen={openConversation} />
              </>
            )}
          </div>
        )}
      </>
    );
  }

  // Narrow desktops fit only the newest window beside the panel.
  const visibleWindows = state.windows.slice(isNarrow ? -1 : -MAX_WINDOWS);

  return (
    <div className={styles.dock}>
      <section className={`${styles.panel} ${state.expanded ? styles.panelOpen : ''}`} aria-label={title}>
        <button type="button" className={styles.bar} onClick={() => setState((s) => ({ ...s, expanded: !s.expanded }))} aria-expanded={state.expanded}>
          <span className={styles.meWrap}>
            <span className={`${styles.avatar} ${styles.avatarSm} ${styles.avatarMe}`} aria-hidden="true">
              {initialsOf(adminName)}
            </span>
            <span className={styles.onlineDot} aria-hidden="true" />
          </span>
          <strong className={styles.barTitle}>{title}</strong>
          {badge && (
            <em className={styles.count} aria-label={`${unread} ${t('percakapan belum dibaca', 'unread conversations')}`}>
              {badge}
            </em>
          )}
          <span className={styles.chevron} aria-hidden="true">
            <Icon name="chevronRight" size={18} />
          </span>
        </button>
        {state.expanded && (
          <div className={styles.panelBody}>
            <SearchBox value={search} onChange={setSearch} t={t} />
            <ConversationList
              conversations={conversations}
              loading={listLoading}
              error={listError}
              query={q}
              activeIds={visibleWindows.map((w) => w.id)}
              lang={lang}
              t={t}
              onOpen={openConversation}
            />
            <Link href="/admin/chat" className={styles.panelFoot}>
              {t('Buka kotak masuk lengkap', 'Open full inbox')}
            </Link>
          </div>
        )}
      </section>
      {visibleWindows
        .slice()
        .reverse()
        .map((win) => (
          <ChatWindow
            key={win.id}
            win={win}
            summary={byId(win.id)}
            lang={lang}
            t={t}
            onToggle={() => toggleWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onRead={onRead}
            onSent={onSent}
          />
        ))}
    </div>
  );
}

function SearchBox({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: Translate }) {
  return (
    <label className={styles.search}>
      <Icon name="search" size={16} />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('Cari nama atau perusahaan', 'Search name or company')} aria-label={t('Cari percakapan', 'Search conversations')} />
    </label>
  );
}
