'use client';

// Keranjang belanja disimpan di localStorage (ASUMSI A-11); harga final selalu dari
// POST /cart/quote. Item menyimpan snapshot ringan produk (slug, nama, moq, harga efektif + mata uangnya).
// Mata uang item mengikuti pasar customer (ASUMSI A-86): bila customer yang login memakai mata uang lain
// (mis. item ditambah sebagai tamu dalam rupiah lalu login sebagai customer ekspor), keranjang di-quote ulang
// dan harga/mata uangnya ditimpa; item tanpa harga di mata uang itu dibuang dengan pemberitahuan sekali.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, fieldErrors } from '@/lib/api';
import { productPrice } from '@/lib/commerce';
import type { CartItem, Currency, Product, QuoteResult } from '@/lib/types';

interface CartContextValue {
  items: CartItem[];
  /** Tambah produk (qty dibulatkan ke atas minimal `moq`; ditolak bila tidak tersedia). */
  add: (product: Product, qty?: number) => boolean;
  updateQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  /** Salin harga/mata uang item dari respons POST /cart/quote (halaman keranjang dan checkout). */
  syncQuote: (quote: QuoteResult) => void;
  count: number;
  /** Estimasi subtotal dari harga saat item ditambahkan (bukan angka final). */
  subtotal: number;
  /** Mata uang item di keranjang (IDR bila kosong atau item lama). */
  currency: Currency;
  /** Pemberitahuan sekali setelah keranjang disesuaikan ke mata uang customer; null bila tidak ada. */
  notice: string | null;
  dismissNotice: () => void;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = 'ikn_cart';
const RETRY_LIMIT = 5;
const RETRY_DELAY_MS = 20000;

/** Produk boleh dimasukkan keranjang: harga tetap di mata uang pengunjung, published, dan stok tersedia. */
export function isSellable(product: Pick<Product, 'priceMode' | 'available' | 'stockStatus' | 'currency' | 'price' | 'promoPrice' | 'effectivePrice' | 'priceUsd'>): boolean {
  if (product.priceMode !== 'fixed') return false;
  if (productPrice(product).amount == null) return false;
  if (product.stockStatus === 'made_to_order') return true;
  return product.stockStatus === 'in_stock' && product.available > 0;
}

function toCartItem(product: Product, qty: number): CartItem {
  const price = productPrice(product);
  return {
    productId: product.id,
    slug: product.slug,
    code: product.code,
    name: product.name,
    unit: product.unit,
    image: product.image ?? product.images?.[0]?.url ?? null,
    qty,
    moq: Math.max(1, product.moq || 1),
    unitPrice: price.amount,
    currency: price.currency,
  };
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.slug === 'string' && typeof v.qty === 'number' && typeof v.productId === 'number' && !!v.name && typeof v.name === 'object';
}

/** Item dari penyimpanan lama belum punya `currency`: dianggap rupiah. */
function normalizeItem(item: CartItem): CartItem {
  return { ...item, currency: item.currency === 'USD' ? 'USD' : 'IDR' };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { customer } = useAuth();
  const { lang } = useLang();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const converting = useRef(false);
  // Quote ulang mata uang yang gagal karena jaringan/server dicoba lagi dengan jeda (maks. RETRY_LIMIT kali per sesi).
  const [retryTick, setRetryTick] = useState(0);
  const retries = useRef(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Buang item dari format keranjang lama (sebelum phase e-commerce).
        if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem).map(normalizeItem));
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((product: Product, qty = 1): boolean => {
    if (!isSellable(product)) return false;
    const moq = Math.max(1, product.moq || 1);
    const wanted = Math.max(moq, Math.floor(qty) || moq);
    setItems((prev) => {
      const found = prev.find((i) => i.slug === product.slug);
      if (found) {
        return prev.map((i) => (i.slug === product.slug ? { ...toCartItem(product, i.qty + wanted) } : i));
      }
      return [...prev, toCartItem(product, wanted)];
    });
    return true;
  }, []);

