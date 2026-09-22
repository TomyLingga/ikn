// ============================ API CLIENT ============================
// Satu pintu komunikasi frontend Next.js ke Supabase & Offline Mock Store.
// - Menghapus ketergantungan backend server lokal (Laravel tidak digunakan).
// - Memastikan transaksi, checkout, order tracking, profil pembeli, dan manajemen
//   admin berjalan instan tanpa jeda jaringan/timeout.

import { handleMockApi, MockApiError } from '@/lib/mock-api';

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  revalidate?: number;
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  try {
    const result = await handleMockApi(path, options);
    return result as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof MockApiError) {
      throw new ApiError(err.status, err.message, err.errors);
    }
    if (err instanceof Error) {
      throw new ApiError(500, err.message);
    }
    throw new ApiError(500, 'Terjadi kesalahan pada sistem.');
  }
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
