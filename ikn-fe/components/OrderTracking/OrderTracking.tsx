'use client';

import { useLang } from '@/components/LanguageProvider';
import { trackingSteps, orderStatus } from '@/lib/commerce';
import { formatDateTime } from '@/lib/format';
import type { Order } from '@/lib/types';
import styles from './OrderTracking.module.css';

// Stepper pelacakan pesanan. Menandai tahap tercapai berdasarkan timeline.
export default function OrderTracking({ order }: { order: Order }) {
  const { lang } = useLang();

  if (order.status === 'cancelled') {
    return (
      <div className={styles.cancelled}>
        {lang === 'en' ? 'Order cancelled.' : 'Pesanan dibatalkan.'}
      </div>
    );
  }

  const doneMap = new Map((order.timeline || []).map((t) => [t.status, t.at]));
  // Jika status order sudah 'delivered' atau 'completed', maka seluruh tahapan hingga 'completed' dianggap selesai (hijau)
  const isFinished = order.status === 'completed' || order.status === 'delivered';
  const effectiveStatus = isFinished ? 'completed' : order.status;
  const currentIdx = trackingSteps.indexOf(effectiveStatus);

  return (
    <ol className={styles.track}>
      {trackingSteps.map((s, i) => {
        const reached = i <= currentIdx || doneMap.has(s) || (isFinished && (s === 'delivered' || s === 'completed'));
        const at = doneMap.get(s) || (s === 'completed' && isFinished ? doneMap.get('completed') || doneMap.get('delivered') : undefined);
        const labelText = orderStatus[s]?.[lang] || orderStatus[s]?.id || s;

        return (
          <li key={s} className={`${styles.step} ${reached ? styles.done : ''} ${i === currentIdx ? styles.current : ''}`}>
            <span className={styles.dot} />
            <div className={styles.body}>
              <span className={styles.label}>{labelText}</span>
              {at && <span className={styles.at}>{formatDateTime(at)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
