// Validasi input form di sisi klien — aturan yang sama dengan server (ASUMSI A-78):
// email berformat valid, nomor telepon dengan kode negara (E.164, bawaan +62), password min. 8 dengan huruf besar,
// huruf kecil, dan angka. Server tetap memvalidasi ulang; ini hanya agar pengguna langsung tahu kesalahannya.

type Lang = 'id' | 'en';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Normalisasi nomor telepon ke E.164 (+6281234567890) atau null bila tidak valid — sama dengan App\Rules\PhoneNumber:
 * dengan "+" = kode negara apa pun (total 8–15 digit); tanpa "+" hanya nomor Indonesia (0… / 62…); untuk +62 digit
 * nasional 8–13 dan tidak diawali 0.
 */
export function normalizePhone(value: string): string | null {
  const raw = value.trim();
  if (!raw || !/^\+?[0-9 ().-]+$/.test(raw)) return null;
  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+')) {
    if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
    else if (!digits.startsWith('62')) return null;
  }
  if (!/^[1-9][0-9]{7,14}$/.test(digits)) return null;
  if (digits.startsWith('62') && !/^62[1-9][0-9]{7,12}$/.test(digits)) return null;
  return `+${digits}`;
}

export function isPhone(value: string): boolean {
  return normalizePhone(value) !== null;
}

export interface PasswordChecks {
  length: boolean;
  lower: boolean;
  upper: boolean;
  digit: boolean;
}

export function passwordChecks(value: string): PasswordChecks {
  return { length: value.length >= 8, lower: /[a-z]/.test(value), upper: /[A-Z]/.test(value), digit: /\d/.test(value) };
}

export function isStrongPassword(value: string): boolean {
  const c = passwordChecks(value);
  return c.length && c.lower && c.upper && c.digit;
}

export const validationText = {
  email: { id: 'Format email tidak valid, mis. nama@perusahaan.com.', en: 'Invalid email format, e.g. name@company.com.' },
  phone: { id: 'Nomor telepon tidak valid. Periksa kode negara dan nomornya, mis. +62 812-3456-7890.', en: 'Invalid phone number. Check the country code and number, e.g. +62 812-3456-7890.' },
  password: { id: 'Kata sandi minimal 8 karakter dengan huruf besar, huruf kecil, dan angka.', en: 'Password needs at least 8 characters with uppercase, lowercase and a number.' },
  confirm: { id: 'Konfirmasi kata sandi belum sama.', en: 'Password confirmation does not match.' },
  confirmOk: { id: 'Kata sandi cocok.', en: 'Passwords match.' },
} satisfies Record<string, Record<Lang, string>>;

/** Pesan error untuk satu nilai; '' bila valid atau masih kosong (field wajib dicek oleh `required`). */
export function emailError(value: string, lang: Lang): string {
  return value.trim() && !isEmail(value) ? validationText.email[lang] : '';
}

export function phoneError(value: string, lang: Lang): string {
  return value.trim() && !isPhone(value) ? validationText.phone[lang] : '';
}

export function passwordError(value: string, lang: Lang): string {
  return value && !isStrongPassword(value) ? validationText.password[lang] : '';
}

export function confirmError(password: string, confirm: string, lang: Lang): string {
  return confirm && password !== confirm ? validationText.confirm[lang] : '';
}
