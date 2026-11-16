'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { confirmDialog } from '@/components/ConfirmDialog';
import { ApiError, errorMessage } from '@/lib/api';
import type { ChatMessage, ChatThreadPage, Lang } from '@/lib/types';

// Logika bersama keempat permukaan live chat (widget customer, widget tamu, halaman chat admin, dock admin):
// daftar pesan per halaman + sinkron perubahan (ASUMSI A-99), dan alur edit/tarik pesan sendiri.

/**
 * Tenggat edit/tarik dihitung dari saat respons diterima + sisa detik dari server (`editableSeconds`),
 * jadi tidak bergantung pada jam browser yang bisa meleset dari jam server.
 */
export function stampMessage(message: ChatMessage, receivedAt = Date.now()): ChatMessage {
  const seconds = message.retracted ? 0 : message.editableSeconds ?? 0;
  return { ...message, editableUntil: seconds > 0 ? receivedAt + seconds * 1000 : 0 };
}

/** initial = halaman terbaru saat utas dibuka, poll = `?after=&rev=`, older = halaman `?before=`. */
export type ChatPageMode = 'initial' | 'poll' | 'older';

type PageWithRevision = ChatThreadPage & { conversation?: { revision?: number } | null };

/**
 * Daftar pesan satu utas. Sumber kebenarannya `list` (ref) agar polling, kirim, dan muat-halaman-lama yang
 * selesai berdekatan tidak saling menimpa; `messages` adalah salinannya untuk dirender.
 */
export function useChatMessages() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [editWindow, setEditWindow] = useState(0);
  const list = useRef<ChatMessage[]>([]);
  const lastId = useRef(0);
  const revision = useRef(0);
  const hasMoreRef = useRef(false);
  const olderBusy = useRef(false);
  const generation = useRef(0);

  /** Kosongkan utas (ganti percakapan / sesi). Respons yang masih di jalan untuk utas lama diabaikan lewat token. */
  const reset = useCallback(() => {
    generation.current += 1;
    list.current = [];
    lastId.current = 0;
    revision.current = 0;
    hasMoreRef.current = false;
    olderBusy.current = false;
    setMessages([]);
    setHasMore(false);
    setLoadingOlder(false);
  }, []);

  /** Token utas saat ini: ambil sebelum request, berikan ke applyPage agar respons basi tidak masuk utas lain. */
  const token = useCallback(() => generation.current, []);

  /** Gabungkan pesan ke daftar (urut id); pesan dengan id yang sama ditimpa keadaan terbarunya. */
  const upsert = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    const receivedAt = Date.now();
    const byId = new Map<number, ChatMessage>();
    for (const message of list.current) byId.set(message.id, message);
    for (const message of incoming) byId.set(message.id, stampMessage(message, receivedAt));
    const next = Array.from(byId.values()).sort((a, b) => a.id - b.id);
    list.current = next;
    lastId.current = Math.max(lastId.current, next[next.length - 1]?.id ?? 0);
    setMessages(next);
  }, []);

  /**
   * Terapkan respons GET utas. Mengembalikan false bila respons itu milik utas yang sudah diganti.
   * Revisi hanya diambil dari muatan awal dan polling (yang membawa `changed`), bukan dari halaman lama atau
   * respons kirim/edit, supaya perubahan pihak lawan di antaranya tidak terlewat.
   */
  const applyPage = useCallback(
    (page: PageWithRevision, mode: ChatPageMode, forToken?: number): boolean => {
      if (forToken !== undefined && forToken !== generation.current) return false;
      if (typeof page.editWindowSeconds === 'number') setEditWindow(page.editWindowSeconds);

      let incoming = page.messages || [];
      if (mode === 'poll' && page.changed && page.changed.length > 0) {
        // Perubahan dipakai untuk pesan dalam rentang yang sudah dimuat; pesan yang lebih lama dari itu akan
        // datang dalam keadaan terbarunya saat halamannya dimuat.
        const oldest = list.current[0]?.id ?? 0;
        const known = new Set(list.current.map((m) => m.id));
        const relevant = page.changed.filter((m) => known.has(m.id) || !hasMoreRef.current || (oldest > 0 && m.id > oldest));
        incoming = [...relevant, ...incoming];
      }
      upsert(incoming);

      if (mode !== 'poll') {
        hasMoreRef.current = !!page.hasMore;
        setHasMore(!!page.hasMore);
      }
      if (mode !== 'older') {
        const next = page.conversation?.revision;
        if (typeof next === 'number' && next > revision.current) revision.current = next;
      }
      return true;
    },
    [upsert],
  );

  /** Query polling: pesan baru setelah id terakhir + perubahan sejak revisi terakhir yang diketahui. */
  const pollQuery = useCallback(() => `after=${lastId.current}&rev=${revision.current}`, []);

  /**
   * Muat satu halaman lebih lama dari pesan teratas. Aman dipanggil berulang (saat menggulir): panggilan kedua
   * diabaikan selama yang pertama belum selesai, dan berhenti sendiri bila tidak ada lagi yang lebih lama.
   * Galat dilempar ke pemanggil untuk ditampilkan.
   */
  const loadOlder = useCallback(
    async (fetchPage: (beforeId: number) => Promise<ChatThreadPage>): Promise<void> => {
      const oldest = list.current[0];
      if (!oldest || olderBusy.current || !hasMoreRef.current) return;
      const forToken = generation.current;
      olderBusy.current = true;
      setLoadingOlder(true);
      try {
        const page = await fetchPage(oldest.id);
        applyPage(page, 'older', forToken);
      } finally {
        if (forToken === generation.current) {
          olderBusy.current = false;
          setLoadingOlder(false);
        }
      }
    },
    [applyPage],
  );

  return { messages, hasMore, loadingOlder, editWindow, reset, token, upsert, applyPage, pollQuery, loadOlder };
}

