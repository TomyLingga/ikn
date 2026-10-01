'use client';

// Kerangka halaman auth lupa/reset password: kartu dua panel yang sama dengan /login (form kiri, foto kanan).
import type { ReactNode } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import AuthVisual from '@/components/auth/AuthVisual';
import styles from '@/app/(auth)/login/page.module.css';

export { styles as authStyles };

interface AuthPageProps {
  eyebrow: string;
  title: string;
  lead?: string;
  children: ReactNode;
  /** Baris tautan di bawah kartu (mis. "Kembali ke login"). */
  footer?: ReactNode;
}

export default function AuthPage({ eyebrow, title, lead, children, footer }: AuthPageProps) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <div className={styles.formPane}>
          <div className={styles.themeCorner}>
            <ThemeToggle />
          </div>
          <div className={styles.formInner}>
            <div className={styles.heading}>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h1 id="auth-title">{title}</h1>
              {lead && <p>{lead}</p>}
            </div>
            {children}
            {footer && <p className={`${styles.modeSwitch} ${styles.footerSwitch}`}>{footer}</p>}
          </div>
        </div>
        <AuthVisual />
      </section>
    </main>
  );
}
