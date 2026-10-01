'use client';

// Alamat halaman belanja menurut tempat customer berada. Di dalam portal (/dashboard/*) semua tautan
// produk, katalog, dan checkout tetap di portal, sehingga customer tidak "keluar" ke situs company profile.
import { usePathname } from 'next/navigation';

export interface ShopPaths {
  /** true bila sedang di portal customer (/dashboard/*). */
  portal: boolean;
  catalog: string;
  product: (slug: string) => string;
  category: (slug: string) => string;
  checkout: string;
  /** Halaman keranjang; di portal keranjang berupa laci di top bar, jadi diarahkan ke katalog portal. */
  cart: string;
  orders: string;
  order: (number: string) => string;
}

export function shopPaths(portal: boolean): ShopPaths {
  if (portal) {
    return {
      portal,
      catalog: '/dashboard/katalog',
      product: (slug) => `/dashboard/katalog/${encodeURIComponent(slug)}`,
      category: (slug) => `/dashboard/katalog?category=${encodeURIComponent(slug)}`,
      checkout: '/dashboard/checkout',
      cart: '/dashboard/katalog',
      orders: '/dashboard/pesanan',
      order: (number) => `/dashboard/pesanan/${encodeURIComponent(number)}`,
    };
  }

  return {
    portal,
    catalog: '/catalog',
    product: (slug) => `/catalog/${encodeURIComponent(slug)}`,
    category: (slug) => `/catalog/kategori/${encodeURIComponent(slug)}`,
    checkout: '/checkout',
    cart: '/cart',
    orders: '/dashboard/pesanan',
    order: (number) => `/dashboard/pesanan/${encodeURIComponent(number)}`,
  };
}

export function isPortalPath(pathname: string | null | undefined): boolean {
  return !!pathname && (pathname === '/dashboard' || pathname.startsWith('/dashboard/'));
}

export function useShopPaths(): ShopPaths {
  return shopPaths(isPortalPath(usePathname()));
}

// ---- Bus kecil antar komponen portal (tanpa context tambahan) ----

/** Minta widget chat terbuka, opsional dengan rujukan produk/pesanan yang ikut dikirim bersama pesan berikutnya. */
export const CHAT_OPEN_EVENT = 'ikn:chat-open';

export type ChatAttachment =
  | { type: 'product'; slug: string; label: string; image?: string | null }
  | { type: 'order'; number: string; label: string };

export function openChat(attachment?: ChatAttachment): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ChatAttachment | undefined>(CHAT_OPEN_EVENT, { detail: attachment }));
}

/** Minta laci keranjang di top bar portal terbuka (mis. tombol "Lihat keranjang" di detail produk). */
export const CART_OPEN_EVENT = 'ikn:cart-open';

export function openCartDrawer(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CART_OPEN_EVENT));
}

/** Minta top bar portal memuat ulang penghitung badge (notifikasi + chat). */
export const CUSTOMER_BADGES_EVENT = 'ikn:customer-badges';

export function refreshCustomerBadges(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CUSTOMER_BADGES_EVENT));
}

// ---- Rentang tanggal bawaan: awal bulan sampai hari ini (zona browser) ----

export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function monthToDate(): { from: string; to: string } {
  const now = new Date();
  return { from: isoDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDay(now) };
}

/** Waktu relatif ringkas untuk notifikasi dan chat ("baru saja", "5 mnt", "2 jam", lalu tanggal). */
export function timeAgo(iso: string | null | undefined, lang: 'id' | 'en'): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.floor((Date.now() - then) / 60000);
  if (minutes < 1) return lang === 'en' ? 'just now' : 'baru saja';
  if (minutes < 60) return lang === 'en' ? `${minutes} min ago` : `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === 'en' ? `${hours} h ago` : `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return lang === 'en' ? `${days} d ago` : `${days} hari lalu`;
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}
