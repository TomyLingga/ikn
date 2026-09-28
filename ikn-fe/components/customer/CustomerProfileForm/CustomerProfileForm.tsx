'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { accountStatusLabels } from '@/lib/commerce';
import { formatDateTime } from '@/lib/format';
import type { CustomerProfile } from '@/lib/types';

export default function CustomerProfileForm() {
  const { refresh } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form profil PIC (PUT /customer/profile: name, phone).
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Ganti password (PUT /customer/profile/password: currentPassword, password, passwordConfirmation).
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    api<CustomerProfile>('/customer/profile')
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setName(data.name || '');
        setPhone(data.phone || '');
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, t('Gagal memuat profil.', 'Failed to load profile.')));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setErrors({});
    try {
      const updated = await api<CustomerProfile>('/customer/profile', {
        method: 'PUT',
        body: { name, phone },
      });
      setProfile(updated);
      setName(updated.name || '');
      setPhone(updated.phone || '');
      setSaved(true);
      void refresh();
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setErrors(fieldErrors(err));
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaved(false);
    setPasswordError(null);
    setPasswordErrors({});
    if (newPassword !== confirmPassword) {
      setPasswordError(t('Konfirmasi password baru tidak sama.', 'New password confirmation does not match.'));
      return;
    }
    setPasswordSaving(true);
    try {
      await api('/customer/profile/password', {
        method: 'PUT',
        body: { currentPassword, password: newPassword, passwordConfirmation: confirmPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      window.setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordErrors(fieldErrors(err));
      setPasswordError(errorMessage(err));
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) return <p className="form-note">{t('Memuat…', 'Loading…')}</p>;
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>;
  if (!profile) return null;

  const status = accountStatusLabels[profile.status];

  return (
    <div>
      <div className="acct-section-head">
        <div>
          <h2 className="h3">{t('Profil PIC', 'PIC profile')}</h2>
          <p className="form-note">{t('Data kontak utama untuk komunikasi pesanan.', 'Primary contact for order communication.')}</p>
        </div>
        <div className="acct-status-meta">
          <StatusBadge label={status[lang] || status.id} tone={status.tone} small />
          {profile.approvedAt && <small>{t('Disetujui', 'Approved')} {formatDateTime(profile.approvedAt, lang)}</small>}
        </div>
      </div>
      {profile.status === 'rejected' && profile.rejectionReason && (
        <p className="form-error" style={{ marginBottom: 16 }}>{t('Alasan penolakan', 'Rejection reason')}: {profile.rejectionReason}</p>
      )}
      <form className="form acct-form" onSubmit={handleSubmit}>
        <div className="co-fields">
          <label>
            <span className="label">{t('Nama lengkap', 'Full name')}</span>
            <input name="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            {errors.name && <small className="form-error">{errors.name}</small>}
          </label>
          <label>
            <span className="label">{t('Telepon', 'Phone')}</span>
            <input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" />
            {errors.phone && <small className="form-error">{errors.phone}</small>}
          </label>
          <label className="co-full">
            <span className="label">Email</span>
            <input name="email" type="email" value={profile.email} disabled readOnly />
            <small className="form-note">{profile.emailVerifiedAt ? `${t('Terverifikasi', 'Verified')} ${formatDateTime(profile.emailVerifiedAt, lang)}` : t('Belum terverifikasi', 'Not verified')}</small>
          </label>
        </div>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? t('Menyimpan…', 'Saving…') : saved ? <>{t('Tersimpan', 'Saved')} <Icon name="check" /></> : <>{t('Simpan perubahan', 'Save changes')} <Icon name="arrow" /></>}
        </button>
      </form>

      <div className="acct-section-head" style={{ marginTop: 34 }}>
        <div>
          <h2 className="h3">{t('Ganti password', 'Change password')}</h2>
          <p className="form-note">{t('Minimal 8 karakter, mengandung huruf dan angka.', 'At least 8 characters with letters and numbers.')}</p>
        </div>
      </div>
      <form className="form acct-form" onSubmit={handlePasswordSubmit}>
        <div className="co-fields">
          <label className="co-full">
            <span className="label">{t('Password saat ini', 'Current password')}</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
            {passwordErrors.currentPassword && <small className="form-error">{passwordErrors.currentPassword}</small>}
          </label>
          <label>
            <span className="label">{t('Password baru', 'New password')}</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            {passwordErrors.password && <small className="form-error">{passwordErrors.password}</small>}
          </label>
          <label>
            <span className="label">{t('Konfirmasi password baru', 'Confirm new password')}</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
        </div>
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        <button type="submit" className="btn btn-solid" disabled={passwordSaving}>
          {passwordSaving ? t('Menyimpan…', 'Saving…') : passwordSaved ? <>{t('Password diganti', 'Password changed')} <Icon name="check" /></> : <>{t('Ganti password', 'Change password')} <Icon name="arrow" /></>}
        </button>
      </form>
    </div>
  );
}
