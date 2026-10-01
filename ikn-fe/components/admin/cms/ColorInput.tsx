'use client';

import { HEX_COLOR } from '@/lib/theme';

interface ColorInputProps {
  value: string; // hex #rrggbb atau '' (bawaan)
  onChange: (value: string) => void;
  label?: string; // aria-label untuk color picker
  fallback?: string; // warna yang ditampilkan picker saat nilai kosong/tidak valid
  placeholder?: string;
  resetLabel?: string;
}

// Color picker + teks hex + tombol reset ke bawaan. Dipakai FieldInput (field `color` section) dan Pengaturan Situs.
export default function ColorInput({
  value,
  onChange,
  label,
  fallback = '#ffffff',
  placeholder = 'kosong = warna bawaan',
  resetLabel = 'Bawaan',
}: ColorInputProps) {
  return (
    <div className="cms-color-row">
      <input
        type="color"
        value={HEX_COLOR.test(value) ? value : fallback}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        aria-label={label}
      />
      <input
        type="text"
        value={value}
        maxLength={7}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.trim())}
        className="mono"
      />
      <button type="button" className="row-act" onClick={() => onChange('')} disabled={value === ''}>
        {resetLabel}
      </button>
    </div>
  );
}
