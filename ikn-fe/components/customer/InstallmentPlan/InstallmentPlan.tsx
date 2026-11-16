'use client';

import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import { formatPercent, installmentTriggerText } from '@/lib/commerce';
import { formatMoney } from '@/lib/format';
import type { Currency, InstallmentScheduleRow } from '@/lib/types';
import styles from './InstallmentPlan.module.css';

interface Props {
  rows: InstallmentScheduleRow[];
  currency: Currency;
  /** Nominal belum final (order CIF sebelum ongkir disepakati): tampilkan persen saja. */
  amountsPending?: boolean;
}

/**
 * Jadwal termin dari syarat pembayaran yang dipilih, untuk ringkasan checkout (ASUMSI A-97): persen, kapan ditagih,
 * dan nominal bila server sudah menghitungnya (`QuoteResult.installments`).
 */
export default function InstallmentPlan({ rows, currency, amountsPending = false }: Props) {
  const { lang } = useLang();
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  if (rows.length === 0) return null;

  return (
    <div className={styles.plan}>
      <span className={styles.caption}>{t('Dibayar bertahap', 'Paid in stages')}</span>
      <ol className={styles.list}>
        {rows.map((row, index) => (
          <li key={row.key || index}>
            <span className={styles.name}>
              <strong>
                {tr(row.label, lang)} ({formatPercent(row.percent, lang)})
              </strong>
              <small>{installmentTriggerText(row, index === 0, lang)}</small>
            </span>
            {!amountsPending && row.amount != null && <span className={styles.amount}>{formatMoney(row.amount, currency)}</span>}
          </li>
        ))}
      </ol>
      {amountsPending && <small className={styles.pending}>{t('Nominal tiap termin dihitung dari total setelah ongkir disepakati.', 'Each installment amount is calculated from the total once the freight is agreed.')}</small>}
    </div>
  );
}
