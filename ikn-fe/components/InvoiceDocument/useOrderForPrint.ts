'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { Order } from '@/lib/types';

/**
 * Memuat order untuk halaman cetak dengan sesi pengguna: admin lewat GET /admin/orders/{number}, customer pemilik
 * lewat GET /customer/orders/{number}. Halaman cetak tidak pernah menerima data order lewat URL. `preloaded` (order
 * yang sudah dimuat pemanggil, mis. pemilih dokumen rute invoice) dipakai apa adanya tanpa mengambil ulang.
 */
export function useOrderForPrint(number: string, preloaded?: Order | null): { order: Order | null; error: string } {
  const { customer, admin, ready } = useAuth();
  const { lang } = useLang();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (preloaded || !ready) return;
    const t = (id: string, en: string) => (lang === 'en' ? en : id);
    if (!customer && !admin) {
      setError(t('Login dulu untuk membuka dokumen ini.', 'Please log in to open this document.'));
      return;
    }
    let active = true;
    const path = admin ? `/admin/orders/${encodeURIComponent(number)}` : `/customer/orders/${encodeURIComponent(number)}`;
    api<Order>(path)
      .then((data) => {
        if (active) setOrder(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof ApiError && err.status === 404 ? t('Pesanan tidak ditemukan.', 'Order not found.') : errorMessage(err));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, customer, admin, number, preloaded]);

  return { order: preloaded ?? order, error };
}
