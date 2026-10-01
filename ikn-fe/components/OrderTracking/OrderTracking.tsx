'use client';

import { useLang } from '@/components/LanguageProvider';
import { trackingSteps, orderLabel, isTerminal } from '@/lib/commerce';
import { formatDateTime } from '@/lib/format';
import type { OrderStatusKey, TrackingUpdate } from '@/lib/types';
import styles from './OrderTracking.module.css';

interface TrackingOrder {
  status: string;
  timeline?: { status: string; at: string; note?: string | null }[] | null;
  trackingUpdates?: TrackingUpdate[] | null;
}

interface OrderTrackingProps {
  order: TrackingOrder;
  /** Admin: tampilkan tombol hapus pada catatan perjalanan (hanya selama order berstatus dikirim). */
  onRemoveUpdate?: (update: TrackingUpdate) => void;
  removeDisabled?: boolean;
}

// Stepper pelacakan pesanan (pending_payment → … → completed). Tahap tercapai ditandai dari
// `timeline[]` dan posisi status saat ini; cancelled/expired ditampilkan sebagai catatan akhir.
// Catatan perjalanan dari admin (`trackingUpdates[]`, ASUMSI A-70) tampil berurutan di bawah tahap "Dikirim".
export default function OrderTracking({ order, onRemoveUpdate, removeDisabled = false }: OrderTrackingProps) {
  const { lang } = useLang();
  const timeline = order.timeline || [];
  const updates = order.trackingUpdates || [];
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
          const showUpdates = step === 'shipped' && updates.length > 0;
          return (
            <li key={step} className={`${styles.step} ${reached ? styles.done : ''} ${!terminal && i === currentIdx ? styles.current : ''}`}>
              <span className={styles.dot} />
              <div className={styles.body}>
                <span className={styles.label}>{label}</span>
                {entry?.at && <span className={styles.at}>{formatDateTime(entry.at, lang)}</span>}
                {entry?.note && <span className={styles.note}>{entry.note}</span>}
                {showUpdates && (
                  <ol className={styles.updates} aria-label={lang === 'en' ? 'Shipping updates' : 'Catatan perjalanan'}>
                    {updates.map((update, index) => (
                      <li key={update.id} className={`${styles.update} ${index === updates.length - 1 && status === 'shipped' ? styles.updateLatest : ''}`}>
                        <span className={styles.updateDot} />
                        <span className={styles.updateBody}>
                          <span className={styles.updateNote}>{update.note}</span>
                          <span className={styles.at}>{formatDateTime(update.at, lang)}</span>
                        </span>
                        {onRemoveUpdate && (
                          <button
                            type="button"
                            className={styles.updateRemove}
                            disabled={removeDisabled}
                            onClick={() => onRemoveUpdate(update)}
                            aria-label={`${lang === 'en' ? 'Delete note' : 'Hapus catatan'}: ${update.note}`}
                            title={lang === 'en' ? 'Delete note' : 'Hapus catatan'}
                          >
                            ×
                          </button>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
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
