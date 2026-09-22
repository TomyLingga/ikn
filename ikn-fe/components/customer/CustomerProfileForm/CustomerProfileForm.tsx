'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import { api, errorMessage } from '@/lib/api';
import type { CustomerProfile } from '@/lib/types';

export default function CustomerProfileForm() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form profil PIC.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Blok ganti password.
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<CustomerProfile>('/customer/profile')
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setName(data.name);
        setPhone(data.phone);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, 'Gagal memuat profil.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const updated = await api<CustomerProfile>('/customer/profile', {
        method: 'PUT',
        body: { name, phone },
      });
      setProfile(updated);
      setName(updated.name);
      setPhone(updated.phone);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordSaved(false);
    setPasswordError(null);
    if (newPassword !== confirmPassword) {
      setPasswordError('Konfirmasi password baru tidak sama.');
      return;
    }
    setPasswordSaving(true);
    try {
      await api<{ ok: boolean }>('/customer/profile/password', {
        method: 'PUT',
        body: { currentPassword, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
      window.setTimeout(() => setPasswordSaved(false), 2500);
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) return <p className="form-note">Memuat…</p>;
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>;
  if (!profile) return null;

  return (
    <div>
      <div className="acct-section-head"><div><h2 className="h3">Profil PIC</h2><p className="form-note">Data kontak utama untuk komunikasi pesanan.</p></div></div>
      <form className="form acct-form" onSubmit={handleSubmit}>
        <div className="co-fields">
          <label><span className="label">Nama lengkap</span><input name="name" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label><span className="label">Telepon</span><input name="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required /></label>
          <label className="co-full"><span className="label">Email</span><input name="email" type="email" value={profile.email} disabled readOnly /></label>
        </div>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? 'Menyimpan…' : saved ? <>Tersimpan <Icon name="check" /></> : <>Simpan perubahan <Icon name="arrow" /></>}
        </button>
      </form>

      <div className="acct-section-head" style={{ marginTop: 34 }}><div><h2 className="h3">Ganti password</h2><p className="form-note">Gunakan password yang kuat dan tidak dipakai di layanan lain.</p></div></div>
      <form className="form acct-form" onSubmit={handlePasswordSubmit}>
        <div className="co-fields">
          <label className="co-full"><span className="label">Password saat ini</span><input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" /></label>
          <label><span className="label">Password baru</span><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
          <label><span className="label">Konfirmasi password baru</span><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" /></label>
        </div>
        {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
        <button type="submit" className="btn btn-solid" disabled={passwordSaving}>
          {passwordSaving ? 'Menyimpan…' : passwordSaved ? <>Password diganti <Icon name="check" /></> : <>Ganti password <Icon name="arrow" /></>}
        </button>
      </form>
    </div>
  );
}
