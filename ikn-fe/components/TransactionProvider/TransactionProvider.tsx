'use client';

// Sumber data pesanan milik customer yang sedang login — dibaca dari API.
// Semua aksi (checkout, upload bukti, konfirmasi terima, ulasan, batal)
// memanggil backend lalu menyegarkan daftar, sehingga status selalu
// mengikuti state machine server.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import type { Order } from '@/lib/types';

export interface CheckoutPayload {
  items: { slug: string; qty: number }[];
  bankId: string;
  shippingMethodId: string;
  address: { label: string; recipient: string; phone: string; line: string };
  note?: string;
}

interface TransactionContextValue {
  orders: Order[];
  ready: boolean;
  refresh: () => Promise<void>;
  getOrder: (number: string) => Order | null;
  checkout: (payload: CheckoutPayload) => Promise<Order>;
  uploadProof: (number: string, file: File) => Promise<Order>;
  confirmReceived: (number: string) => Promise<Order>;
  submitReview: (number: string, rating: number, body: string) => Promise<Order>;
  cancelOrder: (number: string) => Promise<Order>;
}

const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const { customer, ready: authReady } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!customer) {
      setOrders([]);
      return;
    }
    try {
      setOrders(await api<Order[]>('/customer/orders'));
    } catch {
      setOrders([]);
    }
  }, [customer]);

  useEffect(() => {
    if (!authReady) return;
    setReady(false);
    refresh().finally(() => setReady(true));
  }, [authReady, refresh]);

  function upsert(order: Order) {
    setOrders((current) => [
      order,
      ...current.filter((item) => item.number !== order.number),
    ]);
  }

  const value: TransactionContextValue = {
    orders,
    ready,
    refresh,
    getOrder: (number) => orders.find((order) => order.number === number) || null,
    checkout: async (payload) => {
      const order = await api<Order>('/customer/orders', { method: 'POST', body: payload });
      upsert(order);
      return order;
    },
    uploadProof: async (number, file) => {
      const formData = new FormData();
      formData.append('proof', file);
      const order = await api<Order>(`/customer/orders/${encodeURIComponent(number)}/proof`, {
        method: 'POST',
        formData,
      });
      upsert(order);
      return order;
    },
    confirmReceived: async (number) => {
      const order = await api<Order>(
        `/customer/orders/${encodeURIComponent(number)}/confirm-received`,
        { method: 'POST' },
      );
      upsert(order);
      return order;
    },
    submitReview: async (number, rating, body) => {
      const order = await api<Order>(`/customer/orders/${encodeURIComponent(number)}/reviews`, {
        method: 'POST',
        body: { rating, body },
      });
      upsert(order);
      return order;
    },
    cancelOrder: async (number) => {
      const order = await api<Order>(`/customer/orders/${encodeURIComponent(number)}/cancel`, {
        method: 'POST',
      });
      upsert(order);
      return order;
    },
  };

  return <TransactionContext.Provider value={value}>{children}</TransactionContext.Provider>;
}

export function useTransactions(): TransactionContextValue {
  const ctx = useContext(TransactionContext);
  if (!ctx) {
    const reject = async () => Promise.reject<Order>(new Error('Provider belum siap.'));
    return {
      orders: [],
      ready: false,
      refresh: async () => {},
      getOrder: () => null,
      checkout: reject,
      uploadProof: reject,
      confirmReceived: reject,
      submitReview: reject,
      cancelOrder: reject,
    };
  }
  return ctx;
}
