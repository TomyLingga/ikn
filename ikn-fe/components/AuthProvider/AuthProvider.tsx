'use client';

// Provider auth berbasis sesi backend (Laravel Sanctum, cookie httpOnly).
// Satu sesi per browser: `user` dari GET /auth/me; `customer` / `admin` diturunkan dari role.
// Tanpa sesi (401), pengunjung tetap viewer. Tidak ada mock.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, ApiError, toAdminAccount, type AdminAccountShape } from '@/lib/api';
import type { AuthUser, RegisterPayload, RegisterResult } from '@/lib/types';

export interface CustomerAccount extends AuthUser {
  role: 'customer';
  /** Nama perusahaan dari profil (kosong bila belum diisi). */
  company: string;
}

export type AdminAccount = AdminAccountShape;

export type { RegisterPayload, RegisterResult };

interface AuthContextValue {
  /** User mentah dari API (customer maupun admin). */
  user: AuthUser | null;
  customer: CustomerAccount | null;
  admin: AdminAccount | null;
  ready: boolean;
  loginCustomer: (email: string, password: string, remember?: boolean) => Promise<CustomerAccount>;
  loginAdmin: (email: string, password: string, remember?: boolean) => Promise<AdminAccount>;
  /** POST /auth/register — tidak login otomatis; customer harus verifikasi email dulu. */
  registerCustomer: (payload: RegisterPayload) => Promise<RegisterResult>;
  /** POST /auth/logout — satu sesi, menghapus customer maupun admin. */
  logout: () => Promise<void>;
  /** Alias kompatibilitas (AccountNav / AdminShell). */
  logoutCustomer: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toCustomerAccount(user: AuthUser): CustomerAccount {
  return { ...user, role: 'customer', company: user.profile?.company || '' };
}

function splitUser(user: AuthUser | null): { customer: CustomerAccount | null; admin: AdminAccount | null } {
  if (!user) return { customer: null, admin: null };
  if (user.role === 'customer') return { customer: toCustomerAccount(user), admin: null };
  return { customer: null, admin: toAdminAccount(user) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ user: AuthUser }>('/auth/me');
      setUser(me.user ?? null);
    } catch (err) {
      // 401 = tamu; error lain (jaringan) juga dianggap tanpa sesi agar UI tidak menggantung.
      if (err instanceof ApiError && err.status !== 401 && err.status !== 0) {
        console.error('[auth] /auth/me:', err.message);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setReady(true));
  }, [refresh]);

  const loginCustomer = useCallback(async (email: string, password: string, remember = false): Promise<CustomerAccount> => {
    const result = await api<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: { email, password, remember },
    });
    setUser(result.user);
    return toCustomerAccount(result.user);
  }, []);

  const loginAdmin = useCallback(async (email: string, password: string, remember = false): Promise<AdminAccount> => {
    const result = await api<{ account: AdminAccount }>('/auth/admin/login', {
      method: 'POST',
      body: { email, password, remember },
    });
    // Ambil user lengkap agar `user` konsisten dengan /auth/me.
    await refresh();
    return result.account;
  }, [refresh]);

  const registerCustomer = useCallback(async (payload: RegisterPayload): Promise<RegisterResult> => {
    return api<RegisterResult>('/auth/register', { method: 'POST', body: payload });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const { customer, admin } = splitUser(user);
    return {
      user,
      customer,
      admin,
      ready,
      loginCustomer,
      loginAdmin,
      registerCustomer,
      logout,
      logoutCustomer: logout,
      logoutAdmin: logout,
      refresh,
    };
  }, [user, ready, loginCustomer, loginAdmin, registerCustomer, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const notReady = () => Promise.reject(new Error('Auth belum siap.'));

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fallback aman bila dipakai di luar provider (mis. saat prerender).
    return {
      user: null,
      customer: null,
      admin: null,
      ready: false,
      loginCustomer: notReady,
      loginAdmin: notReady,
      registerCustomer: notReady,
      logout: async () => {},
      logoutCustomer: async () => {},
      logoutAdmin: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
