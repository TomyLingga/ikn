'use client';

import { useState } from 'react';
import { AdminCard } from '@/components/admin/AdminPage';
import { firstError, type FieldErrors } from '@/components/admin/cms';
import { useAuth } from '@/components/AuthProvider';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import Select from '@/components/Select';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { MailEncryption, MailMode, MailSettings } from '@/lib/cms';

interface Props {
  value: MailSettings;
  onChange: (patch: Partial<MailSettings>) => void;
  errors: FieldErrors;
}

interface MailTestResult {
  mode: MailMode;
  mailer: string;
  host: string;
  from: string;
  to: string;
}

/**
 * Kartu "Notifikasi email" di Pengaturan Situs (ASUMSI A-82): mode pengiriman, SMTP webmail klien, dan tombol
 * "Kirim email uji" yang memakai nilai form (belum disimpan) lewat POST /admin/site-settings/mail-test.
 */
export default function MailSettingsCard({ value, onChange, errors }: Props) {
  const { lang } = useLang();
  const { admin } = useAuth();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [to, setTo] = useState(admin?.email ?? '');
  const [testing, setTesting] = useState(false);
  const [testNotice, setTestNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const smtp = value.mode === 'smtp';

  async function sendTest() {
    if (testing) return;
    setTesting(true);
    setTestNotice(null);
    try {
      const result = await api<{ data: MailTestResult; message?: string }>('/admin/site-settings/mail-test', {
        method: 'POST',
        body: { to, mail: value },
        raw: true,
      });
      const via = result.data.mode === 'smtp' ? `SMTP ${result.data.host}` : t('konfigurasi server', 'server configuration');
      setTestNotice({ ok: true, text: `${result.message ?? t('Email uji terkirim.', 'Test email sent.')} (${via})` });
    } catch (err) {
      const text =
        err instanceof ApiError && err.status === 422 && Object.keys(err.errors).length
          ? Object.values(err.errors)
              .flat()
              .join(' ')
          : errorMessage(err);
      setTestNotice({ ok: false, text });
    } finally {
      setTesting(false);
    }
  }

  const fieldError = (key: keyof MailSettings) => firstError(errors, `mail.${key}`);
  const text = (key: Exclude<keyof MailSettings, 'mode' | 'port' | 'encryption' | 'password'>, label: string, extra: Partial<JSX.IntrinsicElements['input']> = {}) => (
    <label>
      <span className="field-label">{label}</span>
      <input value={value[key]} onChange={(e) => onChange({ [key]: e.target.value })} maxLength={190} disabled={!smtp} {...extra} />
      {fieldError(key) && <small className="cms-field-error">{fieldError(key)}</small>}
    </label>
  );

  return (
    <AdminCard
      title={t('Notifikasi email', 'Email notifications')}
      desc={t(
        'Email otomatis ke customer dan admin: verifikasi akun, persetujuan/penolakan akun, reset password, pesanan baru, bukti bayar, pembayaran diterima/ditolak, pengiriman, dan pengingat bayar.',
        'Automatic emails to customers and admins: account verification, approval/rejection, password reset, new orders, payment proofs, payment accepted/rejected, shipping, and payment reminders.',
      )}
    >
      <div className="admin-form">
        <label>
          <span className="field-label">{t('Pengiriman email', 'Email delivery')}</span>
          <Select value={value.mode} onChange={(e) => onChange({ mode: e.target.value as MailMode })}>
            <option value="smtp">{t('SMTP sendiri (email webmail perusahaan)', 'Own SMTP (company webmail)')}</option>
            <option value="server">{t('Ikuti konfigurasi server (.env)', 'Use the server configuration (.env)')}</option>
            <option value="off">{t('Tidak kirim email (hanya notifikasi di aplikasi)', 'Do not send email (in-app notifications only)')}</option>
          </Select>
          <small className="admin-field-hint">
            {t(
              'Pilih "SMTP sendiri" lalu isi data akun email webmail (mis. noreply@ptikn.com) dari hosting. Perubahan berlaku segera setelah disimpan, tanpa restart server.',
              'Choose "Own SMTP" and fill in the webmail account (e.g. noreply@ptikn.com) from the hosting panel. Changes apply right after saving, no server restart needed.',
            )}
          </small>
          {fieldError('mode') && <small className="cms-field-error">{fieldError('mode')}</small>}
        </label>

        <div className="admin-form-row">
          {text('host', t('Server SMTP (host)', 'SMTP server (host)'), { placeholder: 'smtp.hostinger.com', className: 'mono', required: smtp })}
          <label>
            <span className="field-label">{t('Port', 'Port')}</span>
            <input
              type="number"
              min={1}
              max={65535}
              value={value.port}
              onChange={(e) => onChange({ port: Number(e.target.value) || 0 })}
              disabled={!smtp}
              className="mono"
            />
            {fieldError('port') && <small className="cms-field-error">{fieldError('port')}</small>}
          </label>
          <label>
            <span className="field-label">{t('Enkripsi', 'Encryption')}</span>
            <Select value={value.encryption} onChange={(e) => onChange({ encryption: e.target.value as MailEncryption })} disabled={!smtp}>
              <option value="ssl">SSL (port 465)</option>
              <option value="tls">TLS / STARTTLS (port 587)</option>
              <option value="">{t('Tanpa enkripsi (port 25)', 'None (port 25)')}</option>
            </Select>
            {fieldError('encryption') && <small className="cms-field-error">{fieldError('encryption')}</small>}
          </label>
        </div>

        <div className="admin-form-row">
          {text('username', t('Username SMTP', 'SMTP username'), { placeholder: 'noreply@ptikn.com', autoComplete: 'off', className: 'mono' })}
          <label>
            <span className="field-label">{t('Password SMTP', 'SMTP password')}</span>
            <div className="admin-input-affix">
              <input
                type={showPassword ? 'text' : 'password'}
                value={value.password}
                onChange={(e) => onChange({ password: e.target.value })}
                disabled={!smtp}
                autoComplete="new-password"
                maxLength={255}
                className="mono"
              />
              <button type="button" className="btn btn-line btn-sm" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? t('Sembunyikan', 'Hide') : t('Tampilkan', 'Show')} disabled={!smtp}>
                <Icon name={showPassword ? 'eyeOff' : 'eye'} size={15} />
              </button>
            </div>
            <small className="admin-field-hint">
              {t('Password tersimpan tidak ditampilkan (********). Biarkan apa adanya bila tidak diganti; kosongkan untuk menghapus.', 'The saved password is not shown (********). Leave it as is to keep it; clear it to remove it.')}
            </small>
            {fieldError('password') && <small className="cms-field-error">{fieldError('password')}</small>}
          </label>
        </div>

        <div className="admin-form-row">
          {text('from_address', t('Alamat pengirim (From)', 'Sender address (From)'), { type: 'email', placeholder: 'noreply@ptikn.com', className: 'mono', required: smtp })}
          {text('from_name', t('Nama pengirim', 'Sender name'), { placeholder: 'PT Industri Karet Nusantara', maxLength: 120 })}
        </div>

        <div className="admin-form-row" style={{ alignItems: 'end' }}>
          <label>
            <span className="field-label">{t('Kirim email uji ke', 'Send test email to')}</span>
            <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="admin@ptikn.com" maxLength={190} className="mono" />
          </label>
          <div>
            <button type="button" className="btn btn-line btn-sm" onClick={() => void sendTest()} disabled={testing || !to || value.mode === 'off'}>
              <Icon name="send" size={15} /> {testing ? t('Mengirim...', 'Sending...') : t('Kirim email uji', 'Send test email')}
            </button>
          </div>
        </div>
        <p className="admin-field-hint">
          {t(
            'Email uji memakai isian di atas walaupun belum disimpan, jadi bisa dicek dulu sebelum menekan "Simpan pengaturan".',
            'The test uses the values above even before saving, so you can verify them before pressing "Save settings".',
          )}
        </p>
        {testNotice && (
          <p className={testNotice.ok ? 'admin-inline-ok' : 'form-error'} role="status">
            {testNotice.text}
          </p>
        )}
      </div>
    </AdminCard>
  );
}
