'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ChatWidget from '@/components/customer/ChatWidget';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { api } from '@/lib/api';
import { tr } from '@/lib/cms';
import { CUSTOMER_BADGES_EVENT } from '@/lib/shop';
import { whatsappContacts } from '@/lib/whatsapp';
import type { CustomerBadges } from '@/lib/types';
import styles from './FloatingContacts.module.css';

const BADGE_POLL_MS = 30000;

interface FloatingContactsProps {
  /** Portal customer sudah memolling GET /customer/badges sendiri; kirim hasilnya di sini agar tidak dipolling dua kali. */
  chatUnread?: number;
}

// Dua tombol melayang di pojok kanan bawah (situs publik + portal customer): "Chat WhatsApp" ke tim marketing
// (nomor dari Pengaturan Situs, langsung membuka percakapan) dan "Live Chat Online" = widget chat dalam aplikasi.
export default function FloatingContacts({ chatUnread }: FloatingContactsProps) {
  const { lang } = useLang();
  const { settings } = useSite();
  const { customer, ready } = useAuth();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [open, setOpen] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [polledUnread, setPolledUnread] = useState(0);
  const [guestUnread, setGuestUnread] = useState(0);
  const waWrap = useRef<HTMLDivElement>(null);

  // Satu nomor = tautan langsung; lebih dari satu = daftar pilihan (nama tim + nomor) di atas tombol.
  const contacts = whatsappContacts(settings, tr(settings.contact?.whatsapp_message ?? { id: '', en: '' }, lang), t('Marketing', 'Marketing'));
  const single = contacts.length === 1 ? contacts[0] : null;

  useEffect(() => {
    if (!waOpen) return;
    const onDown = (event: MouseEvent) => {
      if (waWrap.current && !waWrap.current.contains(event.target as Node)) setWaOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWaOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [waOpen]);

  // Di luar portal (situs publik) lencana customer login dipolling di sini; di portal datang dari CustomerShell.
  const customerId = customer?.id;
  const loadBadges = useCallback(async () => {
    if (!customerId || chatUnread !== undefined) return;
    try {
      setPolledUnread((await api<CustomerBadges>('/customer/badges')).chat);
    } catch {
      // Lencana bukan fitur kritis.
    }
  }, [customerId, chatUnread]);

  useEffect(() => {
    void loadBadges();
    const refresh = () => {
      if (!document.hidden) void loadBadges();
    };
    const timer = window.setInterval(refresh, BADGE_POLL_MS);
    window.addEventListener(CUSTOMER_BADGES_EVENT, refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CUSTOMER_BADGES_EVENT, refresh);
    };
  }, [loadBadges]);

  const onClose = useCallback(() => setOpen(false), []);
  const onOpen = useCallback(() => setOpen(true), []);
  const unread = customer ? (chatUnread ?? polledUnread) : guestUnread;

  if (!ready) return null;

  return (
    <>
      <ChatWidget open={open} onClose={onClose} onOpen={onOpen} badgeUnread={customer ? (chatUnread ?? polledUnread) : 0} onGuestUnread={setGuestUnread} />

      <div className={styles.stack}>
        {contacts.length > 0 && (
          <div className={styles.waWrap} ref={waWrap}>
            {waOpen && contacts.length > 1 && (
              <div className={styles.waMenu} role="menu" aria-label={t('Pilih tim marketing', 'Choose a marketing team')}>
                <span className={styles.waMenuTitle}>{t('Pilih tim yang ingin dihubungi', 'Choose who to chat with')}</span>
                {contacts.map((contact) => (
                  <a key={contact.number} href={contact.href} target="_blank" rel="noopener noreferrer" role="menuitem" className={styles.waItem} onClick={() => setWaOpen(false)}>
                    <span className={styles.waItemIcon}>
                      <WaGlyph size={18} />
                    </span>
                    <span className={styles.waItemText}>
                      <strong>{contact.label}</strong>
                      <small>{contact.display}</small>
                    </span>
                    <Icon name="arrow" size={15} />
                  </a>
                ))}
              </div>
            )}
            {single ? (
              <a href={single.href} target="_blank" rel="noopener noreferrer" className={styles.pill}>
                <span className={styles.pillText}>
                  <small>{single.label}</small>
                  <strong>{t('Chat WhatsApp', 'Chat on WhatsApp')}</strong>
                </span>
                <span className={`${styles.pillIcon} ${styles.pillIconWa}`}>
                  <WaGlyph size={24} />
                </span>
              </a>
            ) : (
              <button type="button" className={`${styles.pill} ${waOpen ? styles.pillOn : ''}`} onClick={() => setWaOpen((value) => !value)} aria-expanded={waOpen} aria-haspopup="menu">
                <span className={styles.pillText}>
                  <small>{t('Marketing', 'Marketing')} · {contacts.length} {t('nomor', 'numbers')}</small>
                  <strong>{t('Chat WhatsApp', 'Chat on WhatsApp')}</strong>
                </span>
                <span className={`${styles.pillIcon} ${styles.pillIconWa}`}>
                  <WaGlyph size={24} />
                </span>
              </button>
            )}
          </div>
        )}
        <button type="button" className={`${styles.pill} ${open ? styles.pillOn : ''}`} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          <span className={styles.pillText}>
            <small>{t('Konsultasi produk', 'Product consultation')}</small>
            <strong>{open ? t('Tutup chat', 'Close chat') : t('Live Chat Online', 'Live Chat Online')}</strong>
          </span>
          <span className={`${styles.pillIcon} ${styles.pillIconChat}`}>
            <Icon name={open ? 'close' : 'chat'} size={22} />
            {!open && unread > 0 && <em className={styles.badge}>{unread > 99 ? '99+' : unread}</em>}
          </span>
        </button>
      </div>
    </>
  );
}

function WaGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" fill="currentColor">
      <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.3.7 4.5 1.9 6.4L4 29l7.9-2c1.8 1 3.9 1.5 6.1 1.5 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.7c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.7 1.2 1.3-4.5-.3-.4A9.7 9.7 0 0 1 6.1 15c0-5.4 4.4-9.8 9.9-9.8s9.9 4.4 9.9 9.8-4.4 9.7-9.9 9.7zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z" />
    </svg>
  );
}
