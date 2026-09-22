// Label status order & pembayaran + urutan langkah tracking.
// Data transaksi sepenuhnya dari API — file ini menyimpan label UI.
import type {
  OrderStatusKey,
  PaymentStatusKey,
  StatusLabel,
  StockStatus,
} from '@/lib/types';

export const stockLabels: Record<StockStatus, StatusLabel> = {
  in_stock: { id: 'Tersedia', en: 'In stock', tone: 'ok' },
  made_to_order: { id: 'Pre-order', en: 'Made to order', tone: 'warn' },
  out_of_stock: { id: 'Stok habis', en: 'Out of stock', tone: 'bad' },
};

export const orderStatus: Record<OrderStatusKey, StatusLabel> = {
  awaiting_payment: { id: 'Menunggu Pembayaran', en: 'Awaiting Payment', tone: 'warn' },
  awaiting_verification: { id: 'Menunggu Verifikasi', en: 'Awaiting Verification', tone: 'warn' },
  processing: { id: 'Diproses', en: 'Processing', tone: 'info' },
  packing: { id: 'Dikemas', en: 'Packing', tone: 'info' },
  shipped: { id: 'Dikirim', en: 'Shipped', tone: 'info' },
  delivered: { id: 'Diterima', en: 'Delivered', tone: 'ok' },
  completed: { id: 'Selesai', en: 'Completed', tone: 'ok' },
  cancelled: { id: 'Dibatalkan', en: 'Cancelled', tone: 'bad' },
};

export const paymentStatus: Record<PaymentStatusKey, StatusLabel> = {
  unpaid: { id: 'Belum Dibayar', en: 'Unpaid', tone: 'warn' },
  awaiting_confirmation: { id: 'Menunggu Konfirmasi', en: 'Awaiting Confirmation', tone: 'warn' },
  paid: { id: 'Dibayar', en: 'Paid', tone: 'ok' },
  rejected: { id: 'Ditolak', en: 'Rejected', tone: 'bad' },
  expired: { id: 'Kedaluwarsa', en: 'Expired', tone: 'bad' },
};

export const trackingSteps: OrderStatusKey[] = [
  'awaiting_payment',
  'awaiting_verification',
  'processing',
  'packing',
  'shipped',
  'delivered',
  'completed',
];
