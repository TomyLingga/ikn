'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import AuthPage, { authStyles as styles } from '@/components/auth';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage } from '@/lib/api';

// Lupa password: POST /auth/password/forgot (selalu 200; tautan reset dikirim lewat email).
export default function ForgotPasswordPage() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api('/auth/password/forgot', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, t('Permintaan gagal. Coba lagi.', 'Request failed. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage
      eyebrow={t('Pemulihan akun', 'Account recovery')}
      title={t('Lupa password', 'Forgot password')}
      lead={t(
        'Masukkan email akun Anda. Kami akan mengirim tautan untuk mengatur ulang password.',
        'Enter your account email. We will send a link to reset your password.',
      )}
      footer={
        <>
          {t('Ingat password Anda?', 'Remember your password?')} <Link href="/login">{t('Kembali ke login', 'Back to login')}</Link>
        </>
      }
    >
      {sent ? (
        <div className={styles.success}>
          <Icon name="mail" size={34} />
          <h2 className="h3">{t('Cek email Anda', 'Check your email')}</h2>
          <p>
            {t(
              `Bila ${email} terdaftar, tautan reset password sudah dikirim. Tautan berlaku 60 menit.`,
              `If ${email} is registered, a password reset link has been sent. The link is valid for 60 minutes.`,
            )}
          </p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <p className={styles.error} role="alert"><Icon name="close" size={16} /> {error}</p>}
          <label className={styles.field}>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@perusahaan.com" />
          </label>
          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? t('Mengirim…', 'Sending…') : t('Kirim tautan reset', 'Send reset link')} <Icon name="arrow" size={18} />
          </button>
        </form>
      )}
    </AuthPage>
  );
}
