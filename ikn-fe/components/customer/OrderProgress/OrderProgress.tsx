'use client';

import Icon from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import type { IconName, OrderStatusKey } from '@/lib/types';
import styles from './OrderProgress.module.css';

type Lang = 'id' | 'en';

const STEPS: { id: string; en: string; icon: IconName }[] = [
  { id: 'Dipesan', en: 'Placed', icon: 'orders' },
  { id: 'Dibayar', en: 'Paid', icon: 'wallet' },
  { id: 'Diproses', en: 'Processing', icon: 'package' },
  { id: 'Dikirim', en: 'Shipped', icon: 'truck' },
  { id: 'Selesai', en: 'Done', icon: 'checkCircle' },
];

/** Index of the step in progress (1..4); 5 = everything done; -1 = cancelled/expired. Step 0 (placed) is always done. */
export function orderStepIndex(status: OrderStatusKey | string): number {
  switch (status) {
    case 'pending_payment':
    case 'payment_review':
      return 1;
    case 'paid':
    case 'processing':
      return 2;
    case 'shipped':
      return 3;
    case 'delivered':
      return 4;
    case 'completed':
      return 5;
    default:
      return -1;
  }
}

export interface OrderNextStep {
  tone: 'warn' | 'info' | 'ok' | 'bad';
  icon: IconName;
  title: string;
  body: string;
}

interface NextStepInput {
  status: OrderStatusKey | string;
  paymentDueAt?: string | null;
  canUploadProof?: boolean | null;
  canConfirmReceived?: boolean;
  canComplete?: boolean;
  canReview?: boolean | null;
}

/** Short "what happens next" copy per status, shared by the order list cards and the detail banner. */
export function orderNextStep(order: NextStepInput, lang: Lang): OrderNextStep {
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  switch (order.status) {
    case 'pending_payment':
      return {
        tone: 'warn',
        icon: 'wallet',
        title: order.canUploadProof === false ? t('Selesaikan pembayaran', 'Complete the payment') : t('Bayar & unggah bukti transfer', 'Pay and upload the transfer proof'),
        body: order.paymentDueAt
          ? `${t('Batas bayar', 'Pay before')} ${formatDateTime(order.paymentDueAt, lang)}`
          : t('Pesanan diproses setelah pembayaran diterima.', 'We process the order once payment is received.'),
      };
    case 'payment_review':
      return {
        tone: 'info',
        icon: 'shieldCheck',
        title: t('Pembayaran sedang diverifikasi', 'Payment under review'),
        body: t('Tim kami memeriksa bukti bayar Anda, biasanya di hari kerja yang sama.', 'Our team is checking your payment proof, usually within the same business day.'),
      };
    case 'paid':
    case 'processing':
      return {
        tone: 'info',
        icon: 'package',
        title: t('Pesanan sedang disiapkan', 'Your order is being prepared'),
        body: t('Kami kabari begitu barang dikirim beserta nomor resinya.', 'We will notify you with the tracking number once it ships.'),
      };
    case 'shipped':
      return {
        tone: 'info',
        icon: 'truck',
        title: t('Pesanan dalam perjalanan', 'Your order is on the way'),
        body: order.canConfirmReceived
          ? t('Konfirmasi setelah barang sampai di lokasi Anda.', 'Confirm once the goods arrive at your site.')
          : t('Pantau catatan perjalanan kiriman di detail pesanan.', 'Follow the shipment notes in the order details.'),
      };
    case 'delivered':
      return {
        tone: 'ok',
        icon: 'checkCircle',
        title: t('Barang sudah diterima', 'Goods received'),
        body: order.canComplete
          ? t('Selesaikan pesanan bila semuanya sesuai, lalu beri ulasan.', 'Complete the order if everything is right, then leave a review.')
          : t('Pesanan akan diselesaikan otomatis.', 'The order will be completed automatically.'),
      };
    case 'completed':
      return order.canReview
        ? {
            tone: 'ok',
            icon: 'star',
            title: t('Bagikan ulasan Anda', 'Share your review'),
            body: t('Ulasan membantu customer lain memilih produk yang tepat.', 'Reviews help other buyers choose the right product.'),
          }
        : { tone: 'ok', icon: 'checkCircle', title: t('Pesanan selesai', 'Order completed'), body: t('Terima kasih telah berbelanja di PT IKN.', 'Thank you for ordering from PT IKN.') };
    case 'expired':
      return {
        tone: 'bad',
        icon: 'clock',
        title: t('Batas pembayaran terlewat', 'Payment window expired'),
        body: t('Buat pesanan baru bila masih membutuhkan produk ini.', 'Place a new order if you still need these products.'),
      };
    default:
      return {
        tone: 'bad',
        icon: 'cancelCircle',
        title: t('Pesanan dibatalkan', 'Order cancelled'),
        body: t('Anda bisa memesan ulang kapan saja dari katalog.', 'You can reorder anytime from the catalog.'),
      };
  }
}

// Compact 5-step progress (Placed, Paid, Processing, Shipped, Done) for order cards and the detail banner.
export default function OrderProgress({ status, lang, compact = false }: { status: OrderStatusKey | string; lang: Lang; compact?: boolean }) {
  const current = orderStepIndex(status);
  if (current < 0) return null;
  return (
    <ol className={`${styles.steps} ${compact ? styles.compact : ''}`} aria-label={lang === 'en' ? 'Order progress' : 'Progres pesanan'}>
      {STEPS.map((step, i) => {
        const isDone = i < current;
        const isNow = i === current;
        return (
          <li key={step.id} className={isDone ? styles.done : isNow ? styles.now : undefined} aria-current={isNow ? 'step' : undefined}>
            <span className={styles.dot}>
              <Icon name={isDone ? 'check' : step.icon} size={compact ? 12 : 14} />
            </span>
            <span className={styles.label}>{step[lang]}</span>
          </li>
        );
      })}
    </ol>
  );
}
