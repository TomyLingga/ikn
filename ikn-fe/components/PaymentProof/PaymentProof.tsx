'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Order, OrderInstallment, Payment } from '@/lib/types';
import styles from './PaymentProof.module.css';

// Unggah bukti bayar (POST /customer/orders/{number}/proof, multipart `file`). Tombol hanya tampil
// bila API memberi flag `canUploadProof`; state lain (menunggu verifikasi, ditolak, kedaluwarsa) dibaca dari payment.
// Order bertermin (ASUMSI A-97): dengan `installment` (termin lanjutan) semua state dibaca dari termin itu, bukan dari
// status order; pemanggil mengirim `installmentId` di `onUpload`.
export default function PaymentProof({
  order,
  payment,
  onUpload,
  installment = null,
}: {
  order: Order;
  payment: Payment | null;
  onUpload: (file: File) => Promise<unknown>;
  installment?: OrderInstallment | null;
}) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const balance = !!installment && installment.seq > 1;
  // Termin lanjutan: bukti terakhir yang ditolak milik termin ini (bukan payment termin lain).
  const lastOfInstallment = balance ? installment.payments[installment.payments.length - 1] || null : null;
  const rejected = balance
    ? (lastOfInstallment?.status === 'rejected' ? lastOfInstallment : [...installment.payments].reverse().find((p) => p.status === 'rejected') || null)
    : payment?.status === 'rejected' ? payment : (order.payments || []).find((p) => p.status === 'rejected' && (p.installment?.seq ?? 1) === 1) || null;
  const awaiting = balance ? installment.status === 'awaiting_verification' : payment?.status === 'awaiting_verification' || order.status === 'payment_review';
  const canUpload = balance ? installment.canUploadProof : order.canUploadProof;
  const dueAt = balance ? installment.dueAt : order.paymentDueAt;

  if (awaiting) {
    return (
      <div className={styles.done}>
        <Icon name="check" size={18} />
        <span>
          {t('Bukti pembayaran sudah diunggah dan sedang kami periksa.', 'Payment proof uploaded. We are checking it.')}
          {payment?.proof?.uploadedAt && <> ({formatDateTime(payment.proof.uploadedAt, lang)})</>}
        </span>
      </div>
    );
  }

  if (!balance && (order.status === 'expired' || payment?.status === 'expired')) {
    return (
      <div className={styles.rejected}>
        <Icon name="cancelCircle" size={18} /> {t('Batas waktu pembayaran terlewati dan pesanan kedaluwarsa.', 'The payment deadline has passed and the order expired.')}
      </div>
    );
  }

  if (!canUpload) {
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
            {t('Unggah ulang bukti yang benar.', 'Please upload the correct proof.')}
          </span>
        </div>
      )}

      {/* Termin lanjutan: jatuh tempo sudah tampil di kotak instruksi (PaymentInstructions), tidak diulang di sini. */}
      {dueAt && !balance && (
        <p className={styles.due}>
          {t('Batas waktu pembayaran', 'Payment deadline')}: <strong>{formatDateTime(dueAt, lang)}</strong>
        </p>
      )}

      <p className={styles.note}>
        {t('Unggah bukti transfer atau pembayaran (JPG, PNG, atau PDF, maks. 5 MB). Tim kami akan memeriksanya.', 'Upload the transfer or payment receipt (JPG, PNG or PDF, max 5 MB). Our team will check it.')}
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
