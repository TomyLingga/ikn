'use client';

import Icon from '@/components/Icon';
import { formatDateTime } from '@/lib/format';
import type { IconName, OrderStatusKey } from '@/lib/types';
import styles from './OrderProgress.module.css';

type Lang = 'id' | 'en';

// Order Loco (ASUMSI A-85): tahap "Dikirim" dibaca "Siap diambil"; order FOB/CIF (ASUMSI A-88): "Dimuat ke kapal".
// Order CIF (ASUMSI A-89, `quoted`): tahap "Penawaran ongkir" disisipkan sebelum "Dibayar".
const steps = (pickup: boolean, port = false, quoted = false): { id: string; en: string; icon: IconName }[] => [
  { id: 'Dipesan', en: 'Placed', icon: 'orders' },
  ...(quoted ? [{ id: 'Penawaran ongkir', en: 'Freight quote', icon: 'globe' as IconName }] : []),
  { id: 'Dibayar', en: 'Paid', icon: 'wallet' },
  { id: 'Diproses', en: 'Processing', icon: 'package' },
  pickup
    ? { id: 'Siap diambil', en: 'Ready for pickup', icon: 'factory' }
    : port
      ? { id: 'Dimuat ke kapal', en: 'Shipped on board', icon: 'globe' }
      : { id: 'Dikirim', en: 'Shipped', icon: 'truck' },
  { id: 'Selesai', en: 'Done', icon: 'checkCircle' },
];

/**
 * Index of the step in progress (1..4); 5 = everything done; -1 = cancelled/expired. Step 0 (placed) is always done.
 * `quoted` (order CIF) menambah satu tahap "Penawaran ongkir" di index 1, sehingga tahap berikutnya bergeser satu.
 */
export function orderStepIndex(status: OrderStatusKey | string, quoted = false): number {
  const shift = quoted ? 1 : 0;
  switch (status) {
    case 'awaiting_freight':
      return 1;
    case 'pending_payment':
    case 'payment_review':
      return 1 + shift;
    case 'paid':
    case 'processing':
      return 2 + shift;
    case 'shipped':
      return 3 + shift;
    case 'delivered':
      return 4 + shift;
    case 'completed':
      return 5 + shift;
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
  /** Order Loco: barang diambil customer di titik ambil (`pickupLabel`), bukan dikirim. */
  pickup?: boolean;
  pickupLabel?: string | null;
  /** Order FOB/CIF: barang dimuat ke kapal (nama kapal + B/L), bukan dikirim kurir. */
  port?: boolean;
  /** Order CIF awaiting_freight (ASUMSI A-89): true bila penawaran admin yang masih berlaku menunggu tanggapan customer. */
  canAcceptFreightQuote?: boolean;
}

/** Short "what happens next" copy per status, shared by the order list cards and the detail banner. */
export function orderNextStep(order: NextStepInput, lang: Lang): OrderNextStep {
  const t = (id: string, en: string) => (lang === 'en' ? en : id);
  const place = order.pickupLabel || t('pabrik', 'the factory');
  if (order.status === 'awaiting_freight') {
    return order.canAcceptFreightQuote
      ? {
          tone: 'warn',
          icon: 'globe',
          title: t('Penawaran ongkir sudah masuk', 'Freight quote ready'),
          body: t('Setujui penawaran atau ajukan harga lain.', 'Accept the quote or propose another price.'),
        }
      : {
          tone: 'info',
          icon: 'globe',
          title: t('Menunggu penawaran ongkir dari tim kami', 'Awaiting a freight quote from our team'),
          body: t('Instruksi pembayaran dan batas bayar menyusul setelah penawaran ongkir disepakati.', 'Payment instructions and the payment deadline follow once the freight quote is agreed.'),
        };
  }
  if (order.port && !order.pickup) {
    switch (order.status) {
      case 'paid':
      case 'processing':
        return {
          tone: 'info',
          icon: 'package',
          title: t('Pesanan sedang disiapkan', 'Your order is being prepared'),
          body: t('Kami kabari begitu barang dimuat ke kapal beserta nama kapal dan nomor B/L.', 'We will notify you with the vessel name and B/L number once the goods are shipped on board.'),
        };
      case 'shipped':
        return {
          tone: 'info',
          icon: 'globe',
          title: t('Barang dimuat ke kapal', 'Goods shipped on board'),
          body: order.canConfirmReceived
            ? t('Nama kapal dan nomor B/L ada di detail pesanan. Konfirmasi setelah barang sampai.', 'The vessel and B/L number are in the order details. Confirm once the goods arrive.')
            : t('Nama kapal, voyage, dan nomor B/L ada di detail pesanan.', 'The vessel, voyage, and B/L number are in the order details.'),
        };
      default:
        break;
    }
  }
  if (order.pickup) {
    switch (order.status) {
      case 'paid':
      case 'processing':
        return {
          tone: 'info',
          icon: 'package',
          title: t('Pesanan sedang disiapkan', 'Your order is being prepared'),
          body: t(`Kami kabari begitu barang siap diambil di ${place}.`, `We will notify you once the goods are ready for pickup at ${place}.`),
        };
      case 'shipped':
        return {
          tone: 'info',
          icon: 'factory',
          title: t('Barang siap diambil', 'Ready for pickup'),
          body: order.canConfirmReceived
            ? t(`Ambil barang di ${place}, lalu konfirmasi sudah diambil.`, `Collect the goods at ${place}, then confirm the pickup.`)
            : t(`Barang menunggu diambil di ${place}.`, `The goods are waiting for pickup at ${place}.`),
        };
      case 'delivered':
        return {
          tone: 'ok',
          icon: 'checkCircle',
          title: t('Barang sudah diambil', 'Goods picked up'),
          body: order.canComplete
            ? t('Selesaikan pesanan bila semuanya sesuai, lalu beri ulasan.', 'Complete the order if everything is right, then leave a review.')
            : t('Pesanan akan diselesaikan otomatis.', 'The order will be completed automatically.'),
        };
      default:
        break;
    }
  }
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
        body: t('Tim kami sedang memeriksa bukti bayar Anda.', 'Our team is checking your payment proof.'),
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
            body: t('Ulasan Anda membantu pelanggan lain memilih produk.', 'Your review helps other buyers choose a product.'),
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
export default function OrderProgress({ status, lang, compact = false, pickup = false, port = false, quoted = false }: { status: OrderStatusKey | string; lang: Lang; compact?: boolean; pickup?: boolean; port?: boolean; quoted?: boolean }) {
  // Status awaiting_freight selalu memakai tahap "Penawaran ongkir" walau pemanggil tidak menandai `quoted`.
  const withQuote = quoted || status === 'awaiting_freight';
  const current = orderStepIndex(status, withQuote);
  if (current < 0) return null;
  return (
    <ol className={`${styles.steps} ${compact ? styles.compact : ''}`} aria-label={lang === 'en' ? 'Order progress' : 'Progres pesanan'}>
      {steps(pickup, port, withQuote).map((step, i) => {
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
