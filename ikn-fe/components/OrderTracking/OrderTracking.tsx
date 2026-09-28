'use client';

import { useLang } from '@/components/LanguageProvider';
import { trackingSteps, orderLabel, isTerminal } from '@/lib/commerce';
import { formatDateTime } from '@/lib/format';
import type { OrderStatusKey } from '@/lib/types';
import styles from './OrderTracking.module.css';

interface TrackingOrder {
  status: string;
  timeline?: { status: string; at: string; note?: string | null }[] | null;
}

// Stepper pelacakan pesanan (pending_payment → … → completed). Tahap tercapai ditandai dari
// `timeline[]` dan posisi status saat ini; cancelled/expired ditampilkan sebagai catatan akhir.
export default function OrderTracking({ order }: { order: TrackingOrder }) {
  const { lang } = useLang();
  const timeline = order.timeline || [];
  const doneMap = new Map(timeline.map((entry) => [entry.status, entry]));
  const status = order.status as OrderStatusKey;
  const terminal = isTerminal(status);
  const currentIdx = terminal
    ? Math.max(...timeline.map((e) => trackingSteps.indexOf(e.status as OrderStatusKey)), -1)
    : trackingSteps.indexOf(status);

  return (
    <div>
      <ol className={styles.track}>
        {trackingSteps.map((step, i) => {
          const entry = doneMap.get(step);
          const reached = i <= currentIdx || !!entry;
          const label = orderLabel(step)[lang];
          return (
            <li key={step} className={`${styles.step} ${reached ? styles.done : ''} ${!terminal && i === currentIdx ? styles.current : ''}`}>
              <span className={styles.dot} />
              <div className={styles.body}>
                <span className={styles.label}>{label}</span>
                {entry?.at && <span className={styles.at}>{formatDateTime(entry.at, lang)}</span>}
                {entry?.note && <span className={styles.at}>{entry.note}</span>}
              </div>
            </li>
          );
        })}
      </ol>
      {terminal && (
        <div className={styles.cancelled}>
          {orderLabel(status)[lang]}
          {doneMap.get(status)?.at && <> · {formatDateTime(doneMap.get(status)?.at, lang)}</>}
          {doneMap.get(status)?.note && <> · {doneMap.get(status)?.note}</>}
        </div>
      )}
    </div>
  );
}
