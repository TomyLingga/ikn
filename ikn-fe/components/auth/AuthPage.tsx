'use client';

// Kerangka halaman auth (login, lupa/reset password): kartu neumorphic yang sama dengan /login.
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { useLang } from '@/components/LanguageProvider';
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
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>
        <Icon name="arrow" size={16} /> {t('Kembali ke situs', 'Back to site')}
      </Link>
      <div className={styles.themeCorner}>
        <ThemeToggle />
      </div>
      <section className={styles.card} aria-labelledby="auth-title">
        <div className={styles.brand}>
          <Link href="/" aria-label="PT IKN">
            <Image src="/img/rubin-logo.png" alt="PT IKN" width={48} height={48} priority />
          </Link>
          <div>
            <strong>PT Industri Karet Nusantara</strong>
            <span>{t('Portal customer', 'Customer portal')}</span>
          </div>
        </div>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h1 id="auth-title">{title}</h1>
          {lead && <p>{lead}</p>}
        </div>
        {children}
        {footer && <p className={styles.modeSwitch}>{footer}</p>}
      </section>
    </main>
  );
}
