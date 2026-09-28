'use client';

// Keranjang belanja disimpan di localStorage (ASUMSI A-11); harga final selalu dari
// POST /cart/quote. Item menyimpan snapshot ringan produk (slug, nama, moq, harga efektif).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CartItem, Product } from '@/lib/types';

interface CartContextValue {
  items: CartItem[];
  /** Tambah produk (qty dibulatkan ke atas minimal `moq`; ditolak bila tidak tersedia). */
  add: (product: Product, qty?: number) => boolean;
  updateQty: (slug: string, qty: number) => void;
  remove: (slug: string) => void;
  clear: () => void;
  count: number;
  /** Estimasi subtotal dari harga saat item ditambahkan (bukan angka final). */
  subtotal: number;
  ready: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = 'ikn_cart';

/** Produk boleh dimasukkan keranjang: harga tetap, published, dan stok tersedia. */
export function isSellable(product: Pick<Product, 'priceMode' | 'available' | 'stockStatus'>): boolean {
  if (product.priceMode !== 'fixed') return false;
  if (product.stockStatus === 'made_to_order') return true;
  return product.stockStatus === 'in_stock' && product.available > 0;
}

function toCartItem(product: Product, qty: number): CartItem {
  return {
    productId: product.id,
    slug: product.slug,
    code: product.code,
    name: product.name,
    unit: product.unit,
    image: product.image ?? product.images?.[0]?.url ?? null,
    qty,
    moq: Math.max(1, product.moq || 1),
    unitPrice: product.effectivePrice ?? product.price ?? null,
  };
}

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.slug === 'string' && typeof v.qty === 'number' && typeof v.productId === 'number' && !!v.name && typeof v.name === 'object';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Buang item dari format keranjang lama (sebelum phase e-commerce).
        if (Array.isArray(parsed)) setItems(parsed.filter(isCartItem));
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

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.qty, 0);
    const subtotal = items.reduce((n, i) => n + (i.unitPrice || 0) * i.qty, 0);
    return { items, add, updateQty, remove, clear, count, subtotal, ready };
  }, [items, add, updateQty, remove, clear, ready]);

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
      count: 0,
      subtotal: 0,
      ready: false,
    };
  }
  return ctx;
}
