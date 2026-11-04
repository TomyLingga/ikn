'use client';

import { useEffect, useState } from 'react';
import { emailError } from '@/lib/validation';
import type { FormEvent } from 'react';
import Icon from '@/components/Icon';
import Select from '@/components/Select';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { countryName, DEFAULT_COUNTRY, useCountries } from '@/lib/countries';
import type { CustomerProfile } from '@/lib/types';

// PUT /customer/profile/company: company, position, companyEmail, companyPhone, taxId, companyAddress, countryCode.
// Negara dan alamat perusahaan hanya bisa diubah selagi akun pending (ASUMSI A-86); setelah itu tampil baca-saja
// dan perubahan ditolak server (422) karena pasar sudah dikunci admin.
export default function CustomerCompanyForm() {
  const { refresh } = useAuth();
  const { lang } = useLang();
  const { countries } = useCountries();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [taxId, setTaxId] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY);
  const [companyAddress, setCompanyAddress] = useState('');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function fill(data: CustomerProfile) {
    setProfile(data);
    setCompany(data.company || '');
    setPosition(data.position || '');
    setCompanyEmail(data.companyEmail || '');
    setCompanyPhone(data.companyPhone || '');
    setTaxId(data.taxId || '');
    setCountryCode(data.countryCode || DEFAULT_COUNTRY);
    setCompanyAddress(data.companyAddress || '');
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

  const locked = !!profile && profile.status !== 'pending';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    setErrors({});
    try {
      const updated = await api<CustomerProfile>('/customer/profile/company', {
        method: 'PUT',
        body: {
          company,
          position,
          companyEmail: companyEmail || null,
          companyPhone: companyPhone || null,
          taxId: taxId || null,
          // Setelah pasar dikunci, negara/alamat tidak dikirim agar tidak ditolak 422 bila nilainya berubah.
          ...(locked ? {} : { countryCode, companyAddress: companyAddress.trim() || null }),
        },
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
  const marketLabel = profile?.market === 'export' ? t('Ekspor (USD)', 'Export (USD)') : t('Lokal (IDR)', 'Local (IDR)');

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
            <input name="companyEmail" type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} aria-invalid={!!emailError(companyEmail, lang)} />
            {emailError(companyEmail, lang) && <small className="form-error" role="alert">{emailError(companyEmail, lang)}</small>}
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
          <label>
            <span className="label">{t('Negara', 'Country')}</span>
            {locked ? (
              <input value={countryName(countryCode, lang, countries)} readOnly aria-readonly="true" />
            ) : (
              <Select name="countryCode" value={countryCode} onChange={(e) => setCountryCode(e.target.value)} searchPlaceholder={t('Cari negara', 'Search country')}>
                {(countries.length > 0 ? countries : [{ code: countryCode, name: { id: countryCode, en: countryCode } }]).map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name[lang] || c.name.id}
                  </option>
                ))}
              </Select>
            )}
            {fieldError('countryCode')}
          </label>
          <label className="co-full">
            <span className="label">{t('Alamat perusahaan', 'Company address')}</span>
            <textarea
              name="companyAddress"
              className="co-textarea"
              rows={2}
              maxLength={500}
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              readOnly={locked}
              aria-readonly={locked ? 'true' : undefined}
              placeholder={t('Jalan, kota, kode pos (dipakai pada dokumen pesanan ekspor)', 'Street, city, postal code (used on export order documents)')}
            />
            {fieldError('companyAddress')}
          </label>
        </div>
        <p className="form-note" style={{ marginTop: 8 }}>
          {locked
            ? t(
                `Pasar akun Anda: ${marketLabel}. Negara dan alamat perusahaan dikunci setelah akun disetujui; hubungi kami bila perlu diubah.`,
                `Your account market: ${marketLabel}. Country and company address are locked once the account is approved; contact us to change them.`,
              )
            : t(
                'Negara dan alamat perusahaan masih bisa diubah sampai akun disetujui. Admin menentukan pasar (lokal atau ekspor) dari negara ini.',
                'Country and company address can be changed until the account is approved. The admin sets the market (local or export) from this country.',
              )}
        </p>
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <button type="submit" className="btn btn-solid" disabled={saving}>
          {saving ? t('Menyimpan…', 'Saving…') : saved ? <>{t('Tersimpan', 'Saved')} <Icon name="check" /></> : <>{t('Simpan perusahaan', 'Save company')} <Icon name="arrow" /></>}
        </button>
      </form>
    </div>
  );
}
