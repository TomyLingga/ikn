// ============================ API CLIENT ============================
// Satu pintu komunikasi browser → ikn-api (Laravel, Sanctum cookie SPA).
// Semua path memanggil HTTP nyata; tidak ada mock maupun fallback (KEPUTUSAN phase e-commerce).
//
// - api<T>(path, options)      → isi envelope `data` (atau envelope utuh bila `raw: true`)
// - apiPaged<T>(path, options) → { items, meta } untuk daftar berpaginasi
// - apiUpload<T>(path, form)   → multipart (bukti bayar, media)
// - uploadMedia(file)          → POST /admin/media
// - ApiError                   → status, code, errors (422), meta (409 INSUFFICIENT_STOCK, VOUCHER_INVALID, 403 ACCOUNT_NOT_APPROVED)

import type { PagedMeta } from '@/lib/cms';
import type { AuthUser } from '@/lib/types';

export class ApiError extends Error {
  status: number;
  code: string;
  errors: Record<string, string[]>;
  meta: Record<string, unknown> | null;

  constructor(
    status: number,
    message: string,
    errors: Record<string, string[]> = {},
    code = 'ERROR',
    meta: Record<string, unknown> | null = null,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.meta = meta;
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  /** Header tambahan, mis. `Idempotency-Key` pada checkout. */
  headers?: Record<string, string>;
  /** Kembalikan envelope utuh (`{ data, meta, message }`) alih-alih `data` saja. */
  raw?: boolean;
  revalidate?: number;
}

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
export const API_ORIGIN = API_URL.replace(/\/api\/v1$/, '');

function cleanPath(path: string): string {
  return (path.split('?')[0] || '').replace(/^\/api/, '');
}

// ---------------------------------------------------------------- HTTP

let csrfReady = false;

async function ensureCsrf(): Promise<void> {
  if (csrfReady) return;
  await fetch(`${API_ORIGIN}/sanctum/csrf-cookie`, { credentials: 'include' });
  csrfReady = true;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : null;
}

function currentLang(): string {
  if (typeof document === 'undefined') return 'id';
  const lang = document.documentElement.getAttribute('lang');
  return lang === 'en' ? 'en' : 'id';
}

export interface Envelope<T = unknown> {
  data?: T;
  meta?: PagedMeta;
  message?: string;
  code?: string;
  errors?: Record<string, string[]>;
}

async function request(path: string, options: ApiOptions, retried = false): Promise<Envelope> {
  const method = options.method || 'GET';
  if (method !== 'GET') await ensureCsrf();

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': currentLang(),
    ...(options.headers || {}),
  };
  // multipart: biarkan browser menulis Content-Type + boundary.
  if (options.body !== undefined && !options.formData) headers['Content-Type'] = 'application/json';
  const xsrf = readCookie('XSRF-TOKEN');
  if (xsrf) headers['X-XSRF-TOKEN'] = decodeURIComponent(xsrf);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      credentials: 'include',
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server API.', {}, 'NETWORK_ERROR');
  }

  const payload = (res.status === 204 ? {} : await res.json().catch(() => ({}))) as Envelope;

  if (!res.ok) {
    if (res.status === 419 && !retried) {
      csrfReady = false;
      return request(path, options, true);
    }
    throw new ApiError(
      res.status,
      payload.message || `Permintaan gagal (${res.status}).`,
      payload.errors || {},
      payload.code || `HTTP_${res.status}`,
      (payload as { meta?: Record<string, unknown> }).meta ?? null,
    );
  }

  return payload;
}

/** Panggil API dan kembalikan isi envelope `data` (atau envelope utuh bila `raw`). */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const payload = await request(path, options);

  if (options.raw) return payload as unknown as T;

  // Login admin dipetakan ke { account } agar AdminShell (FE-B) tetap bekerja.
  if (cleanPath(path) === '/auth/admin/login') {
    const user = (payload.data as { user: AuthUser }).user;
    return { account: toAdminAccount(user) } as unknown as T;
  }

  return (payload.data !== undefined ? payload.data : payload) as T;
}

/** Untuk daftar berpaginasi: `{ items, meta }`. */
export async function apiPaged<T>(path: string, options: ApiOptions = {}): Promise<{ items: T[]; meta: PagedMeta }> {
  const payload = await request(path, options);
  return {
    items: (payload.data as T[]) || [],
    meta: payload.meta || { page: 1, perPage: 0, total: 0, lastPage: 1 },
  };
}

/** Kirim multipart/form-data (Content-Type diisi browser). */
export function apiUpload<T>(path: string, formData: FormData, options: Omit<ApiOptions, 'body' | 'formData'> = {}): Promise<T> {
  return api<T>(path, { ...options, method: options.method || 'POST', formData });
}

/** Unggah berkas ke media library. */
export async function uploadMedia(file: File, collection = 'general'): Promise<import('@/lib/cms').MediaItem> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('collection', collection);
  return apiUpload<import('@/lib/cms').MediaItem>('/admin/media', formData);
}

// ---------------------------------------------------------------- Akun admin (dipakai AdminShell)

export interface AdminAccountShape {
  role: 'super_admin' | 'admin';
  id: string;
  name: string;
  email: string;
  permissions: string[];
}

export function toAdminAccount(user: AuthUser): AdminAccountShape {
  return {
    role: user.role === 'super_admin' ? 'super_admin' : 'admin',
    id: String(user.id),
    name: user.name,
    email: user.email,
    permissions: user.modules || [],
  };
}

/** Ambil pesan error pertama yang siap ditampilkan ke pengguna. */
export function errorMessage(error: unknown, fallback = 'Terjadi kesalahan. Coba lagi.'): string {
  if (error instanceof ApiError) {
    const first = Object.values(error.errors)[0]?.[0];
    return first || error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/** Pesan validasi 422 per field (`errors.email[0]`), kosong bila tidak ada. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(error.errors)) {
    if (messages?.[0]) out[field] = messages[0];
  }
  return out;
}
