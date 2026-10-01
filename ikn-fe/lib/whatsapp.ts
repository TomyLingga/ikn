import type { SiteSettings, WhatsAppContact } from '@/lib/cms';

// Tautan WhatsApp satu pintu: nomor dari Pengaturan Situs (`settings.contact.whatsapp`) atau nomor/URL yang ditulis
// admin di section kontak, selalu dinormalkan ke format internasional tanpa "+" lalu dibuka lewat wa.me
// (langsung masuk ke percakapan, bukan halaman profil).

/** "0811-6123-993", "+62 811 6123 993", "https://wa.me/628116123993" → "628116123993"; tidak dikenali → "". */
export function normalizeWhatsAppNumber(input: string | null | undefined): string {
  if (!input) return '';
  const fromUrl = input.match(/(?:wa\.me|whatsapp\.com\/send\?phone=|api\.whatsapp\.com\/send\?phone=)\/?\+?([0-9][0-9\-() .]{6,})/i);
  let digits = (fromUrl?.[1] ?? input).replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  if (digits.startsWith('620')) digits = `62${digits.slice(3)}`;
  return digits.length >= 9 && digits.length <= 15 ? digits : '';
}

export function whatsappHref(number: string, message?: string | null): string {
  const digits = normalizeWhatsAppNumber(number);
  if (!digits) return '';
  const text = (message || '').trim();
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** "628116123993" → "+62 811-6123-993" untuk ditampilkan. */
export function formatWhatsAppNumber(number: string): string {
  const digits = normalizeWhatsAppNumber(number);
  if (!digits) return number;
  if (!digits.startsWith('62')) return `+${digits}`;
  const local = digits.slice(2);
  const groups = local.match(/^(\d{3})(\d{4})(\d{3,4})$/) || local.match(/^(\d{3})(\d{3})(\d{3,5})$/);
  return groups ? `+62 ${groups[1]}-${groups[2]}-${groups[3]}` : `+62 ${local}`;
}

/** Tautan media sosial yang ternyata WhatsApp diarahkan ke wa.me; nomor dari pengaturan menang bila ada. */
export function isWhatsAppLink(label: string | null | undefined, url: string | null | undefined): boolean {
  return /whatsapp|wa\.me/i.test(`${label || ''} ${url || ''}`);
}


export interface WhatsAppLink extends WhatsAppContact {
  href: string;
  display: string;
}

/**
 * Daftar nomor WhatsApp marketing dari Pengaturan Situs: nomor utama (`contact.whatsapp`, label bawaan "Marketing")
 * lalu nomor tambahan (`contact.whatsapp_contacts`), nomor ganda dibuang. Semua membawa pesan awal yang sama.
 */
export function whatsappContacts(settings: SiteSettings, message: string, defaultLabel = 'Marketing'): WhatsAppLink[] {
  const rows: WhatsAppContact[] = [
    { label: defaultLabel, number: settings.contact?.whatsapp ?? '' },
    ...(settings.contact?.whatsapp_contacts ?? []),
  ];
  const seen = new Set<string>();
  const out: WhatsAppLink[] = [];
  for (const row of rows) {
    const number = normalizeWhatsAppNumber(row.number);
    if (!number || seen.has(number)) continue;
    seen.add(number);
    out.push({ label: row.label?.trim() || defaultLabel, number, href: whatsappHref(number, message), display: formatWhatsAppNumber(number) });
  }
  return out;
}
