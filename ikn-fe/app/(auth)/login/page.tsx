'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage, fieldErrors } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';
import AuthVisual from '@/components/auth/AuthVisual';
import PasswordChecklist from '@/components/PasswordChecklist';
import { confirmError, emailError, isEmail, isPhone, isStrongPassword, passwordError, phoneError, validationText } from '@/lib/validation';
import PhoneInput from '@/components/PhoneInput';
import styles from './page.module.css';

type AuthMode = 'login' | 'registration';

interface Notice {
  tone: 'ok' | 'warn' | 'bad';
  text: string;
  /** Tampilkan tombol kirim ulang verifikasi untuk email ini. */
  resendEmail?: string;
}

function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginAdmin, loginCustomer, registerCustomer, customer, admin } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [mode, setMode] = useState<AuthMode>(searchParams.get('mode') === 'register' ? 'registration' : 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  // Nilai terkontrol untuk validasi langsung (format email, nomor HP, kekuatan & konfirmasi kata sandi).
  const [values, setValues] = useState({ loginEmail: '', email: '', phone: '', password: '', confirm: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const setValue = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: event.target.value }));
  const touch = (key: string) => () => setTouched((t) => ({ ...t, [key]: true }));
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [registered, setRegistered] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [notice, setNotice] = useState<Notice | null>(() => {
    const verified = searchParams.get('verified');
    if (verified === '1') return { tone: 'ok', text: t('Email berhasil diverifikasi. Silakan login; akun Anda menunggu persetujuan admin.', 'Email verified. Please log in; your account is awaiting admin approval.') };
    if (verified === '0') return { tone: 'bad', text: t('Tautan verifikasi tidak valid atau sudah kedaluwarsa. Login untuk meminta tautan baru.', 'The verification link is invalid or has expired. Log in to request a new one.') };
    if (searchParams.get('reset') === '1') return { tone: 'ok', text: t('Password berhasil diubah. Silakan login dengan password baru.', 'Password updated. Please log in with your new password.') };
    return null;
  });

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setErrors({});
    // Simpan mode di URL tanpa navigasi agar muat ulang/bagikan tautan tetap di form yang sama.
    const url = new URL(window.location.href);
    if (nextMode === 'registration') url.searchParams.set('mode', 'register');
    else url.searchParams.delete('mode');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }

  function safePath(path: string | null): string | null {
    return path && path.startsWith('/') && !path.startsWith('//') ? path : null;
  }

  const redirectParam = safePath(searchParams.get('redirect') || searchParams.get('next'));

  async function resendVerification(email: string) {
    if (resendState === 'sending' || !email) return;
    setResendState('sending');
    try {
      await api('/auth/verification/resend', { method: 'POST', body: { email } });
      setResendState('sent');
    } catch (err) {
      setResendState('idle');
      setError(errorMessage(err));
    }
  }

  function describeLoginError(err: unknown, email: string): Notice | null {
    if (!(err instanceof ApiError) || err.status !== 403) return null;
    if (err.code === 'EMAIL_NOT_VERIFIED') {
      return {
        tone: 'warn',
        text: t('Email Anda belum diverifikasi. Buka tautan di email pendaftaran atau kirim ulang.', 'Your email is not verified yet. Open the link in the registration email or resend it.'),
        resendEmail: email,
      };
    }
    if (err.code === 'ACCOUNT_NOT_APPROVED') {
      const status = String(err.meta?.status || '');
      if (status === 'rejected') {
        return { tone: 'bad', text: t('Pendaftaran akun Anda ditolak. Hubungi tim kami untuk informasi lebih lanjut.', 'Your account registration was rejected. Contact our team for more information.') };
      }
      if (status === 'inactive') {
        return { tone: 'bad', text: t('Akun Anda dinonaktifkan. Hubungi tim kami untuk mengaktifkan kembali.', 'Your account is inactive. Contact our team to reactivate it.') };
      }
      return { tone: 'warn', text: t('Akun Anda masih menunggu persetujuan admin.', 'Your account is awaiting admin approval.') };
    }
    return null;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice(null);
    setResendState('idle');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    if (!isEmail(email)) {
      setTouched((t) => ({ ...t, loginEmail: true }));
      setBusy(false);
      return;
    }

    try {
      // Coba sebagai customer dulu; bila kredensial bukan customer (422), coba admin.
      try {
        await loginCustomer(email, password, remember);
        router.replace(redirectParam && !redirectParam.startsWith('/admin') ? redirectParam : '/dashboard');
        return;
      } catch (customerError) {
        const described = describeLoginError(customerError, email);
        if (described) {
          setNotice(described);
          setBusy(false);
          return;
        }
        if (!(customerError instanceof ApiError) || customerError.status !== 422) throw customerError;
        await loginAdmin(email, password, remember);
        router.replace(redirectParam?.startsWith('/admin') ? redirectParam : '/admin');
      }
    } catch (err) {
      setError(errorMessage(err, t('Email atau kata sandi tidak sesuai.', 'Incorrect email or password.')));
      setBusy(false);
    }
  }

  async function handleRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setErrors({});

    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) || '').trim();
    const email = value('email');
    const phone = values.phone.trim(); // dari PhoneInput: E.164, mis. +6281234567890
    const password = String(form.get('password') || '');
    const confirm = String(form.get('passwordConfirmation') || '');
    if (!isEmail(email) || (phone && !isPhone(phone)) || !isStrongPassword(password) || password !== confirm) {
      setTouched({ email: true, phone: true, password: true, confirm: true });
      setError(t('Periksa kembali isian yang ditandai merah.', 'Please check the fields marked in red.'));
      setBusy(false);
      return;
    }
    try {
      await registerCustomer({
        name: value('name'),
        email,
        password: String(form.get('password') || ''),
        passwordConfirmation: String(form.get('passwordConfirmation') || ''),
        phone: phone || undefined,
        company: value('company') || undefined,
        position: value('position') || undefined,
        taxId: value('taxId') || undefined,
      });
      setRegistered(email);
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err, t('Registrasi gagal. Periksa kembali data Anda.', 'Registration failed. Please check your details.')));
    } finally {
      setBusy(false);
    }
  }

  const fieldError = (key: string) => (errors[key] ? <small className={styles.fieldError}>{errors[key]}</small> : null);
  // Error klien (setelah field disentuh) didahulukan; error server tampil bila tidak ada error klien.
  const liveError = (key: string, message: string) =>
    touched[key] && message ? (
      <small className={styles.fieldError} role="alert">
        {message}
      </small>
    ) : null;
  const loginEmailError = emailError(values.loginEmail, lang);
  const regEmailError = emailError(values.email, lang);
  const regPhoneError = phoneError(values.phone, lang);
  const regPasswordError = passwordError(values.password, lang);
  const regConfirmError = confirmError(values.password, values.confirm, lang);

  const showRegister = mode === 'registration' && !registered && !(customer || admin);

  return (
    <section className={`${styles.card} ${showRegister ? styles.isRegister : ''}`} aria-labelledby="auth-title">
      <div className={styles.formPane}>
        <div className={styles.themeCorner}>
          <ThemeToggle />
        </div>
        <div className={styles.formInner} key={registered ? 'done' : mode}>
      {(customer || admin) ? (
        <div className={styles.loggedIn}>
          <p>{t('Anda sudah login sebagai', 'You are logged in as')} <strong>{customer?.name || admin?.name}</strong></p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => router.replace(admin ? '/admin' : redirectParam && !redirectParam.startsWith('/admin') ? redirectParam : '/dashboard')}
          >
            {t('Ke Dashboard', 'Go to dashboard')} <Icon name="arrow" size={18} />
          </button>
        </div>
      ) : registered ? (
        <div className={styles.success}>
          <Icon name="mail" size={36} />
          <h2>{t('Cek email Anda', 'Check your email')}</h2>
          <p>
            {t(
              `Kami mengirim tautan verifikasi ke ${registered}. Tautan berlaku 60 menit. Setelah verifikasi, akun Anda menunggu persetujuan admin sebelum bisa memesan.`,
              `We sent a verification link to ${registered}. The link is valid for 60 minutes. After verification, your account awaits admin approval before you can order.`,
            )}
          </p>
          <p style={{ marginTop: 14 }}>
            {resendState === 'sent' ? (
              <span className={styles.notice}>{t('Email verifikasi dikirim ulang.', 'Verification email resent.')}</span>
            ) : (
              <button type="button" className={styles.linkButton} onClick={() => resendVerification(registered)} disabled={resendState === 'sending'}>
                {resendState === 'sending' ? t('Mengirim…', 'Sending…') : t('Tidak menerima email? Kirim ulang', "Didn't get the email? Resend")}
              </button>
            )}
          </p>
          <button type="button" className={styles.primaryButton} style={{ marginTop: 18 }} onClick={() => { setRegistered(null); changeMode('login'); }}>
            {t('Ke halaman login', 'Go to login')} <Icon name="arrow" size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>{mode === 'login' ? t('Portal customer', 'Customer portal') : t('Akun perusahaan baru', 'New company account')}</span>
            <h1 id="auth-title">{mode === 'login' ? t('Selamat datang kembali', 'Welcome back') : t('Buat akun', 'Create an account')}</h1>
            <p>
              {mode === 'login'
                ? t('Masuk untuk memesan, membayar, dan melacak pesanan Anda.', 'Sign in to order, pay, and track your orders.')
                : t('Daftarkan perusahaan Anda untuk mulai memesan produk PT IKN secara online.', 'Register your company to start ordering PT IKN products online.')}
            </p>
          </div>

          <p className={styles.modeSwitch}>
            {mode === 'login' ? t('Belum punya akun?', "Don't have an account?") : t('Sudah punya akun?', 'Already have an account?')}{' '}
            <button type="button" onClick={() => changeMode(mode === 'login' ? 'registration' : 'login')}>
              {mode === 'login' ? t('Daftar sekarang', 'Register now') : t('Masuk', 'Log in')}
            </button>
          </p>

          {notice && (
            <div className={`${styles.notice} ${styles[`notice_${notice.tone}`]}`} role="status">
              <Icon name={notice.tone === 'ok' ? 'check' : notice.tone === 'bad' ? 'cancelCircle' : 'shieldCheck'} size={18} />
              <span>
                {notice.text}
                {notice.resendEmail && (
                  <>
                    {' '}
                    {resendState === 'sent' ? (
                      <strong>{t('Email verifikasi dikirim.', 'Verification email sent.')}</strong>
                    ) : (
                      <button type="button" className={styles.linkButton} onClick={() => resendVerification(notice.resendEmail || '')} disabled={resendState === 'sending'}>
                        {resendState === 'sending' ? t('Mengirim…', 'Sending…') : t('Kirim ulang email verifikasi', 'Resend verification email')}
                      </button>
                    )}
                  </>
                )}
              </span>
            </div>
          )}

          {mode === 'login' ? (
            <form className={styles.form} onSubmit={handleLogin}>
              {redirectParam && !notice && (
                <div className={styles.redirectNote}>
                  <Icon name="shieldCheck" size={18} />
                  <span>{t('Silakan login untuk melanjutkan.', 'Please log in to continue.')}</span>
                </div>
              )}

              {error && <p className={styles.error} role="alert"><Icon name="close" size={16} /> {error}</p>}

              <label className={styles.field}>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama@perusahaan.com"
                  value={values.loginEmail}
                  onChange={setValue('loginEmail')}
                  onBlur={touch('loginEmail')}
                  aria-invalid={touched.loginEmail && !!loginEmailError}
                  className={touched.loginEmail && loginEmailError ? styles.invalid : undefined}
                />
                {liveError('loginEmail', loginEmailError)}
              </label>

              <label className={styles.field}>
                <span>{t('Kata sandi', 'Password')}</span>
                <span className={styles.passwordField}>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder={t('Masukkan kata sandi', 'Enter your password')}
                  />
                  <button
                    type="button"
                    className={styles.eyeButton}
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t('Sembunyikan kata sandi', 'Hide password') : t('Lihat kata sandi', 'Show password')}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                </span>
              </label>

              <div className={styles.formRowBetween}>
                <label className={styles.remember}>
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <span>{t('Ingat saya', 'Remember me')}</span>
                </label>
                <Link href="/forgot-password" className={styles.subtleLink}>{t('Lupa password?', 'Forgot password?')}</Link>
              </div>

              <button type="submit" className={styles.primaryButton} disabled={busy}>
                {busy ? t('Memproses…', 'Processing…') : t('Masuk', 'Log in')} <Icon name="arrow" size={18} />
              </button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={handleRegistration}>
              {error && <p className={styles.error} role="alert"><Icon name="close" size={16} /> {error}</p>}

              <label className={styles.field}>
                <span>{t('Nama lengkap (PIC)', 'Full name (PIC)')}</span>
                <input name="name" type="text" autoComplete="name" required maxLength={120} placeholder={t('Nama penanggung jawab', 'Person in charge')} />
                {fieldError('name')}
              </label>
              <label className={styles.field}>
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="nama@perusahaan.com"
                  value={values.email}
                  onChange={setValue('email')}
                  onBlur={touch('email')}
                  aria-invalid={touched.email && !!regEmailError}
                  className={touched.email && regEmailError ? styles.invalid : undefined}
                />
                {liveError('email', regEmailError) || fieldError('email')}
              </label>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>{t('Nama perusahaan', 'Company name')}</span>
                  <input name="company" type="text" autoComplete="organization" maxLength={160} placeholder="PT Nama Perusahaan" />
                  {fieldError('company')}
                </label>
                <label className={styles.field}>
                  <span>{t('Jabatan', 'Position')}</span>
                  <input name="position" type="text" autoComplete="organization-title" maxLength={120} placeholder={t('Procurement, Purchasing…', 'Procurement, Purchasing…')} />
                  {fieldError('position')}
                </label>
              </div>
              <div className={styles.twoCol}>
                <label className={styles.field}>
                  <span>{t('Nomor telepon', 'Phone number')}</span>
                  <PhoneInput
                    name="phoneNational"
                    variant="filled"
                    value={values.phone}
                    onChange={(phone) => setValues((v) => ({ ...v, phone }))}
                    onBlur={touch('phone')}
                    invalid={touched.phone && !!regPhoneError}
                  />
                  {liveError('phone', regPhoneError) || fieldError('phone')}
                </label>
                <label className={styles.field}>
                  <span>NPWP</span>
                  <input name="taxId" type="text" maxLength={40} placeholder="00.000.000.0-000.000" />
                  {fieldError('taxId')}
                </label>
              </div>
              <label className={styles.field}>
                <span>{t('Kata sandi', 'Password')}</span>
                <span className={styles.passwordField}>
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder={t('Min. 8 karakter: huruf besar, kecil, dan angka', 'Min. 8 characters: upper, lower and a number')}
                    value={values.password}
                    onChange={setValue('password')}
                    onBlur={touch('password')}
                    aria-invalid={touched.password && !!regPasswordError}
                    className={touched.password && regPasswordError ? styles.invalid : undefined}
                  />
                  <button
                    type="button"
                    className={styles.eyeButton}
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? t('Sembunyikan kata sandi', 'Hide password') : t('Lihat kata sandi', 'Show password')}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} />
                  </button>
                </span>
                {values.password && <PasswordChecklist value={values.password} />}
                {fieldError('password')}
              </label>
              <label className={styles.field}>
                <span>{t('Ulangi kata sandi', 'Confirm password')}</span>
                <input
                  name="passwordConfirmation"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder={t('Ketik ulang kata sandi', 'Re-type your password')}
                  value={values.confirm}
                  onChange={setValue('confirm')}
                  aria-invalid={!!regConfirmError}
                  className={regConfirmError ? styles.invalid : values.confirm && !regConfirmError ? styles.valid : undefined}
                />
                {regConfirmError ? (
                  <small className={styles.fieldError} role="alert">
                    {regConfirmError}
                  </small>
                ) : values.confirm ? (
                  <small className={styles.fieldOk}>✓ {validationText.confirmOk[lang]}</small>
                ) : (
                  fieldError('passwordConfirmation')
                )}
              </label>

              <p className={styles.hint}>
                {t(
                  'Setelah mendaftar, verifikasi email Anda. Akun baru bisa memesan setelah disetujui admin.',
                  'After registering, verify your email. New accounts can order once approved by an admin.',
                )}
              </p>

              <button type="submit" className={styles.primaryButton} disabled={busy}>
                {busy ? t('Mendaftarkan…', 'Registering…') : t('Buat akun', 'Create account')} <Icon name="arrow" size={18} />
              </button>
            </form>
          )}

        </>
      )}
        </div>
      </div>
      <AuthVisual />
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={<p className={styles.loading}>Memuat…</p>}>
        <AuthCard />
      </Suspense>
    </main>
  );
}
