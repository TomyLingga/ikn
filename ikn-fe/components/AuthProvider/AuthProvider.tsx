'use client';

// Provider auth berbasis sesi backend (Laravel Sanctum, cookie httpOnly).
// Sesi customer dan admin memakai guard terpisah di server sehingga
// keduanya bisa hidup berdampingan. Tanpa sesi, pengunjung tetap viewer.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '@/lib/api';

export interface CustomerAccount {
  role: 'customer';
  id: string;
  name: string;
  email: string;
  company: string;
}

export interface AdminAccount {
  role: 'super_admin' | 'admin';
  id: string;
  name: string;
  email: string;
  permissions: string[];
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  company: string;
  phone?: string;
}

interface AuthContextValue {
  customer: CustomerAccount | null;
  admin: AdminAccount | null;
  ready: boolean;
  loginCustomer: (email: string, password: string) => Promise<CustomerAccount>;
  registerCustomer: (payload: RegisterPayload) => Promise<CustomerAccount>;
  loginAdmin: (email: string, password: string) => Promise<AdminAccount>;
  logoutCustomer: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  customer: CustomerAccount | null;
  admin: AdminAccount | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerAccount | null>(null);
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>('/auth/me');
      setCustomer(me.customer);
      setAdmin(me.admin);
    } catch {
      setCustomer(null);
      setAdmin(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  async function loginCustomer(email: string, password: string): Promise<CustomerAccount> {
    const result = await api<{ account: CustomerAccount }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setCustomer(result.account);
    return result.account;
  }

  async function registerCustomer(payload: RegisterPayload): Promise<CustomerAccount> {
    const result = await api<{ account: CustomerAccount }>('/auth/register', {
      method: 'POST',
      body: payload,
    });
    setCustomer(result.account);
    return result.account;
  }

  async function loginAdmin(email: string, password: string): Promise<AdminAccount> {
    const result = await api<{ account: AdminAccount }>('/auth/admin/login', {
      method: 'POST',
      body: { email, password },
    });
    setAdmin(result.account);
    return result.account;
  }

  async function logoutCustomer() {
    await api('/auth/logout', { method: 'POST', body: { scope: 'customer' } });
    setCustomer(null);
  }

  async function logoutAdmin() {
    await api('/auth/logout', { method: 'POST', body: { scope: 'admin' } });
    setAdmin(null);
  }

  return (
    <AuthContext.Provider
      value={{
        customer,
        admin,
        ready,
        loginCustomer,
        registerCustomer,
        loginAdmin,
        logoutCustomer,
        logoutAdmin,
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback aman bila dipakai di luar provider (mis. saat prerender).
    return {
      customer: null,
      admin: null,
      ready: false,
      loginCustomer: async () => Promise.reject(new Error('Auth belum siap.')),
      registerCustomer: async () => Promise.reject(new Error('Auth belum siap.')),
      loginAdmin: async () => Promise.reject(new Error('Auth belum siap.')),
      logoutCustomer: async () => {},
      logoutAdmin: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
