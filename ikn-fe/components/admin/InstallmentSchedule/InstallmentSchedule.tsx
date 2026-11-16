'use client';

import Icon from '@/components/Icon';
import StatusBadge from '@/components/StatusBadge';
import { AdminCard } from '@/components/admin/AdminPage';
import { FileLink } from '@/components/FileViewer';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import { formatPercent, installmentLabel, installmentTriggerText, isPartiallyPaid, partiallyPaidLabel, paymentLabel } from '@/lib/commerce';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { Order, OrderInstallment, Payment } from '@/lib/types';
import styles from './InstallmentSchedule.module.css';

interface Props {
  order: Order;
  busy?: boolean;
  /** Tagih termin yang belum ditagih (POST .../installments/{id}/bill). */
  onBill: (row: OrderInstallment) => void;
  /** Ubah tanggal jatuh tempo termin yang sudah ditagih (endpoint yang sama, `dueAt` wajib). */
  onChangeDue: (row: OrderInstallment) => void;
  /** Kirim pengingat pembayaran (POST .../installments/{id}/remind). */
  onRemind: (row: OrderInstallment) => void;
  /** Verifikasi bukti termin: modal terima / tolak yang sama dengan pembayaran biasa. */
  onAccept: (payment: Payment) => void;
  onReject: (payment: Payment) => void;
}

/**
 * Kartu "Jadwal pembayaran" di detail order admin (ASUMSI A-97): semua termin order dengan persen, nominal, jatuh
 * tempo, status, bukti, percobaan bayar, dan aksi Tagih / Ubah jatuh tempo / Kirim pengingat / Verifikasi.
 * Tidak dirender untuk order satu pembayaran penuh.
 */