  const updateQty = useCallback((slug: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.slug === slug ? { ...i, qty: Math.max(i.moq || 1, Math.floor(qty) || 0) } : i)),
    );
  }, []);

  const remove = useCallback((slug: string) => {
    setItems((prev) => prev.filter((i) => i.slug !== slug));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const syncQuote = useCallback((quote: QuoteResult) => {
    const currency: Currency = quote.currency === 'USD' ? 'USD' : 'IDR';
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const line = quote.items.find((q) => q.productSlug === item.slug);
        if (!line) return item;
        if (item.unitPrice === line.unitPrice && item.currency === currency) return item;
        changed = true;
        return { ...item, unitPrice: line.unitPrice, currency };
      });
      return changed ? next : prev;
    });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  // Mata uang customer yang login berbeda dari item keranjang → quote ulang dan timpa harga (ASUMSI A-86).
  const target: Currency | null = customer?.status === 'active' ? (customer.currency === 'USD' ? 'USD' : 'IDR') : null;
  const staleKey = target ? items.filter((i) => i.currency !== target).map((i) => i.slug).join('|') : '';
  useEffect(() => {
    if (!ready || !target || !staleKey || converting.current) return;
    converting.current = true;
    api<QuoteResult>('/cart/quote', { method: 'POST', body: { items: items.map((i) => ({ productSlug: i.slug, qty: i.qty })) } })
      .then((quote) => {
        retries.current = 0;
        syncQuote(quote);
        setNotice(
          lang === 'en'
            ? `Cart prices were updated to ${target} to match your account.`
            : `Harga keranjang disesuaikan ke ${target} sesuai akun Anda.`,
        );
      })
      .catch((err) => {
        // 422 items.N.productSlug: produk tidak bisa dijual di mata uang customer (tanpa harga USD, harga minta penawaran,
        // atau sudah tidak ada) → dibuang dengan pesan server; sisanya di-quote ulang pada putaran berikutnya.
        // Galat qty (items.N.qty) atau jaringan/server tidak membuang apa pun.
        const errors = fieldErrors(err);
        const bad = Object.keys(errors)
          .map((key) => key.match(/^items\.(\d+)\.productSlug$/)?.[1])
          .filter((idx): idx is string => idx !== undefined)
          .map(Number);
        if (bad.length > 0) {
          const message = errors[`items.${bad[0]}.productSlug`];
          setItems((prev) => prev.filter((_, index) => !bad.includes(index)));
          setNotice(
            message
              ? lang === 'en'
                ? `Removed from your cart: ${message}`
                : `Dihapus dari keranjang: ${message}`
              : lang === 'en'
                ? `${bad.length} item(s) without a ${target} price were removed from your cart.`
                : `${bad.length} item tanpa harga ${target} dihapus dari keranjang.`,
          );
        } else if (retries.current < RETRY_LIMIT) {
          // Item dan mata uangnya dibiarkan apa adanya (tidak ada harga null yang tampil "USD 0.00"); coba lagi nanti.
          retries.current += 1;
          window.setTimeout(() => setRetryTick((n) => n + 1), RETRY_DELAY_MS);
        }
      })
      .finally(() => {
        converting.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, target, staleKey, retryTick]);

  const value = useMemo<CartContextValue>(() => {
    // Badge = number of distinct products in the cart, not the summed quantity (25 kg Resiprene counts as 1).
    const count = items.length;
    const subtotal = items.reduce((n, i) => n + (i.unitPrice || 0) * i.qty, 0);
    const currency: Currency = items.find((i) => i.currency === 'USD') ? 'USD' : 'IDR';
    return { items, add, updateQty, remove, clear, syncQuote, count, subtotal, currency, notice, dismissNotice, ready };
  }, [items, add, updateQty, remove, clear, syncQuote, notice, dismissNotice, ready]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) {
    // Fallback aman jika dipakai di luar provider (mis. saat prerender)
    return {
      items: [],
      add: () => false,
      updateQty: () => {},
      remove: () => {},
      clear: () => {},
      syncQuote: () => {},
      count: 0,
      subtotal: 0,
      currency: 'IDR',
      notice: null,
      dismissNotice: () => {},
      ready: false,
    };
  }
  return ctx;
}
