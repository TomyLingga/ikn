'use client';

// Modal "Terima pembayaran" (POST /admin/payments/{id}/accept) untuk halaman Pembayaran dan detail order.
// Field opsional (ASUMSI A-86, informasi saja): jumlah diterima (prefill = jumlah tagihan), biaya bank, catatan
// penerimaan. Input desimal dikonversi ke satuan terkecil mata uang payment (IDR rupiah bulat, USD sen).
import { useState, type FormEvent } from 'react';
import AdminModal from '@/components/admin/AdminModal';
import { useLang } from '@/components/LanguageProvider';
import { api, ApiError, errorMessage } from '@/lib/api';
import { paymentMethodSummary, type AcceptPaymentPayload } from '@/lib/admin';
import { currencyStep, formatMoney, fromMinorInput, toMinorInput } from '@/lib/format';
import type { Payment } from '@/lib/types';

interface AcceptPaymentModalProps {
  payment: Payment;
  /** Nomor order untuk judul (opsional). */
  orderNumber?: string | null;
  onClose: () => void;
  /** Dipanggil setelah server menerima pembayaran; pemanggil menyegarkan data dan badge. */
  onAccepted: () => void | Promise<void>;
}

function actionErrorText(err: unknown): string {
  if (err instanceof ApiError && err.code === 'INVALID_TRANSITION' && err.meta) {
    return `${err.message} (${String(err.meta.from ?? '?')} → ${String(err.meta.to ?? '?')})`;
  }
  return errorMessage(err);
}

export default function AcceptPaymentModal({ payment, orderNumber, onClose, onAccepted }: AcceptPaymentModalProps) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const currency = payment.currency || 'IDR';
  const usd = currency === 'USD';
  const [receivedAmount, setReceivedAmount] = useState(() => fromMinorInput(payment.amount, currency));
  const [bankCharges, setBankCharges] = useState('');
  const [receivedNote, setReceivedNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const receivedMinor = toMinorInput(receivedAmount, currency);
  const chargesMinor = toMinorInput(bankCharges, currency);
  const shortfall = receivedMinor !== null ? payment.amount - receivedMinor : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (receivedAmount.trim() !== '' && receivedMinor === null) {
      setError(t('Jumlah diterima tidak valid.', 'Invalid received amount.'));
      return;
    }
    if (bankCharges.trim() !== '' && chargesMinor === null) {
      setError(t('Biaya bank tidak valid.', 'Invalid bank charges.'));
      return;
    }
    setBusy(true);
    setError('');
    const body: AcceptPaymentPayload = {};
    if (receivedMinor !== null) body.receivedAmount = receivedMinor;
    if (chargesMinor !== null) body.bankCharges = chargesMinor;
    if (receivedNote.trim()) body.receivedNote = receivedNote.trim();
    try {
      await api(`/admin/payments/${payment.id}/accept`, { method: 'POST', body });
      await onAccepted();
    } catch (err) {
      setError(actionErrorText(err));
      setBusy(false);
    }
  }

  return (
    <AdminModal title={`${t('Terima pembayaran', 'Accept payment')} ${orderNumber || `#${payment.id}`}`} onClose={onClose} small>
      <form className="admin-form" onSubmit={(e) => void submit(e)}>
        <p className="admin-field-hint">
          {t('Tagihan', 'Amount due')}: <strong>{formatMoney(payment.amount, currency)}</strong> · {paymentMethodSummary(payment, lang)}.{' '}
          {t('Order berubah menjadi Dibayar dan customer mendapat notifikasi. Isian di bawah hanya catatan untuk keuangan.', 'The order becomes Paid and the customer is notified. The fields below are notes for finance only.')}
        </p>
        <div className="admin-form-row">
          <label>
            <span className="field-label">{t('Jumlah diterima', 'Amount received')}</span>
            <div className="admin-input-suffix">
              <input type="number" min={0} step={currencyStep(currency)} inputMode="decimal" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} />
              <span>{currency}</span>
            </div>
            {shortfall > 0 && receivedMinor !== null && (
              <small className="admin-field-hint admin-warn-text">
                {t('Kurang', 'Short by')} {formatMoney(shortfall, currency)} {t('dari tagihan', 'of the amount due')}
              </small>
            )}
          </label>
          <label>
            <span className="field-label">{t('Biaya bank', 'Bank charges')}</span>
            <div className="admin-input-suffix">
              <input type="number" min={0} step={currencyStep(currency)} inputMode="decimal" value={bankCharges} onChange={(e) => setBankCharges(e.target.value)} placeholder={usd ? '0.00' : '0'} />
              <span>{currency}</span>
            </div>
          </label>
        </div>
        <label>
          <span className="field-label">{t('Catatan penerimaan', 'Receipt note')}</span>
          <input value={receivedNote} maxLength={255} onChange={(e) => setReceivedNote(e.target.value)} placeholder={t('mis. nomor referensi transfer, selisih kurs', 'e.g. transfer reference, exchange difference')} />
        </label>
        {error && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="admin-modal-actions">
          <button type="button" className="btn btn-line btn-sm" onClick={onClose} disabled={busy}>
            {t('Batal', 'Cancel')}
          </button>
          <button type="submit" className="btn btn-solid btn-sm" disabled={busy}>
            {busy ? t('Memproses...', 'Processing...') : t('Terima pembayaran', 'Accept payment')}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