export default function InstallmentSchedule({ order, busy = false, onBill, onChangeDue, onRemind, onAccept, onReject }: Props) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const rows = order.installments || [];
  if (rows.length === 0) return null;
  const progress = order.paymentProgress;

  function whenText(row: OrderInstallment): string {
    switch (row.status) {
      case 'scheduled':
        return installmentTriggerText(row, row.seq === 1, lang);
      case 'due':
        return row.dueAt
          ? `${row.overdue ? t('Melewati jatuh tempo', 'Past due since') : t('Jatuh tempo', 'Due')} ${formatDateTime(row.dueAt, lang)}`
          : t('Menunggu pembayaran', 'Awaiting payment');
      case 'awaiting_verification':
        return t('Bukti pembayaran menunggu verifikasi', 'Payment proof awaiting verification');
      case 'paid':
        return row.paidAt ? `${t('Lunas', 'Paid')} ${formatDateTime(row.paidAt, lang)}` : t('Lunas', 'Paid');
      default:
        return t('Dibatalkan bersama pesanan', 'Voided with the order');
    }
  }

  return (
    <AdminCard
      title={t('Jadwal pembayaran', 'Payment schedule')}
      desc={t(
        'Pesanan ini dibayar bertahap. Termin pertama mengikuti batas bayar pesanan; termin berikutnya ditagih otomatis saat pemicunya tercapai, atau lebih awal lewat tombol Tagih.',
        'This order is paid in stages. The first installment follows the order payment deadline; later ones are billed automatically when their trigger is reached, or earlier with the Bill button.',
      )}
    >
      {progress && (
        <div className={styles.progress}>
          <span>
            {t('Sudah dibayar', 'Paid')} <b>{formatMoney(progress.paidTotal, progress.currency)}</b>
          </span>
          <span>
            {t('Sisa tagihan', 'Balance due')} <b>{formatMoney(progress.outstandingTotal, progress.currency)}</b>
          </span>
          <span>
            {t('Total pesanan', 'Order total')} <b>{formatMoney(order.grandTotal, order.currency)}</b>
          </span>
          {isPartiallyPaid(order) && <StatusBadge label={partiallyPaidLabel[lang]} tone={partiallyPaidLabel.tone} small />}
        </div>
      )}

      <ol className={styles.list}>
        {rows.map((row) => {
          const label = installmentLabel(row);
          const awaiting = row.payments.find((payment) => payment.status === 'awaiting_verification') || null;
          const withProof = [...row.payments].reverse().find((payment) => payment.proof) || null;
          const hot = row.status === 'awaiting_verification' || (row.status === 'due' && row.overdue);
          return (
            <li key={row.id} className={`${styles.row} ${hot ? styles.rowHot : ''} ${row.status === 'void' ? styles.rowVoid : ''}`}>
              <div className={styles.head}>
                <span className={styles.seq}>{row.seq}</span>
                <span className={styles.title}>
                  <strong>{tr(row.label, lang)}</strong>
                  <small>
                    {formatPercent(row.percent, lang)} {t('dari total pesanan', 'of the order total')}
                  </small>
                </span>
                <span className={styles.amount}>{formatMoney(row.amount, row.currency)}</span>
                <StatusBadge label={label[lang]} tone={label.tone} small />
              </div>

              <div className={styles.meta}>
                <span>{whenText(row)}</span>
                {row.billedAt && row.seq > 1 && (
                  <span>
                    {t('Ditagih', 'Billed')} {formatDateTime(row.billedAt, lang)}
                  </span>
                )}
                {row.remindedAt && (
                  <span>
                    {t('Pengingat terakhir', 'Last reminder')} {formatDateTime(row.remindedAt, lang)} ({row.reminderCount}×)
                  </span>
                )}
              </div>

              {row.payments.length > 0 && (
                <ul className={styles.attempts}>
                  {row.payments.map((payment) => {
                    const pay = paymentLabel(payment.status);
                    return (
                      <li key={payment.id}>
                        <span>
                          {t('Percobaan bayar', 'Payment attempt')} #{payment.id}
                        </span>
                        <StatusBadge label={pay[lang]} tone={pay.tone} small />
                        {payment.rejectReason && (
                          <span>
                            {t('Alasan tolak', 'Reject reason')}: <b>{payment.rejectReason}</b>
                          </span>
                        )}
                        {payment.receivedAmount != null && (
                          <span>
                            {t('Diterima', 'Received')} <b>{formatMoney(payment.receivedAmount, payment.currency || row.currency)}</b>
                            {payment.bankCharges != null ? ` · ${t('biaya bank', 'bank charges')} ${formatMoney(payment.bankCharges, payment.currency || row.currency)}` : ''}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {(withProof?.proof || row.canBill || row.canChangeDue || row.canRemind || awaiting) && (
                <div className={styles.actions}>
                  {withProof?.proof && (
                    <FileLink
                      file={{ url: withProof.proof.url || `/api/v1/files/${withProof.proof.mediaId}`, name: withProof.proof.originalName, mime: withProof.proof.mime }}
                      className="btn btn-line btn-sm"
                    >
                      <Icon name="eye" size={15} /> {t('Lihat bukti', 'View proof')}
                    </FileLink>
                  )}
                  {awaiting && (
                    <>
                      <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => onAccept(awaiting)}>
                        <Icon name="check" size={14} /> {t('Verifikasi', 'Verify')}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => onReject(awaiting)}>
                        {t('Tolak bukti…', 'Reject proof…')}
                      </button>
                    </>
                  )}
                  {row.canBill && (
                    <button type="button" className="btn btn-solid btn-sm" disabled={busy} onClick={() => onBill(row)}>
                      {t('Tagih sekarang…', 'Bill now…')}
                    </button>
                  )}
                  {row.canRemind && (
                    <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => onRemind(row)}>
                      <Icon name="bell" size={14} /> {t('Kirim pengingat', 'Send reminder')}
                    </button>
                  )}
                  {row.canChangeDue && (
                    <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => onChangeDue(row)}>
                      {t('Ubah jatuh tempo…', 'Change due date…')}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </AdminCard>
  );
}
