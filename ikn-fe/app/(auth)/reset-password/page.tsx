'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import AuthPage, { authStyles as styles } from '@/components/auth';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, fieldErrors } from '@/lib/api';

// Reset password: `token` + `email` dari tautan email → POST /auth/password/reset → arahkan ke login.
function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const token = params.get('token') || '';
  const [email, setEmail] = useState(params.get('email') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setErrors({});
    try {
      await api('/auth/password/reset', {
        method: 'POST',
        body: { token, email, password, passwordConfirmation: confirm },
      });
      router.replace('/login?reset=1');
    } catch (err) {
      const fe = fieldErrors(err);
      setErrors(fe);
      setError(fe.token || errorMessage(err, t('Reset password gagal.', 'Password reset failed.')));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className={styles.loggedIn}>
        <p>{t('Tautan reset tidak lengkap. Minta tautan baru dari halaman lupa password.', 'The reset link is incomplete. Request a new one from the forgot password page.')}</p>
        <Link href="/forgot-password" className={styles.primaryButton}>
          {t('Minta tautan baru', 'Request a new link')} <Icon name="arrow" size={18} />
        </Link>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <p className={styles.error} role="alert"><Icon name="close" size={16} /> {error}</p>}
      <label className={styles.field}>
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        {errors.email && <small className="form-error">{errors.email}</small>}
      </label>
      <label className={styles.field}>
        <span>{t('Password baru', 'New password')}</span>
        <span className={styles.passwordField}>
          <input
            name="password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('Min. 8 karakter, huruf dan angka', 'Min. 8 characters, letters and numbers')}
          />
          <button type="button" onClick={() => setShow((v) => !v)}>{show ? t('Sembunyikan', 'Hide') : t('Lihat', 'Show')}</button>
        </span>
        {errors.password && <small className="form-error">{errors.password}</small>}
      </label>
      <label className={styles.field}>
        <span>{t('Ulangi password baru', 'Confirm new password')}</span>
        <input name="passwordConfirmation" type={show ? 'text' : 'password'} autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <button type="submit" className={styles.primaryButton} disabled={busy}>
        {busy ? t('Menyimpan…', 'Saving…') : t('Simpan password baru', 'Save new password')} <Icon name="arrow" size={18} />
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  return (
    <AuthPage
      eyebrow={t('Pemulihan akun', 'Account recovery')}
      title={t('Atur ulang password', 'Reset password')}
      lead={t('Buat password baru untuk akun Anda.', 'Create a new password for your account.')}
      footer={<Link href="/login">{t('Kembali ke login', 'Back to login')}</Link>}
    >
      <Suspense fallback={<p className={styles.loading}>{t('Memuat…', 'Loading…')}</p>}>
        <ResetForm />
      </Suspense>
    </AuthPage>
  );
}
