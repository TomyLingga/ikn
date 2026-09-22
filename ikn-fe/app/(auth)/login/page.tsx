'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { ApiError, errorMessage } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import styles from './page.module.css';

type AuthMode = 'login' | 'registration';

function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginAdmin, loginCustomer, registerCustomer, customer, admin } = useAuth();
  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'register' ? 'registration' : 'login',
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
  }

  function safePath(path: string | null): string | null {
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  }

  const redirectParam = safePath(searchParams.get('redirect') || searchParams.get('next'));

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    try {
      // Coba sebagai customer dulu; bila kredensial bukan customer, coba admin.
      try {
        await loginCustomer(email, password);
        router.replace(redirectParam && !redirectParam.startsWith('/admin') ? redirectParam : '/dashboard');
        return;
      } catch (customerError) {
        if (!(customerError instanceof ApiError) || customerError.status !== 422) throw customerError;
        await loginAdmin(email, password);
        router.replace(redirectParam?.startsWith('/admin') ? redirectParam : '/admin');
      }
    } catch (err) {
      setError(errorMessage(err, 'Email atau kata sandi tidak sesuai.'));
      setBusy(false);
    }
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    const form = new FormData(event.currentTarget);
    try {
      await registerCustomer({
        name: String(form.get('name') || ''),
        company: String(form.get('company') || ''),
        email: String(form.get('email') || ''),
        phone: String(form.get('phone') || ''),
        password: String(form.get('password') || ''),
        confirmPassword: String(form.get('confirmPassword') || ''),
      });
      router.replace(redirectParam && !redirectParam.startsWith('/admin') ? redirectParam : '/dashboard');
    } catch (err) {
      setError(errorMessage(err, 'Registrasi gagal. Periksa kembali data Anda.'));
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="auth-title">
      <div className={styles.brand}>
        <Link href="/" aria-label="Kembali ke beranda PT IKN">
          <Image src="/img/rubin-logo.png" alt="PT IKN" width={48} height={48} priority />
        </Link>
        <div>
          <strong>PT Industri Karet Nusantara</strong>
          <span>Selamat datang</span>
        </div>
      </div>

      {(customer || admin) ? (
        <div className={styles.loggedIn}>
          <p>Anda sudah login sebagai <strong>{customer?.name || admin?.name}</strong></p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => router.replace(admin ? '/admin' : '/dashboard')}
          >
            Ke Dashboard <Icon name="arrow" size={18} />
          </button>
        </div>
      ) : (
        <>

      <div className={styles.heading}>
        <span className={styles.eyebrow}>{mode === 'login' ? 'Masuk ke akun' : 'Buat akun baru'}</span>
        <h1 id="auth-title">{mode === 'login' ? 'Login' : 'Buat akun'}</h1>
        <p>
          {mode === 'login'
            ? 'Masukkan email dan kata sandi untuk melanjutkan.'
            : 'Daftarkan perusahaan Anda untuk mulai memesan produk PT IKN secara online.'}
        </p>
      </div>

      {mode === 'login' ? (
        <form className={styles.form} onSubmit={handleLogin}>
          {redirectParam && (
            <div className={styles.redirectNote}>
              <Icon name="shieldCheck" size={18} />
              <span>Silakan login untuk melanjutkan.</span>
            </div>
          )}

          {error && <p className={styles.error} role="alert"><Icon name="close" size={16} /> {error}</p>}

          <label className={styles.field}>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required placeholder="nama@perusahaan.com" />
          </label>

          <label className={styles.field}>
            <span>Kata sandi</span>
            <span className={styles.passwordField}>
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="Masukkan kata sandi"
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? 'Sembunyikan' : 'Lihat'}
              </button>
            </span>
          </label>

          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? 'Memproses…' : 'Login'} <Icon name="arrow" size={18} />
          </button>
        </form>
      ) : (
        <form className={styles.form} onSubmit={handleRegistration}>
          {error && <p className={styles.error} role="alert"><Icon name="close" size={16} /> {error}</p>}

          <label className={styles.field}>
            <span>Nama lengkap (PIC)</span>
            <input name="name" type="text" autoComplete="name" required placeholder="Nama penanggung jawab" />
          </label>
          <label className={styles.field}>
            <span>Nama perusahaan</span>
            <input name="company" type="text" autoComplete="organization" required placeholder="PT Nama Perusahaan" />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input name="email" type="email" autoComplete="email" required placeholder="nama@perusahaan.com" />
          </label>
          <label className={styles.field}>
            <span>Nomor telepon</span>
            <input name="phone" type="tel" autoComplete="tel" placeholder="+62" />
          </label>
          <label className={styles.field}>
            <span>Kata sandi</span>
            <input name="password" type="password" autoComplete="new-password" required minLength={8} placeholder="Minimal 8 karakter" />
          </label>
          <label className={styles.field}>
            <span>Ulangi kata sandi</span>
            <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} placeholder="Ketik ulang kata sandi" />
          </label>

          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? 'Mendaftarkan…' : 'Daftar & mulai belanja'} <Icon name="arrow" size={18} />
          </button>
        </form>
      )}

      <p className={styles.modeSwitch}>
        {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}{' '}
        <button type="button" onClick={() => changeMode(mode === 'login' ? 'registration' : 'login')}>
          {mode === 'login' ? 'Daftar' : 'Kembali ke Login'}
        </button>
      </p>
        </>
      )}
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>
        <Icon name="arrow" size={16} /> Kembali ke situs
      </Link>
      <div className={styles.themeCorner}>
        <ThemeToggle />
      </div>
      <Suspense fallback={<p className={styles.loading}>Memuat…</p>}>
        <AuthCard />
      </Suspense>
    </main>
  );
}
