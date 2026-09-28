'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import type { CustomerProfile } from '@/lib/types';

// PUT /customer/profile/company: company, position, companyEmail, companyPhone, taxId.
export default function CustomerCompanyForm() {
  const { refresh } = useAuth();
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

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
  const [errors, setErrors] = useState<Record<string, string>>({});

  function fill(data: CustomerProfile) {
    setCompany(data.company || '');
    setPosition(data.position || '');
    setCompanyEmail(data.companyEmail || '');
    setCompanyPhone(data.companyPhone || '');
    setTaxId(data.taxId || '');
  }

  useEffect(() => {
    let active = true;
    api<CustomerProfile>('/customer/profile')
      .then((data) => {
        if (active) fill(data);
      })
      .catch((err) => {
        if (active) setLoadError(errorMessage(err, t('Gagal memuat profil perusahaan.', 'Failed to load company profile.')));
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
      const updated = await api<CustomerProfile>('/customer/profile/company', {
        method: 'PUT',
        body: { company, position, companyEmail: companyEmail || null, companyPhone: companyPhone || null, taxId: taxId || null },
      });
      fill(updated);
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

  if (loading) return <p className="form-note">{t('Memuat…', 'Loading…')}</p>;
  if (loadError) return <p className="form-error" role="alert">{loadError}</p>;

  const fieldError = (key: string) => (errors[key] ? <small className="form-error">{errors[key]}</small> : null);

  return (
    <div>
      <div className="acct-section-head">
        <div>
          <h2 className="h3">{t('Profil perusahaan', 'Company profile')}</h2>
          <p className="form-note">{t('Informasi legal dan kontak perusahaan untuk invoice.', 'Legal and contact details used on invoices.')}</p>
        </div>
      </div>
      <form className="form acct-form" onSubmit={handleSubmit}>
        <div className="co-fields">
          <label className="co-full">
            <span className="label">{t('Nama perusahaan', 'Company name')}</span>
            <input name="company" value={company} onChange={(e) => setCompany(e.target.value)} required maxLength={160} />
            {fieldError('company')}
          </label>
          <label>
            <span className="label">{t('Jabatan PIC', 'PIC position')}</span>
            <input name="position" value={position} onChange={(e) => setPosition(e.target.value)} maxLength={120} />
            {fieldError('position')}
          </label>
          <label>
            <span className="label">{t('Email perusahaan', 'Company email')}</span>
            <input name="companyEmail" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
            {fieldError('companyEmail')}
          </label>
          <label>
            <span className="label">{t('Telepon perusahaan', 'Company phone')}</span>
            <input name="companyPhone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} maxLength={40} inputMode="tel" />
            {fieldError('companyPhone')}
          </label>
          <label>
            <span className="label">NPWP</span>
            <input name="taxId" value={taxId} onChange={(e) => setTaxId(e.target.value)} maxLength={40} />
            {fieldError('taxId')}
          </label>
        </div>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? t('Menyimpan…', 'Saving…') : saved ? <>{t('Tersimpan', 'Saved')} <Icon name="check" /></> : <>{t('Simpan perusahaan', 'Save company')} <Icon name="arrow" /></>}
        </button>
      </form>
    </div>
  );
}
