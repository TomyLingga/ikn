'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Order, Payment } from '@/lib/types';
import styles from './PaymentProof.module.css';

// Unggah bukti bayar (POST /customer/orders/{number}/proof, multipart `file`). Tombol hanya tampil
// bila API memberi flag `canUploadProof`; state lain (menunggu verifikasi, ditolak, kedaluwarsa) dibaca dari payment.
export default function PaymentProof({
  order,
  payment,
  onUpload,
}: {
  order: Order;
  payment: Payment | null;
  onUpload: (file: File) => Promise<unknown>;
}) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rejected = payment?.status === 'rejected' ? payment : (order.payments || []).find((p) => p.status === 'rejected') || null;

  if (payment?.status === 'awaiting_verification' || order.status === 'payment_review') {
    return (
      <div className={styles.done}>
        <Icon name="check" size={18} />
        <span>
          {t('Bukti pembayaran sudah diunggah. Menunggu verifikasi admin.', 'Payment proof uploaded. Awaiting admin verification.')}
          {payment?.proof?.uploadedAt && <> ({formatDateTime(payment.proof.uploadedAt, lang)})</>}
        </span>
      </div>
    );
  }

  if (order.status === 'expired' || payment?.status === 'expired') {
    return (
      <div className={styles.rejected}>
        <Icon name="cancelCircle" size={18} /> {t('Batas waktu pembayaran terlewati dan pesanan kedaluwarsa.', 'The payment deadline has passed and the order expired.')}
      </div>
    );
  }

  if (!order.canUploadProof) {
    return null;
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      await onUpload(file);
      setFile(null);
    } catch (err) {
      setError(errorMessage(err, t('Gagal mengunggah bukti. Coba lagi.', 'Upload failed. Please try again.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.proof}>
      {rejected && (
        <div className={styles.rejected}>
          <Icon name="cancelCircle" size={18} />
          <span>
            {t('Bukti sebelumnya ditolak', 'Previous proof was rejected')}
            {rejected.rejectReason ? `: ${rejected.rejectReason}` : '.'}{' '}
            {t('Silakan unggah ulang bukti yang benar.', 'Please upload the correct proof again.')}
          </span>
        </div>
      )}

      {order.paymentDueAt && (
        <p className={styles.due}>
          {t('Batas waktu pembayaran', 'Payment deadline')}: <strong>{formatDateTime(order.paymentDueAt, lang)}</strong>
        </p>
      )}

      <p className={styles.note}>
        {t('Unggah bukti transfer / pembayaran (JPG, PNG, atau PDF, maks. 5 MB) untuk verifikasi admin.', 'Upload the transfer / payment receipt (JPG, PNG or PDF, max 5 MB) for admin verification.')}
      </p>

      <label className={styles.dropzone}>
        <Icon name="arrowDown" size={22} />
        <span>{file ? file.name : t('Pilih berkas bukti pembayaran', 'Choose payment proof file')}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,application/pdf,.pdf"
          hidden
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button type="button" className="btn btn-solid btn-sm btn-block" disabled={!file || busy} onClick={submit}>
        {busy ? t('Mengunggah…', 'Uploading…') : t('Kirim bukti', 'Submit proof')} <Icon name="arrow" />
      </button>
    </div>
  );
}
