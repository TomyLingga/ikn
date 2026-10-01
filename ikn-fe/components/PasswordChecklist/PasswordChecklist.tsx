'use client';

import { useLang } from '@/components/LanguageProvider';
import { passwordChecks } from '@/lib/validation';
import styles from './PasswordChecklist.module.css';

// Checklist syarat kata sandi yang langsung tercentang saat mengetik (min. 8, huruf besar, huruf kecil, angka).
export default function PasswordChecklist({ value }: { value: string }) {
  const { lang } = useLang();
  const c = passwordChecks(value);
  const items: [boolean, string, string][] = [
    [c.length, 'Minimal 8 karakter', 'At least 8 characters'],
    [c.upper, 'Huruf besar (A–Z)', 'Uppercase letter (A–Z)'],
    [c.lower, 'Huruf kecil (a–z)', 'Lowercase letter (a–z)'],
    [c.digit, 'Angka (0–9)', 'Number (0–9)'],
  ];
  const passed = items.filter(([ok]) => ok).length;

  return (
    <div className={styles.wrap} aria-live="polite">
      <div className={styles.meter} data-level={value ? passed : 0} aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < passed && value ? styles.on : ''} />
        ))}
      </div>
      <ul className={styles.list}>
        {items.map(([ok, id, en]) => (
          <li key={id} className={ok ? styles.ok : ''}>
            <span aria-hidden="true">{ok ? '✓' : '•'}</span> {lang === 'en' ? en : id}
          </li>
        ))}
      </ul>
    </div>
  );
}
