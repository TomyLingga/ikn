'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AdminCard, AdminPageHead } from '@/components/admin/AdminPage';
import { ColorInput, I18nInput, ListField, MediaPicker, firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { SiteSettings, WhatsAppContact, AuthSlide } from '@/lib/cms';
import { THEME_DEFAULTS, THEME_VARIABLES, themeColor, type ThemeSettings } from '@/lib/theme';

type CompanyPatch = Partial<SiteSettings['company']>;
type SitePatch = Partial<SiteSettings['site']>;
type SeoPatch = Partial<SiteSettings['seo']>;
type ContactPatch = Partial<NonNullable<SiteSettings['contact']>>;
type AnalyticsPatch = Partial<NonNullable<SiteSettings['analytics']>>;
type ThemePatch = Partial<ThemeSettings>;

const emptyContact = { whatsapp: '', whatsapp_message: { id: '', en: '' }, whatsapp_contacts: [] as WhatsAppContact[] };
const emptyAnalytics = { ga_measurement_id: '', gsc_verification: '' };
const emptyTheme: ThemeSettings = { ...THEME_DEFAULTS };
const THEME_KEYS = Object.keys(THEME_VARIABLES) as (keyof ThemeSettings)[];

// Site settings (GET/PUT /admin/site-settings): company identity, footer texts, default SEO.
export default function AdminSiteSettings() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setSettings(await api<SiteSettings>('/admin/site-settings'));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Pratinjau langsung: warna tema di form dipasang ke --theme-* pada <html> (mengalahkan style dari server);
  // nilai kosong/tidak valid dipratinjau sebagai bawaan. Saat halaman ditinggalkan, kembali ke nilai tersimpan.
  const previewTheme = settings?.theme;
  useEffect(() => {
    if (!previewTheme) return;
    const root = document.documentElement;
    for (const key of THEME_KEYS) root.style.setProperty(THEME_VARIABLES[key], themeColor(previewTheme, key));
    return () => {
      for (const key of THEME_KEYS) root.style.removeProperty(THEME_VARIABLES[key]);
    };
  }, [previewTheme]);

  const patchCompany = (patch: CompanyPatch) =>
    setSettings((current) => (current ? { ...current, company: { ...current.company, ...patch } } : current));
  const patchSite = (patch: SitePatch) =>
    setSettings((current) => (current ? { ...current, site: { ...current.site, ...patch } } : current));
  const patchSeo = (patch: SeoPatch) =>
    setSettings((current) => (current ? { ...current, seo: { ...current.seo, ...patch } } : current));
  const patchContact = (patch: ContactPatch) =>
    setSettings((current) => (current ? { ...current, contact: { ...(current.contact ?? emptyContact), ...patch } } : current));
  const patchAnalytics = (patch: AnalyticsPatch) =>
    setSettings((current) => (current ? { ...current, analytics: { ...(current.analytics ?? emptyAnalytics), ...patch } } : current));
  const patchTheme = (patch: ThemePatch) =>
    setSettings((current) => (current ? { ...current, theme: { ...(current.theme ?? emptyTheme), ...patch } } : current));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || saving) return;
    setSaving(true);
    setError('');
    setErrors({});
    try {
      const saved = await api<SiteSettings>('/admin/site-settings', {
        method: 'PUT',
        body: {
          company: { ...settings.company, profile_document: settings.company.profile_document?.id ?? null },
          site: settings.site,
          seo: settings.seo,
          contact: settings.contact ?? emptyContact,
          analytics: settings.analytics ?? emptyAnalytics,
          theme: settings.theme ?? emptyTheme,
          auth: { slides: (settings.auth?.slides ?? []).filter((s) => s.media?.id).map((s) => ({ mediaId: s.media.id, caption: s.caption })) },
        },
      });
      setSettings(saved);
      setNotice(t('Pengaturan situs tersimpan.', 'Site settings saved.'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setErrors(err.errors);
        setError(err.message);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="admin-empty">{t('Memuat pengaturan...', 'Loading settings...')}</div>;

  if (!settings) {
    return (
      <div>
        <AdminPageHead title={t('Pengaturan Situs', 'Site Settings')} />
        <p className="form-error">{error || t('Pengaturan tidak dapat dimuat.', 'Settings could not be loaded.')}</p>
      </div>
    );
  }

  const theme = settings.theme ?? emptyTheme;
  const themeField = (key: keyof ThemeSettings, label: string, hint: string) => (
    <label>
      <span className="field-label">{label}</span>
      <ColorInput
        value={theme[key] ?? ''}
        onChange={(value) => patchTheme({ [key]: value })}
        label={label}
        fallback={THEME_DEFAULTS[key]}
        placeholder={t('kosong = bawaan', 'empty = default')}
      />
      <small className="admin-field-hint">{hint}</small>
      {firstError(errors, `theme.${key}`) && <small className="cms-field-error">{firstError(errors, `theme.${key}`)}</small>}
    </label>
  );

  const textField = (label: string, key: 'name' | 'short' | 'parent' | 'since' | 'location') => (
    <label>
      <span className="field-label">{label}</span>
      <input value={settings.company[key]} onChange={(e) => patchCompany({ [key]: e.target.value })} maxLength={200} />
      {firstError(errors, `company.${key}`) && <small className="cms-field-error">{firstError(errors, `company.${key}`)}</small>}
    </label>
  );

  return (
    <div>
      <AdminPageHead
        title={t('Pengaturan Situs', 'Site Settings')}
        desc={t('Identitas perusahaan, teks footer, SEO bawaan, kanal chat, dan tema warna situs.', 'Company identity, footer texts, default SEO, chat channel, and the site colour theme.')}
      />

      {notice && (
        <div className="admin-toast" role="status">
          {notice}
        </div>
      )}
      {error && <p className="form-error">{error}</p>}

      <form onSubmit={(event) => void submit(event)} style={{ display: 'grid', gap: 22 }}>
        <AdminCard title={t('Perusahaan', 'Company')}>
          <div className="admin-form">
            <div className="admin-form-row">
              {textField(t('Nama perusahaan', 'Company name'), 'name')}
              {textField(t('Nama singkat', 'Short name'), 'short')}
            </div>
            <div className="admin-form-row">
              {textField(t('Induk perusahaan', 'Parent company'), 'parent')}
              {textField(t('Berdiri sejak', 'Established'), 'since')}
            </div>
            {textField(t('Lokasi', 'Location'), 'location')}
            <I18nInput
              label={t('Tagline', 'Tagline')}
              value={settings.company.tagline}
              onChange={(tagline) => patchCompany({ tagline })}
              maxLength={300}
              errorId={firstError(errors, 'company.tagline.id', 'company.tagline')}
              errorEn={firstError(errors, 'company.tagline.en')}
            />
            <MediaPicker
              label={t('Dokumen profil perusahaan (PDF)', 'Company profile document (PDF)')}
              value={settings.company.profile_document}
              onChange={(profile_document) => patchCompany({ profile_document })}
              accept="document"
              collection="documents"
              hint={t('Dibuka dari tombol "Profil perusahaan" di situs.', 'Opened from the "Company profile" button on the site.')}
              error={firstError(errors, 'company.profile_document')}
            />
          </div>
        </AdminCard>

        <AdminCard title={t('Footer situs', 'Site footer')}>
          <div className="admin-form">
            <I18nInput
              label={t('Judul footer', 'Footer headline')}
              value={settings.site.footer_headline}
              onChange={(footer_headline) => patchSite({ footer_headline })}
              maxLength={200}
              errorId={firstError(errors, 'site.footer_headline.id', 'site.footer_headline')}
              errorEn={firstError(errors, 'site.footer_headline.en')}
            />
            <I18nInput
              label={t('Label tombol ajakan', 'CTA button label')}
              value={settings.site.footer_cta_label}
              onChange={(footer_cta_label) => patchSite({ footer_cta_label })}
              maxLength={100}
              errorId={firstError(errors, 'site.footer_cta_label.id', 'site.footer_cta_label')}
              errorEn={firstError(errors, 'site.footer_cta_label.en')}
            />
            <I18nInput
              label={t('Catatan anak perusahaan', 'Subsidiary note')}
              value={settings.site.subsidiary_note}
              onChange={(subsidiary_note) => patchSite({ subsidiary_note })}
              maxLength={200}
              errorId={firstError(errors, 'site.subsidiary_note.id', 'site.subsidiary_note')}
              errorEn={firstError(errors, 'site.subsidiary_note.en')}
            />
          </div>
        </AdminCard>

        <AdminCard title={t('SEO bawaan', 'Default SEO')}>
          <div className="admin-form">
            <I18nInput
              label={t('Judul bawaan', 'Default title')}
              value={settings.seo.default_title}
              onChange={(default_title) => patchSeo({ default_title })}
              maxLength={200}
              errorId={firstError(errors, 'seo.default_title.id', 'seo.default_title')}
              errorEn={firstError(errors, 'seo.default_title.en')}
            />
            <I18nInput
              label={t('Deskripsi bawaan', 'Default description')}
              value={settings.seo.default_description}
              onChange={(default_description) => patchSeo({ default_description })}
              multiline
              rows={3}
              maxLength={500}
              errorId={firstError(errors, 'seo.default_description.id', 'seo.default_description')}
              errorEn={firstError(errors, 'seo.default_description.en')}
            />
          </div>
        </AdminCard>

        <AdminCard title={t('Kanal chat & analitik', 'Chat channel & analytics')}>
          <div className="admin-form">
            <div className="admin-form-row">
              <label>
                <span className="field-label">{t('Nomor WhatsApp Business', 'WhatsApp Business number')}</span>
                <input
                  value={settings.contact?.whatsapp ?? ''}
                  onChange={(e) => patchContact({ whatsapp: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="6281234567890"
                  maxLength={20}
                  className="mono"
                />
                <small className="admin-field-hint">
                  {t('Format internasional tanpa tanda + (62...). Kosongkan untuk menyembunyikan tombol WhatsApp di situs.', 'International format without + (62...). Leave empty to hide the WhatsApp button on the site.')}
                </small>
                {firstError(errors, 'contact.whatsapp') && <small className="cms-field-error">{firstError(errors, 'contact.whatsapp')}</small>}
              </label>
              <label>
                <span className="field-label">{t('ID Google Analytics (GA4)', 'Google Analytics ID (GA4)')}</span>
                <input
                  value={settings.analytics?.ga_measurement_id ?? ''}
                  onChange={(e) => patchAnalytics({ ga_measurement_id: e.target.value.trim() })}
                  placeholder="G-XXXXXXXXXX"
                  maxLength={30}
                  className="mono"
                />
                <small className="admin-field-hint">{t('Kosongkan bila belum memakai Google Analytics.', 'Leave empty if Google Analytics is not used yet.')}</small>
                {firstError(errors, 'analytics.ga_measurement_id') && <small className="cms-field-error">{firstError(errors, 'analytics.ga_measurement_id')}</small>}
              </label>
            </div>
            <ListField<WhatsAppContact>
              label={t('Nomor WhatsApp marketing lainnya (opsional)', 'Other marketing WhatsApp numbers (optional)')}
              items={settings.contact?.whatsapp_contacts ?? []}
              onChange={(items) => patchContact({ whatsapp_contacts: items })}
              createItem={() => ({ label: '', number: '' })}
              maxItems={10}
              addLabel={t('Tambah nomor', 'Add number')}
              error={firstError(errors, 'contact.whatsapp_contacts')}
              renderItem={(item, _index, set) => (
                <div className="admin-form-row">
                  <label>
                    <span className="field-label">{t('Nama tim / orang', 'Team / person')}</span>
                    <input value={item.label} maxLength={60} onChange={(e) => set({ ...item, label: e.target.value })} placeholder={t('mis. Marketing Resiprene', 'e.g. Resiprene marketing')} />
                  </label>
                  <label>
                    <span className="field-label">{t('Nomor', 'Number')}</span>
                    <input value={item.number} maxLength={20} className="mono" onChange={(e) => set({ ...item, number: e.target.value.replace(/[^0-9+ ()-]/g, '') })} placeholder="6281234567890" />
                  </label>
                </div>
              )}
            />
            <p className="admin-field-hint">
              {t(
                'Bila ada lebih dari satu nomor, tombol melayang "Chat WhatsApp", footer, dan halaman Kontak menampilkan daftar pilihan (nama tim + nomor). Nomor utama di atas selalu menjadi pilihan pertama dengan label "Marketing".',
                'With more than one number, the floating "Chat WhatsApp" button, the footer, and the Contact page show a list to choose from (team name + number). The main number above is always the first option, labelled "Marketing".',
              )}
            </p>
            <I18nInput
              label={t('Pesan awal WhatsApp', 'WhatsApp opening message')}
              value={settings.contact?.whatsapp_message ?? emptyContact.whatsapp_message}
              onChange={(whatsapp_message) => patchContact({ whatsapp_message })}
              maxLength={300}
              errorId={firstError(errors, 'contact.whatsapp_message.id', 'contact.whatsapp_message')}
              errorEn={firstError(errors, 'contact.whatsapp_message.en')}
            />
            <label>
              <span className="field-label">{t('Token verifikasi Google Search Console', 'Google Search Console verification token')}</span>
              <input
                value={settings.analytics?.gsc_verification ?? ''}
                onChange={(e) => patchAnalytics({ gsc_verification: e.target.value.trim() })}
                placeholder={t('isi dari tag meta google-site-verification', 'content of the google-site-verification meta tag')}
                maxLength={120}
                className="mono"
              />
              {firstError(errors, 'analytics.gsc_verification') && <small className="cms-field-error">{firstError(errors, 'analytics.gsc_verification')}</small>}
            </label>
          </div>
        </AdminCard>

        <AdminCard title={t('Halaman login', 'Login page')}>
          <div className="admin-form">
            <p className="admin-field-hint">
              {t(
                'Foto atau video di panel samping halaman login, daftar, dan lupa password (maks. 6). Foto berganti tiap 5,5 detik; video diputar tanpa suara sampai selesai lalu pindah ke slide berikutnya. Kosongkan untuk memakai foto bawaan.',
                'Photos or videos in the side panel of the login, register and forgot-password pages (max 6). Photos rotate every 5.5 s; videos play muted to the end, then move on. Leave empty to use the default photos.',
              )}
            </p>
            <ListField<AuthSlide>
              label={t('Foto / video halaman login', 'Login page photos / videos')}
              items={settings.auth?.slides ?? []}
              onChange={(slides) => setSettings((current) => (current ? { ...current, auth: { ...(current.auth ?? {}), slides } } : current))}
              createItem={() => ({ media: null as unknown as AuthSlide['media'], caption: { id: '', en: '' } })}
              maxItems={6}
              addLabel={t('Tambah slide', 'Add slide')}
              error={firstError(errors, 'auth.slides')}
              renderItem={(item, _index, set) => (
                <div className="admin-form">
                  <MediaPicker
                    label={t('Foto atau video', 'Photo or video')}
                    value={item.media ?? null}
                    onChange={(media) => set({ ...item, media: media as AuthSlide['media'] })}
                    accept="visual"
                    required
                    hint={t('Lanskap/potret tinggi tampil paling baik (mis. 1200×1500). Video MP4/WebM pendek, tanpa suara.', 'Tall images work best (e.g. 1200×1500). Short MP4/WebM videos, muted.')}
                  />
                  <I18nInput
                    label={t('Teks di atas foto (opsional)', 'Caption on the photo (optional)')}
                    value={item.caption ?? { id: '', en: '' }}
                    onChange={(caption) => set({ ...item, caption })}
                    maxLength={120}
                  />
                </div>
              )}
            />
          </div>
        </AdminCard>

        <AdminCard title={t('Tema warna', 'Colour theme')}>
          <div className="admin-form">
            <p className="admin-field-hint">
              {t(
                'Warna logo IKN: biru dan putih. Perubahan langsung dipratinjau di panel ini dan berlaku di seluruh situs (company profile dan toko online) setelah disimpan. Tombol "Bawaan" mengembalikan warna standar.',
                'IKN logo colours: blue and white. Changes preview instantly in this panel and apply to the whole site (company profile and shop) once saved. "Bawaan" restores the default colour.',
              )}
            </p>
            <div className="admin-form-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {themeField('primary', t('Warna utama', 'Primary colour'), t('Tombol, tautan, label, ikon aktif.', 'Buttons, links, labels, active icons.'))}
              {themeField('primary_deep', t('Warna gelap', 'Deep colour'), t('Footer dan blok berlatar gelap.', 'Footer and dark background blocks.'))}
              {themeField('accent', t('Warna aksen', 'Accent colour'), t('Nomor bagian, badge promo, sorotan kecil.', 'Section numbers, promo badges, small highlights.'))}
            </div>
            <div className="theme-swatches" aria-hidden="true">
              {THEME_KEYS.map((key) => (
                <div key={key} className="theme-swatch" style={{ background: themeColor(theme, key) }}>
                  {themeColor(theme, key)}
                </div>
              ))}
            </div>
          </div>
        </AdminCard>

        <div className="row-actions">
          <button type="submit" className="btn btn-solid btn-sm" disabled={saving}>
            {saving ? t('Menyimpan...', 'Saving...') : t('Simpan pengaturan', 'Save settings')}
          </button>
          <button type="button" className="btn btn-line btn-sm" disabled={saving} onClick={() => void load()}>
            {t('Muat ulang', 'Reload')}
          </button>
        </div>
      </form>
    </div>
  );
}
