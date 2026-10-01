'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AdminCard, AdminPageHead } from '@/components/admin/AdminPage';
import { firstError, type FieldErrors } from '@/components/admin/cms';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { CommerceSettingsData } from '@/lib/admin';

type SettingsForm = Record<keyof CommerceSettingsData, string | boolean>;

function settingsToForm(s: CommerceSettingsData): SettingsForm {
  return {
    paymentDueHours: String(s.paymentDueHours),
    uniqueCodeEnabled: s.uniqueCodeEnabled,
    taxRate: String(s.taxRate),
    priceIncludesTax: s.priceIncludesTax,
    autoCompleteDays: String(s.autoCompleteDays),
    reminderHoursBeforeDue: String(s.reminderHoursBeforeDue),
    invoicePrefix: s.invoicePrefix ?? 'PMS/X/INV/RA',
    invoiceSignerName: s.invoiceSignerName ?? '',
    invoiceSignerTitle: s.invoiceSignerTitle ?? '',
    invoiceCc: s.invoiceCc ?? '',
  };
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

// Pengaturan checkout: setting commerce (GET/PUT /admin/settings). Biaya tambahan punya halaman sendiri
// (/admin/additional-fees) sejak bisa ditujukan ke customer tertentu.
export default function AdminCheckoutSettings() {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);

  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [settingsErrors, setSettingsErrors] = useState<FieldErrors>({});
  const [settingsError, setSettingsError] = useState('');
  const [settingsNotice, setSettingsNotice] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setSettingsError('');
    try {
      setSettings(settingsToForm(await api<CommerceSettingsData>('/admin/settings')));
    } catch (err) {
      setSettingsError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!settingsNotice) return;
    const timer = window.setTimeout(() => setSettingsNotice(''), 3500);
    return () => window.clearTimeout(timer);
  }, [settingsNotice]);

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || settingsSaving) return;
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsErrors({});
    try {
      const saved = await api<CommerceSettingsData>('/admin/settings', {
        method: 'PUT',
        body: {
          paymentDueHours: Number(settings.paymentDueHours),
          uniqueCodeEnabled: settings.uniqueCodeEnabled === true,
          taxRate: Number(settings.taxRate),
          priceIncludesTax: settings.priceIncludesTax === true,
          autoCompleteDays: Number(settings.autoCompleteDays),
          reminderHoursBeforeDue: Number(settings.reminderHoursBeforeDue),
          invoicePrefix: String(settings.invoicePrefix).trim(),
          invoiceSignerName: String(settings.invoiceSignerName).trim(),
          invoiceSignerTitle: String(settings.invoiceSignerTitle).trim(),
          invoiceCc: String(settings.invoiceCc).trim(),
        },
      });
      setSettings(settingsToForm(saved));
      setSettingsNotice(t('Pengaturan checkout disimpan.', 'Checkout settings saved.'));
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setSettingsErrors(err.errors);
        setSettingsError(err.message);
      } else {
        setSettingsError(errorMessage(err));
      }
    } finally {
      setSettingsSaving(false);
    }
  }

  const numberField = (key: keyof CommerceSettingsData, label: string, hint: string, opts: { min: number; max: number; step?: number; suffix?: string }) =>
    settings && (
      <label>
        <span className="field-label">{label}</span>
        <div className="admin-input-suffix">
          <input type="number" min={opts.min} max={opts.max} step={opts.step ?? 1} value={String(settings[key])} onChange={(e) => setSettings({ ...settings, [key]: e.target.value })} required />
          {opts.suffix && <span>{opts.suffix}</span>}
        </div>
        <small className="admin-field-hint">{hint}</small>
        {firstError(settingsErrors, key) && <small className="cms-field-error">{firstError(settingsErrors, key)}</small>}
      </label>
    );

  return (
    <div>
      <AdminPageHead
        title={t('Pengaturan Checkout', 'Checkout Settings')}
        desc={t('Aturan batas waktu pembayaran, kode unik, dan pajak saat checkout.', 'Payment deadline, unique code, and tax rules at checkout.')}
      />

      <div style={{ maxWidth: 720 }}>
        <AdminCard title={t('Pengaturan checkout', 'Checkout settings')} desc={t('Berlaku untuk order baru; order yang sudah dibuat tidak berubah.', 'Applies to new orders; existing orders are not changed.')}>
          {settingsError && <p className="form-error">{settingsError}</p>}
          {settingsNotice && (
            <p className="admin-toast" role="status">
              {settingsNotice}
            </p>
          )}
          {!settings ? (
            <p className="admin-field-hint">{t('Memuat pengaturan...', 'Loading settings...')}</p>
          ) : (
            <form className="admin-form" onSubmit={(e) => void submitSettings(e)}>
              {numberField('paymentDueHours', t('Batas waktu pembayaran', 'Payment deadline'), t('Order yang belum dibayar sampai batas ini otomatis kedaluwarsa dan stoknya dikembalikan.', 'Unpaid orders expire automatically after this period and stock is released.'), { min: 1, max: 720, suffix: t('jam', 'hours') })}
              {numberField('reminderHoursBeforeDue', t('Pengingat sebelum batas bayar', 'Reminder before deadline'), t('Email pengingat dikirim sekian jam sebelum batas waktu (0 = tanpa pengingat).', 'A reminder email is sent this many hours before the deadline (0 = no reminder).'), { min: 0, max: 168, suffix: t('jam', 'hours') })}
              <label className="cms-check">
                <input type="checkbox" checked={settings.uniqueCodeEnabled === true} onChange={(e) => setSettings({ ...settings, uniqueCodeEnabled: e.target.checked })} />
                <span>
                  {t('Kode unik transfer manual', 'Unique code for manual transfer')}
                  <small className="admin-field-hint" style={{ display: 'block' }}>
                    {t('Menambahkan 1–999 rupiah ke total agar transfer mudah dicocokkan.', 'Adds Rp 1–999 to the total so transfers are easy to match.')}
                  </small>
                </span>
              </label>
              {numberField('taxRate', t('Tarif PPN', 'VAT rate'), t('Persentase pajak untuk produk kena pajak (mis. 11).', 'Tax percentage for taxable products (e.g. 11).'), { min: 0, max: 100, step: 0.01, suffix: '%' })}
              <label className="cms-check">
                <input type="checkbox" checked={settings.priceIncludesTax === true} onChange={(e) => setSettings({ ...settings, priceIncludesTax: e.target.checked })} />
                <span>
                  {t('Harga produk sudah termasuk PPN', 'Product prices include VAT')}
                  <small className="admin-field-hint" style={{ display: 'block' }}>
                    {t('Aktif: PPN ditampilkan sebagai bagian dari harga. Nonaktif: PPN ditambahkan di atas subtotal.', 'On: VAT is shown as part of the price. Off: VAT is added on top of the subtotal.')}
                  </small>
                </span>
              </label>
              {numberField('autoCompleteDays', t('Selesai otomatis setelah diterima', 'Auto-complete after delivery'), t('Order berstatus "Diterima" ditutup otomatis setelah sekian hari bila customer tidak mengonfirmasi (0 = manual).', 'Delivered orders are closed automatically after this many days if the customer does not confirm (0 = manual).'), { min: 0, max: 90, suffix: t('hari', 'days') })}

              <h3 className="admin-subtitle" style={{ marginTop: 8 }}>{t('Invoice', 'Invoice')}</h3>
              <label>
                <span className="field-label">{t('Awalan nomor invoice', 'Invoice number prefix')}</span>
                <input value={String(settings.invoicePrefix)} onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })} maxLength={40} />
                <small className="admin-field-hint">
                  {t('Nomor lengkap:', 'Full number:')} <span className="mono">{String(settings.invoicePrefix).trim().replace(/\/+$/, '') || 'PMS/X/INV/RA'}/{'{urut}'}/{ROMAN[new Date().getMonth()]}/{new Date().getFullYear()}</span>{' '}
                  {t('— urutan dimulai dari 1 tiap bulan dan diterbitkan saat pembayaran diverifikasi; invoice yang sudah terbit tidak berubah.', '— the sequence restarts at 1 every month and is issued when the payment is verified; existing invoices do not change.')}
                </small>
                {firstError(settingsErrors, 'invoicePrefix') && <small className="form-error">{firstError(settingsErrors, 'invoicePrefix')}</small>}
              </label>
              <div className="admin-form-row">
                <label>
                  <span className="field-label">{t('Nama penanda tangan', 'Signatory name')}</span>
                  <input value={String(settings.invoiceSignerName)} onChange={(e) => setSettings({ ...settings, invoiceSignerName: e.target.value })} maxLength={120} />
                </label>
                <label>
                  <span className="field-label">{t('Jabatan penanda tangan', 'Signatory title')}</span>
                  <input value={String(settings.invoiceSignerTitle)} onChange={(e) => setSettings({ ...settings, invoiceSignerTitle: e.target.value })} maxLength={120} />
                </label>
              </div>
              <label>
                <span className="field-label">{t('Tembusan (cc)', 'Copies (cc)')}</span>
                <input value={String(settings.invoiceCc)} onChange={(e) => setSettings({ ...settings, invoiceCc: e.target.value })} maxLength={120} placeholder="ATU, File" />
                <small className="admin-field-hint">{t('Dipisah koma; tampil di kiri bawah cetakan invoice.', 'Comma-separated; shown at the bottom left of the printed invoice.')}</small>
              </label>
              <div className="admin-modal-actions" style={{ borderTop: 0, paddingTop: 0 }}>
                <button type="submit" className="btn btn-solid btn-sm" disabled={settingsSaving}>
                  {settingsSaving ? t('Menyimpan...', 'Saving...') : t('Simpan pengaturan', 'Save settings')}
                </button>
              </div>
            </form>
          )}
        </AdminCard>

        <p className="admin-field-hint" style={{ marginTop: 14 }}>
          {t('Biaya yang ditambahkan ke order diatur di menu', 'Fees added to orders are managed under')}{' '}
          <Link href="/admin/additional-fees" className="link">
            {t('Biaya Tambahan', 'Additional Fees')}
          </Link>
          {t(', ongkos kirim di menu', ', shipping costs under')}{' '}
          <Link href="/admin/shipping" className="link">
            {t('Ongkir', 'Shipping Rates')}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
