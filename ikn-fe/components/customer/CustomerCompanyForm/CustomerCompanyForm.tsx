'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import { api, errorMessage } from '@/lib/api';
import type { CustomerProfile } from '@/lib/types';

export default function CustomerCompanyForm() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [taxId, setTaxId] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api<CustomerProfile>('/customer/profile')
      .then((data) => {
        if (!active) return;
        setCompany(data.company);
        setPosition(data.position);
        setCompanyEmail(data.companyEmail);
        setCompanyPhone(data.companyPhone);
        setTaxId(data.taxId);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, 'Gagal memuat profil perusahaan.'));
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
      const updated = await api<CustomerProfile>('/customer/profile/company', {
        method: 'PUT',
        body: { company, position, companyEmail, companyPhone, taxId },
      });
      setCompany(updated.company);
      setPosition(updated.position);
      setCompanyEmail(updated.companyEmail);
      setCompanyPhone(updated.companyPhone);
      setTaxId(updated.taxId);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="form-note">Memuat…</p>;
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>;

  return (
    <div>
      <div className="acct-section-head"><div><h2 className="h3">Profil perusahaan</h2><p className="form-note">Informasi legal dan kontak perusahaan untuk invoice.</p></div></div>
      <form className="form acct-form" onSubmit={handleSubmit}>
        <div className="co-fields">
          <label className="co-full"><span className="label">Nama perusahaan</span><input name="company" value={company} onChange={(e) => setCompany(e.target.value)} required /></label>
          <label><span className="label">Jabatan PIC</span><input name="position" value={position} onChange={(e) => setPosition(e.target.value)} /></label>
          <label><span className="label">Email perusahaan</span><input name="companyEmail" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} required /></label>
          <label><span className="label">Telepon perusahaan</span><input name="companyPhone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} /></label>
          <label className="co-full"><span className="label">NPWP</span><input name="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} /></label>
        </div>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? 'Menyimpan…' : saved ? <>Tersimpan <Icon name="check" /></> : <>Simpan perusahaan <Icon name="arrow" /></>}
        </button>
      </form>
    </div>
  );
}
