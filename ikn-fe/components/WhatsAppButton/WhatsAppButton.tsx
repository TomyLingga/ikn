'use client';

import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { tr } from '@/lib/cms';

// Tombol WhatsApp Business melayang di situs publik. Nomor dan pesan awal diatur di Pengaturan Situs
// (kanal chat, checklist digital marketing klien). Tidak dirender bila nomor kosong.
export default function WhatsAppButton() {
  const { lang } = useLang();
  const { settings } = useSite();
  const number = (settings.contact?.whatsapp ?? '').replace(/[^0-9]/g, '');
  if (!number) return null;

  const message = tr(settings.contact?.whatsapp_message ?? { id: '', en: '' }, lang);
  const href = `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
  const label = lang === 'en' ? 'Chat via WhatsApp' : 'Chat lewat WhatsApp';

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="wa-float" aria-label={label} title={label}>
      <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" fill="currentColor">
        <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.3.7 4.5 1.9 6.4L4 29l7.9-2c1.8 1 3.9 1.5 6.1 1.5 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.7c-1.9 0-3.8-.5-5.4-1.5l-.4-.2-4.7 1.2 1.3-4.5-.3-.4A9.7 9.7 0 0 1 6.1 15c0-5.4 4.4-9.8 9.9-9.8s9.9 4.4 9.9 9.8-4.4 9.7-9.9 9.7zm5.4-7.3c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4z" />
      </svg>
      <span>{lang === 'en' ? 'WhatsApp' : 'WhatsApp'}</span>
    </a>
  );
}
