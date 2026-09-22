'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { Order } from '@/lib/types';
import styles from './PaymentProof.module.css';

// Unggah bukti transfer ke backend. Menangani seluruh state pembayaran:
// belum bayar, menunggu konfirmasi, ditolak (+alasan, bisa unggah ulang),
// dan kedaluwarsa.
export default function PaymentProof({
  order,
  onUpload,
}: {
  order: Order;
  onUpload: (file: File) => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (order.payment === 'awaiting_confirmation') {
    return (
      <div className={styles.done}>
        <Icon name="check" size={18} /> Bukti transfer sudah diunggah. Menunggu verifikasi admin.
      </div>
    );
  }

  if (order.payment === 'expired') {
    return (
      <div className={styles.rejected}>
        <Icon name="cancelCircle" size={18} /> Batas waktu pembayaran terlewati dan pesanan dibatalkan.
      </div>
    );
  }

  async function submit() {
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      await onUpload(file);
      setFile(null);
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengunggah bukti. Coba lagi.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.proof}>
      {order.payment === 'rejected' && (
        <div className={styles.rejected}>
          <Icon name="cancelCircle" size={18} />
          <span>
            Bukti sebelumnya ditolak{order.rejectReason ? `: ${order.rejectReason}` : '.'}{' '}
            Silakan unggah ulang bukti yang benar.
          </span>
        </div>
      )}

      {order.dueAt && order.payment === 'unpaid' && (
        <p className={styles.due}>
          Batas waktu pembayaran: <strong>{formatDateTime(order.dueAt)}</strong>
        </p>
      )}

      <p className={styles.note}>
        Unggah bukti transfer (JPG/PNG/WEBP/PDF, maks. 5 MB) untuk mempercepat verifikasi.
      </p>

      <label className={styles.dropzone}>
        <Icon name="arrowDown" size={22} />
        <span>{file ? file.name : 'Pilih berkas bukti transfer'}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.pdf"
          hidden
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}

      <button
        type="button"
        className="btn btn-solid btn-sm btn-block"
        disabled={!file || busy}
        onClick={submit}
      >
        {busy ? 'Mengunggah…' : 'Kirim bukti'} <Icon name="arrow" />
      </button>
    </div>
  );
}
