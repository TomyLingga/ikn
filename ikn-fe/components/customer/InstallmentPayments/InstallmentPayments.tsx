'use client';

import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import PaymentInstructions from '@/components/PaymentInstructions';
import PaymentProof from '@/components/PaymentProof';
import StatusBadge from '@/components/StatusBadge';
import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import { formatPercent, installmentLabel, installmentTriggerText } from '@/lib/commerce';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { CommerceConfig, Order, OrderInstallment } from '@/lib/types';
import styles from './InstallmentPayments.module.css';

interface Props {
  order: Order;
  config: CommerceConfig | null;
  /**
   * Isi termin pertama selama belum lunas: blok pembayaran order yang sudah ada (instruksi, unggah bukti, ganti
   * metode), karena termin pertama mengikuti alur order.
   */
  first: ReactNode;
  /** Unggah bukti termin lanjutan (pemanggil mengirim `installmentId`). */
  onUpload: (installment: OrderInstallment, file: File) => Promise<unknown>;
}

/**
 * Kartu "Jadwal pembayaran" di detail pesanan customer (ASUMSI A-97): setiap termin dengan persen, nominal, dan status.
 * Termin yang sedang ditagih menampilkan instruksi bayar + unggah bukti; yang lunas menampilkan tanggal lunas; yang
 * belum ditagih menjelaskan kapan akan ditagih.
 */
export default function InstallmentPayments({ order, config, first, onUpload }: Props) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const rows = order.installments || [];
  const progress = order.paymentProgress;

  return (
    <div className={styles.wrap}>
      {progress && (
        <dl className={styles.progress}>
          <div>
            <dt>{t('Sudah dibayar', 'Paid')}</dt>
            <dd>{formatMoney(progress.paidTotal, progress.currency)}</dd>
          </div>
          <div>
            <dt>{t('Sisa tagihan', 'Balance due')}</dt>
            <dd>{formatMoney(progress.outstandingTotal, progress.currency)}</dd>
          </div>
        </dl>
      )}

      <ol className={styles.list}>
        {rows.map((row) => {
          const label = installmentLabel(row);
          const isFirst = row.seq === 1;
          const open = row.status === 'due' || row.status === 'awaiting_verification';
          return (
            <li key={row.id} className={`${styles.row} ${open ? styles.rowOpen : ''} ${row.status === 'void' ? styles.rowVoid : ''}`}>
              <div className={styles.head}>
                <span className={styles.seq}>{row.seq}</span>
                <span className={styles.title}>
                  <strong>{tr(row.label, lang)}</strong>
                  <small>
                    {formatPercent(row.percent, lang)} {t('dari total', 'of the total')} · {formatMoney(row.amount, row.currency)}
                  </small>
                </span>
                <StatusBadge label={label[lang]} tone={label.tone} small />
              </div>

              {row.status === 'scheduled' && <p className={styles.note}>{installmentTriggerText(row, isFirst, lang)}.</p>}

              {row.status === 'paid' && (
                <p className={styles.paid}>
                  <Icon name="check" size={16} /> {t('Lunas', 'Paid')}
                  {row.paidAt ? ` ${formatDateTime(row.paidAt, lang)}` : ''}
                </p>
              )}

              {row.status === 'void' && <p className={styles.note}>{t('Tidak ditagih karena pesanan dibatalkan.', 'Not billed because the order was cancelled.')}</p>}

              {open && isFirst && <div className={styles.body}>{first}</div>}

              {open && !isFirst && (
                <div className={styles.body}>
                  {row.status === 'due' && <PaymentInstructions order={order} config={config} installment={row} />}
                  <PaymentProof order={order} payment={row.activePayment} installment={row} onUpload={(file) => onUpload(row, file)} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
