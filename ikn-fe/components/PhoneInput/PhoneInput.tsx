'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/components/LanguageProvider';
import styles from './PhoneInput.module.css';

export interface CountryCode {
  iso: string;
  dial: string;
  id: string;
  en: string;
}

// Kode negara yang paling relevan untuk pembeli PT IKN (ASEAN, Asia, Timur Tengah, Eropa, Amerika, Oseania).
// Indonesia selalu pertama dan menjadi bawaan.
export const COUNTRY_CODES: CountryCode[] = [
  { iso: 'ID', dial: '62', id: 'Indonesia', en: 'Indonesia' },
  { iso: 'MY', dial: '60', id: 'Malaysia', en: 'Malaysia' },
  { iso: 'SG', dial: '65', id: 'Singapura', en: 'Singapore' },
  { iso: 'TH', dial: '66', id: 'Thailand', en: 'Thailand' },
  { iso: 'VN', dial: '84', id: 'Vietnam', en: 'Vietnam' },
  { iso: 'PH', dial: '63', id: 'Filipina', en: 'Philippines' },
  { iso: 'BN', dial: '673', id: 'Brunei', en: 'Brunei' },
  { iso: 'TL', dial: '670', id: 'Timor Leste', en: 'Timor-Leste' },
  { iso: 'MM', dial: '95', id: 'Myanmar', en: 'Myanmar' },
  { iso: 'KH', dial: '855', id: 'Kamboja', en: 'Cambodia' },
  { iso: 'CN', dial: '86', id: 'Tiongkok', en: 'China' },
  { iso: 'HK', dial: '852', id: 'Hong Kong', en: 'Hong Kong' },
  { iso: 'TW', dial: '886', id: 'Taiwan', en: 'Taiwan' },
  { iso: 'JP', dial: '81', id: 'Jepang', en: 'Japan' },
  { iso: 'KR', dial: '82', id: 'Korea Selatan', en: 'South Korea' },
  { iso: 'IN', dial: '91', id: 'India', en: 'India' },
  { iso: 'PK', dial: '92', id: 'Pakistan', en: 'Pakistan' },
  { iso: 'BD', dial: '880', id: 'Bangladesh', en: 'Bangladesh' },
  { iso: 'LK', dial: '94', id: 'Sri Lanka', en: 'Sri Lanka' },
  { iso: 'AE', dial: '971', id: 'Uni Emirat Arab', en: 'United Arab Emirates' },
  { iso: 'SA', dial: '966', id: 'Arab Saudi', en: 'Saudi Arabia' },
  { iso: 'QA', dial: '974', id: 'Qatar', en: 'Qatar' },
  { iso: 'TR', dial: '90', id: 'Turki', en: 'Turkey' },
  { iso: 'EG', dial: '20', id: 'Mesir', en: 'Egypt' },
  { iso: 'ZA', dial: '27', id: 'Afrika Selatan', en: 'South Africa' },
  { iso: 'NG', dial: '234', id: 'Nigeria', en: 'Nigeria' },
  { iso: 'GB', dial: '44', id: 'Inggris', en: 'United Kingdom' },
  { iso: 'NL', dial: '31', id: 'Belanda', en: 'Netherlands' },
  { iso: 'DE', dial: '49', id: 'Jerman', en: 'Germany' },
  { iso: 'FR', dial: '33', id: 'Prancis', en: 'France' },
  { iso: 'IT', dial: '39', id: 'Italia', en: 'Italy' },
  { iso: 'ES', dial: '34', id: 'Spanyol', en: 'Spain' },
  { iso: 'RU', dial: '7', id: 'Rusia', en: 'Russia' },
  { iso: 'US', dial: '1', id: 'Amerika Serikat / Kanada', en: 'United States / Canada' },
  { iso: 'BR', dial: '55', id: 'Brasil', en: 'Brazil' },
  { iso: 'MX', dial: '52', id: 'Meksiko', en: 'Mexico' },
  { iso: 'AU', dial: '61', id: 'Australia', en: 'Australia' },
  { iso: 'NZ', dial: '64', id: 'Selandia Baru', en: 'New Zealand' },
];

const BY_LONGEST_DIAL = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);

/** Pecah nilai tersimpan (+6281234…, 0812…, 62812…) menjadi kode negara + nomor nasional. */
export function splitPhone(value: string): { iso: string; national: string } {
  const raw = (value || '').trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return { iso: 'ID', national: '' };
  if (!raw.startsWith('+')) {
    if (digits.startsWith('0')) return { iso: 'ID', national: digits.slice(1) };
    if (digits.startsWith('62')) return { iso: 'ID', national: digits.slice(2) };
    return { iso: 'ID', national: digits };
  }
  const match = BY_LONGEST_DIAL.find((c) => digits.startsWith(c.dial));
  return match ? { iso: match.iso, national: digits.slice(match.dial.length) } : { iso: 'ID', national: digits };
}

/** Gabungkan menjadi E.164: "+" + kode negara + nomor nasional (angka 0 di depan nomor nasional dibuang). */
export function joinPhone(iso: string, national: string): string {
  const country = COUNTRY_CODES.find((c) => c.iso === iso) ?? COUNTRY_CODES[0]!;
  const digits = national.replace(/\D/g, '').replace(/^0+/, '');
  return digits ? `+${country.dial}${digits}` : '';
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  required?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Gaya kontrol: 'filled' untuk halaman login/daftar (latar lembut), 'plain' mengikuti input form sekitarnya. */
  variant?: 'plain' | 'filled';
  id?: string;
}

// Input telepon dengan pilihan kode negara (bawaan +62). Nilai yang dikirim ke induk berbentuk E.164, mis. +6281234567890;
// server memvalidasi ulang dengan App\Rules\PhoneNumber.
export default function PhoneInput({ value, onChange, onBlur, name, required, invalid, placeholder, variant = 'plain', id }: PhoneInputProps) {
  const { lang } = useLang();
  const [iso, setIso] = useState(() => splitPhone(value).iso);
  const [national, setNational] = useState(() => splitPhone(value).national);

  // Sinkron bila nilai dari luar berubah (mis. profil selesai dimuat), tanpa menimpa ketikan yang setara.
  useEffect(() => {
    if (joinPhone(iso, national) === value) return;
    const next = splitPhone(value);
    setIso(next.iso);
    setNational(next.national);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const country = COUNTRY_CODES.find((c) => c.iso === iso) ?? COUNTRY_CODES[0]!;

  return (
    <span className={`${styles.wrap} ${variant === 'filled' ? styles.filled : ''} ${invalid ? styles.invalid : ''}`}>
      <span className={styles.code}>
        <span className={styles.codeText} aria-hidden="true">
          {country.iso} +{country.dial}
        </span>
        <select
          className={styles.codeSelect}
          value={iso}
          aria-label={lang === 'en' ? 'Country code' : 'Kode negara'}
          onChange={(e) => {
            setIso(e.target.value);
            onChange(joinPhone(e.target.value, national));
          }}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {lang === 'en' ? c.en : c.id} (+{c.dial})
            </option>
          ))}
        </select>
      </span>
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className={styles.number}
        value={national}
        required={required}
        maxLength={20}
        placeholder={placeholder ?? (iso === 'ID' ? '812 3456 7890' : lang === 'en' ? 'Phone number' : 'Nomor telepon')}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9 ()-]/g, '');
          setNational(cleaned);
          onChange(joinPhone(iso, cleaned));
        }}
        onBlur={onBlur}
      />
    </span>
  );
}
