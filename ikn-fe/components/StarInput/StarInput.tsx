'use client';

import { useState } from 'react';
import styles from './StarInput.module.css';

interface StarInputProps {
  /** 0 = belum dipilih. */
  value: number;
  onChange: (value: number) => void;
  /** Nama grup radio (unik per produk). */
  name: string;
  labels: [string, string, string, string, string];
  legend: string;
  disabled?: boolean;
}

// Pemilih rating 1–5 bintang: grup radio sungguhan (bisa dipakai keyboard dan pembaca layar),
// bintang terisi mengikuti nilai terpilih atau yang sedang disorot kursor.
export default function StarInput({ value, onChange, name, labels, legend, disabled = false }: StarInputProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset className={styles.group} disabled={disabled} onMouseLeave={() => setHover(0)}>
      <legend className="sr-only">{legend}</legend>
      <span className={styles.stars}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className={`${styles.star} ${n <= shown ? styles.on : ''}`} onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} />
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m12 2.6 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9L12 2.6Z" />
            </svg>
            <span className="sr-only">
              {n} — {labels[n - 1]}
            </span>
          </label>
        ))}
      </span>
      <span className={styles.caption} aria-hidden="true">
        {shown > 0 ? labels[shown - 1] : ''}
      </span>
    </fieldset>
  );
}