export type ChatMessages = ReturnType<typeof useChatMessages>;

interface ChatEditingOptions {
  lang: Lang;
  draft: string;
  setDraft: (value: string) => void;
  /** PUT edit: mengembalikan pesan hasil edit. */
  editRequest: (message: ChatMessage, body: string) => Promise<ChatMessage>;
  /** POST retract: mengembalikan pesan yang sudah ditarik (tanpa isi). */
  retractRequest: (message: ChatMessage) => Promise<ChatMessage>;
  /** Pesan berubah (hasil edit/tarik, atau tombolnya harus disembunyikan): masukkan ke daftar. */
  onChanged: (message: ChatMessage) => void;
  /** Tampilkan pesan galat dari API ('' = bersihkan). */
  onError: (text: string) => void;
  /** Dipanggil setelah edit/tarik berhasil (mis. menyegarkan pratinjau daftar percakapan). */
  onDone?: () => void;
}

/**
 * Alur edit/tarik pesan sendiri (ASUMSI A-99). Mengedit memakai kotak tulis yang sama: draf yang sedang
 * ditulis disimpan dulu, lalu dikembalikan setelah edit selesai atau dibatalkan. Menarik meminta konfirmasi.
 * Server yang memutuskan batas waktu; 409 dari server ditampilkan apa adanya dan tombolnya disembunyikan.
 */
export function useChatEditing(options: ChatEditingOptions) {
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [busy, setBusy] = useState(false);
  const stash = useRef('');
  const latest = useRef(options);
  latest.current = options;
  const editingRef = useRef<ChatMessage | null>(null);
  editingRef.current = editing;
  const busyRef = useRef(false);

  const leaveEdit = useCallback(() => {
    setEditing(null);
    latest.current.setDraft(stash.current);
    stash.current = '';
  }, []);

  const startEdit = useCallback((message: ChatMessage) => {
    if (busyRef.current) return;
    if (!editingRef.current) stash.current = latest.current.draft;
    setEditing(message);
    latest.current.setDraft(message.body);
    latest.current.onError('');
  }, []);

  /** Ganti percakapan: buang keadaan edit tanpa menyentuh draf (pemanggil mengosongkannya sendiri). */
  const resetEditing = useCallback(() => {
    stash.current = '';
    setEditing(null);
  }, []);

  // Tombol disembunyikan setelah server menolak (jendela lewat menurut jam server, atau pesan sudah ditarik).
  const rejected = useCallback((message: ChatMessage, err: unknown) => {
    latest.current.onError(errorMessage(err));
    if (err instanceof ApiError && err.status === 409) latest.current.onChanged({ ...message, editableSeconds: 0 });
  }, []);

  const submitEdit = useCallback(async () => {
    const target = editingRef.current;
    const body = latest.current.draft.trim();
    if (!target || !body || busyRef.current) return;
    if (body === target.body) {
      leaveEdit();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    latest.current.onError('');
    try {
      latest.current.onChanged(await latest.current.editRequest(target, body));
      leaveEdit();
      latest.current.onDone?.();
    } catch (err) {
      rejected(target, err);
      if (err instanceof ApiError && err.status === 409) leaveEdit();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [leaveEdit, rejected]);

  const retract = useCallback(
    async (message: ChatMessage) => {
      if (busyRef.current) return;
      const en = latest.current.lang === 'en';
      const ok = await confirmDialog({
        title: en ? 'Retract this message?' : 'Tarik pesan ini?',
        message: en
          ? 'The message is replaced with "Message retracted" for you and the other side. This cannot be undone.'
          : 'Isi pesan diganti tulisan "Pesan ditarik" untuk Anda dan lawan bicara. Tindakan ini tidak bisa dibatalkan.',
        confirmLabel: en ? 'Yes, retract' : 'Ya, tarik',
        cancelLabel: en ? 'Cancel' : 'Batal',
        tone: 'danger',
      });
      if (!ok || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      latest.current.onError('');
      try {
        latest.current.onChanged(await latest.current.retractRequest(message));
        if (editingRef.current?.id === message.id) leaveEdit();
        latest.current.onDone?.();
      } catch (err) {
        rejected(message, err);
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [leaveEdit, rejected],
  );

  return { editing, busy, startEdit, cancelEdit: leaveEdit, submitEdit, retract, resetEditing };
}

export type ChatEditing = ReturnType<typeof useChatEditing>;

/**
 * Memaksa render ulang tepat saat tenggat edit/tarik terdekat lewat, sehingga tombol Edit/Tarik hilang sendiri
 * tanpa memuat ulang. Pemanggil membandingkan `editableUntil` dengan Date.now() saat render.
 */
export function useEditDeadlineTick(messages: ChatMessage[]): void {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const now = Date.now();
    let next = 0;
    for (const message of messages) {
      const until = message.editableUntil ?? 0;
      if (until > now && (next === 0 || until < next)) next = until;
    }
    if (next === 0) return;
    const timer = window.setTimeout(() => setTick((n) => n + 1), next - now + 40);
    return () => window.clearTimeout(timer);
  }, [messages, tick]);
}
