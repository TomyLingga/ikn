// Label status order & pembayaran + urutan langkah tracking.
// Nilai status mengikuti kontrak (plan/02-api-contract.md bagian 9–10); data transaksi
// sepenuhnya dari API — file ini hanya menyimpan label UI dan helper baca flag.
import type {
  Order,
  OrderStatusKey,
  PaymentStatusKey,
  StatusLabel,
  StockStatus,
  AccountStatus,
} from '@/lib/types';

export const stockLabels: Record<StockStatus, StatusLabel> = {
  in_stock: { id: 'Tersedia', en: 'In stock', tone: 'ok' },
  made_to_order: { id: 'Pre-order', en: 'Made to order', tone: 'warn' },
  out_of_stock: { id: 'Stok habis', en: 'Out of stock', tone: 'bad' },
};

export const orderStatus: Record<OrderStatusKey, StatusLabel> = {
  pending_payment: { id: 'Menunggu Pembayaran', en: 'Awaiting Payment', tone: 'warn' },
  payment_review: { id: 'Verifikasi Pembayaran', en: 'Payment Review', tone: 'warn' },
  paid: { id: 'Dibayar', en: 'Paid', tone: 'ok' },
  processing: { id: 'Diproses', en: 'Processing', tone: 'info' },
  shipped: { id: 'Dikirim', en: 'Shipped', tone: 'info' },
  delivered: { id: 'Diterima', en: 'Delivered', tone: 'ok' },
  completed: { id: 'Selesai', en: 'Completed', tone: 'ok' },
  cancelled: { id: 'Dibatalkan', en: 'Cancelled', tone: 'bad' },
  expired: { id: 'Kedaluwarsa', en: 'Expired', tone: 'bad' },
};

export const paymentStatus: Record<PaymentStatusKey, StatusLabel> = {
  pending: { id: 'Belum Dibayar', en: 'Unpaid', tone: 'warn' },
  awaiting_verification: { id: 'Menunggu Verifikasi', en: 'Awaiting Verification', tone: 'warn' },
  paid: { id: 'Dibayar', en: 'Paid', tone: 'ok' },
  rejected: { id: 'Ditolak', en: 'Rejected', tone: 'bad' },
  expired: { id: 'Kedaluwarsa', en: 'Expired', tone: 'bad' },
  failed: { id: 'Gagal', en: 'Failed', tone: 'bad' },
  cancelled: { id: 'Dibatalkan', en: 'Cancelled', tone: 'bad' },
};

export const accountStatusLabels: Record<AccountStatus, StatusLabel> = {
  pending: { id: 'Menunggu persetujuan', en: 'Pending approval', tone: 'warn' },
  active: { id: 'Aktif', en: 'Active', tone: 'ok' },
  rejected: { id: 'Ditolak', en: 'Rejected', tone: 'bad' },
  inactive: { id: 'Nonaktif', en: 'Inactive', tone: 'bad' },
};

/** Urutan langkah tracking (state machine, tanpa cancelled/expired). */
export const trackingSteps: OrderStatusKey[] = [
  'pending_payment',
  'payment_review',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
];

/** Status akhir yang menghentikan tracking. */
export const terminalStatuses: OrderStatusKey[] = ['cancelled', 'expired'];

export function isTerminal(status: OrderStatusKey): boolean {
  return terminalStatuses.includes(status);
}

/** Label status dengan fallback untuk nilai tak dikenal (mis. kontrak berubah). */
export function orderLabel(status: string): StatusLabel {
  return orderStatus[status as OrderStatusKey] || { id: status, en: status, tone: 'info' };
}

export function paymentLabel(status: string): StatusLabel {
  return paymentStatus[status as PaymentStatusKey] || { id: status, en: status, tone: 'info' };
}

// ---- Helper aksi: hanya membaca flag dari API, tidak menebak dari status ----
export const canCancel = (order: Order): boolean => order.canCancel === true;
export const canUploadProof = (order: Order): boolean => order.canUploadProof === true;
export const canConfirmReceived = (order: Order): boolean => order.canConfirmReceived === true;
export const canComplete = (order: Order): boolean => order.canComplete === true;
export const canReview = (order: Order): boolean => order.canReview === true;
export const canChangePaymentMethod = (order: Order): boolean => order.canChangePayment === true;

/** Percobaan bayar yang sedang berlaku: `payment` dari API, atau yang terbaru dari `payments[]`. */
export function activePayment(order: Order) {
  if (order.activePayment) return order.activePayment;
  if (order.payment) return order.payment;
  const list = order.payments || [];
  return list.find((p) => p.status === 'pending' || p.status === 'awaiting_verification') || list[list.length - 1] || null;
}

/** Filter tab daftar pesanan → nilai `status` untuk `GET /customer/orders?status=`. */
export const orderFilters: { key: string; statuses: OrderStatusKey[]; id: string; en: string }[] = [
  { key: 'all', statuses: [], id: 'Semua', en: 'All' },
  { key: 'pending_payment', statuses: ['pending_payment'], id: 'Perlu Bayar', en: 'To Pay' },
  { key: 'payment_review', statuses: ['payment_review'], id: 'Verifikasi', en: 'Review' },
  { key: 'processing', statuses: ['paid', 'processing'], id: 'Diproses', en: 'Processing' },
  { key: 'shipped', statuses: ['shipped', 'delivered'], id: 'Dikirim', en: 'Shipped' },
  { key: 'completed', statuses: ['completed'], id: 'Selesai', en: 'Completed' },
  { key: 'cancelled', statuses: ['cancelled', 'expired'], id: 'Batal', en: 'Cancelled' },
];
