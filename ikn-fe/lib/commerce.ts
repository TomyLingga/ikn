// Label status order & pembayaran + urutan langkah tracking.
// Nilai status mengikuti kontrak (plan/02-api-contract.md bagian 9–10); data transaksi
// sepenuhnya dari API — file ini hanya menyimpan label UI dan helper baca flag.
import { formatDate } from '@/lib/format';
import type { I18n } from '@/lib/cms';
import type {
  Currency,
  FactoryPickupPoint,
  FreightQuote,
  FreightQuoteStatus,
  Order,
  OrderAddressSnapshot,
  OrderDestinationPort,
  OrderStatusKey,
  PaymentStatusKey,
  PickupAddressSnapshot,
  PortAddressSnapshot,
  Product,
  StatusLabel,
  ShippingBreakdown,
  ShippingOrigin,
  StockStatus,
  AccountStatus,
} from '@/lib/types';

export const stockLabels: Record<StockStatus, StatusLabel> = {
  in_stock: { id: 'Tersedia', en: 'In stock', tone: 'ok' },
  made_to_order: { id: 'Pre-order', en: 'Made to order', tone: 'warn' },
  out_of_stock: { id: 'Stok habis', en: 'Out of stock', tone: 'bad' },
};

export const orderStatus: Record<OrderStatusKey, StatusLabel> = {
  // Order CIF (ASUMSI A-89): ongkir ditawarkan admin dulu; payment dan batas bayar dibuat setelah disepakati.
  awaiting_freight: { id: 'Menunggu penawaran ongkir', en: 'Awaiting freight quote', tone: 'warn' },
  pending_payment: { id: 'Menunggu pembayaran', en: 'Awaiting payment', tone: 'warn' },
  payment_review: { id: 'Verifikasi pembayaran', en: 'Payment review', tone: 'warn' },
  paid: { id: 'Dibayar', en: 'Paid', tone: 'ok' },
  processing: { id: 'Diproses', en: 'Processing', tone: 'info' },
  shipped: { id: 'Dikirim', en: 'Shipped', tone: 'info' },
  delivered: { id: 'Diterima', en: 'Delivered', tone: 'ok' },
  completed: { id: 'Selesai', en: 'Completed', tone: 'ok' },
  cancelled: { id: 'Dibatalkan', en: 'Cancelled', tone: 'bad' },
  expired: { id: 'Kedaluwarsa', en: 'Expired', tone: 'bad' },
};

export const paymentStatus: Record<PaymentStatusKey, StatusLabel> = {
  pending: { id: 'Belum dibayar', en: 'Unpaid', tone: 'warn' },
  awaiting_verification: { id: 'Menunggu verifikasi', en: 'Awaiting verification', tone: 'warn' },
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

/** Urutan langkah tracking (state machine, tanpa cancelled/expired). Order CIF mendapat `awaiting_freight` di depan (lihat trackingStepsFor). */
export const trackingSteps: OrderStatusKey[] = [
  'pending_payment',
  'payment_review',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'completed',
];

/**
 * Langkah tracking untuk satu order: order CIF (status `awaiting_freight`, atau pernah melewatinya menurut timeline,
 * atau ongkirnya tipe `quoted`) mendapat langkah "Penawaran ongkir" sebelum "Menunggu pembayaran".
 */
export function trackingStepsFor(order: { status: string; timeline?: { status: string }[] | null; shippingMethod?: { type?: string | null } | null; destinationPort?: unknown } | null | undefined): OrderStatusKey[] {
  if (!order) return trackingSteps;
  const quoted = order.status === 'awaiting_freight' || (order.timeline || []).some((entry) => entry.status === 'awaiting_freight') || isQuotedFreightOrder(order);
  return quoted ? ['awaiting_freight', ...trackingSteps] : trackingSteps;
}

/** Status akhir yang menghentikan tracking. */
export const terminalStatuses: OrderStatusKey[] = ['cancelled', 'expired'];

export function isTerminal(status: OrderStatusKey): boolean {
  return terminalStatuses.includes(status);
}

/** Order Loco (ASUMSI A-85): status shipped/delivered sama, tetapi teksnya "Siap diambil"/"Sudah diambil". */
const pickupStatus: Partial<Record<OrderStatusKey, StatusLabel>> = {
  shipped: { id: 'Siap diambil', en: 'Ready for pickup', tone: 'info' },
  delivered: { id: 'Sudah diambil', en: 'Picked up', tone: 'ok' },
};

/** Order FOB/CIF (ASUMSI A-88): shipped = barang dimuat ke kapal (nama kapal + B/L), bukan dikirim kurir. */
const portStatus: Partial<Record<OrderStatusKey, StatusLabel>> = {
  shipped: { id: 'Dimuat ke kapal', en: 'Shipped on board', tone: 'info' },
};

/** Varian teks status menurut cara serah terima: Loco (`pickup`), FOB/CIF (`port`), atau diantar (undefined). */
export type OrderLabelVariant = 'pickup' | 'port' | undefined;

/**
 * Label status dengan fallback untuk nilai tak dikenal (mis. kontrak berubah). `variant` = `'pickup'` untuk order
 * Loco, `'port'` untuk order FOB/CIF; `true` masih diterima sebagai alias `'pickup'` (pemanggil lama).
 */
export function orderLabel(status: string, variant: OrderLabelVariant | boolean = undefined): StatusLabel {
  const kind = variant === true ? 'pickup' : variant || undefined;
  const special = kind === 'pickup' ? pickupStatus[status as OrderStatusKey] : kind === 'port' ? portStatus[status as OrderStatusKey] : undefined;
  return special || orderStatus[status as OrderStatusKey] || { id: status, en: status, tone: 'info' };
}

type OrderLike = {
  deliveryTerm?: { family?: string | null } | null;
  pickup?: unknown;
  isPort?: boolean;
  shippingAddress?: OrderAddressSnapshot | null;
  shippingMethod?: { type?: string | null } | null;
};

/** Varian label untuk order penuh atau ringkasan: `'pickup'` (Loco), `'port'` (FOB/CIF), atau undefined. */
export function orderVariant(order: OrderLike | null | undefined): OrderLabelVariant {
  if (isPickupOrder(order)) return 'pickup';
  if (isPortOrder(order)) return 'port';
  return undefined;
}

/** Order (penuh atau ringkasan) diserahkan dengan cara Loco: dari term, titik ambil, atau tipe baris ongkir. */
export function isPickupOrder(
  order: { deliveryTerm?: { family?: string | null } | null; pickup?: unknown; shippingMethod?: { type?: string | null } | null } | null | undefined,
): boolean {
  if (!order) return false;
  return order.deliveryTerm?.family === 'pickup' || !!order.pickup || order.shippingMethod?.type === 'pickup';
}

/** Snapshot alamat order adalah titik ambil Loco (tanpa kode wilayah), bukan alamat customer. */
export function isPickupAddress(address: OrderAddressSnapshot | null | undefined): address is PickupAddressSnapshot {
  return !!address && (address as PickupAddressSnapshot).type === 'pickup';
}

/** Snapshot alamat order FOB: pelabuhan muat + identitas perusahaan pembeli (ASUMSI A-86). */
export function isPortAddress(address: OrderAddressSnapshot | null | undefined): address is PortAddressSnapshot {
  return !!address && (address as PortAddressSnapshot).type === 'port';
}

/** Order (penuh atau ringkasan) diserahkan di pelabuhan muat (term keluarga port: FOB Belawan, CIF). */
export function isPortOrder(
  order: { deliveryTerm?: { family?: string | null } | null; isPort?: boolean; shippingAddress?: OrderAddressSnapshot | null; shippingMethod?: { type?: string | null } | null } | null | undefined,
): boolean {
  if (!order) return false;
  return order.isPort === true || order.deliveryTerm?.family === 'port' || isPortAddress(order.shippingAddress) || order.shippingMethod?.type === 'included';
}

/** Teks ringkas kapal/B/L setelah dimuat ke kapal: "MV Meratus Medan · Voyage V.012 · B/L MDN-001 (03 Nov 2026)". */
export function shipmentDetailsText(details: { vessel?: string | null; voyage?: string | null; blNumber?: string | null; blDate?: string | null } | null | undefined, lang: 'id' | 'en'): string {
  if (!details) return '';
  const parts: string[] = [];
  if (details.vessel) parts.push(details.vessel);
  if (details.voyage) parts.push(`Voyage ${details.voyage}`);
  if (details.blNumber) parts.push(`B/L ${details.blNumber}${details.blDate ? ` (${formatDate(details.blDate, lang)})` : ''}`);
  return parts.join(' · ');
}

/** Snapshot alamat kirim biasa (bukan titik ambil Loco, bukan pelabuhan FOB). */
export function deliveryAddress(address: OrderAddressSnapshot | null | undefined) {
  return address && !isPickupAddress(address) && !isPortAddress(address) ? address : null;
}

/** Teks pendek pelabuhan muat untuk label FOB, mis. "FOB Belawan" (nama term sudah memuatnya; ini cadangan). */
export function loadingPortText(order: { deliveryTerm?: { loadingPort?: string | null } | null; shippingAddress?: OrderAddressSnapshot | null } | null | undefined): string {
  if (!order) return '';
  return order.deliveryTerm?.loadingPort || (isPortAddress(order.shippingAddress) ? order.shippingAddress.loadingPort || '' : '');
}

// ---- Penawaran ongkir CIF (ASUMSI A-89) ----

/** Order CIF: ongkir lewat penawaran admin (term `pricingMode quoted`, baris ongkir `type quoted`, atau punya pelabuhan tujuan). */
export function isQuotedFreightOrder(
  order: { deliveryTerm?: { pricingMode?: string | null } | null; shippingMethod?: { type?: string | null } | null; destinationPort?: unknown; freightQuotes?: unknown[] } | null | undefined,
): boolean {
  if (!order) return false;
  return order.deliveryTerm?.pricingMode === 'quoted' || order.shippingMethod?.type === 'quoted' || !!order.destinationPort || (order.freightQuotes?.length ?? 0) > 0;
}

/** Label status satu putaran penawaran ongkir (badge di riwayat putaran). */
export const freightQuoteStatus: Record<FreightQuoteStatus, StatusLabel> = {
  proposed: { id: 'Menunggu tanggapan', en: 'Awaiting response', tone: 'warn' },
  accepted: { id: 'Disepakati', en: 'Accepted', tone: 'ok' },
  rejected: { id: 'Ditolak', en: 'Rejected', tone: 'bad' },
  superseded: { id: 'Diganti', en: 'Superseded', tone: 'info' },
  expired: { id: 'Kedaluwarsa', en: 'Expired', tone: 'bad' },
};

/** Label putaran: `expired: true` menang atas `proposed` (penawaran lewat masa berlaku yang belum ditandai scheduler). */
export function freightQuoteLabel(quote: Pick<FreightQuote, 'status' | 'expired'>): StatusLabel {
  if (quote.status === 'proposed' && quote.expired) return freightQuoteStatus.expired;
  return freightQuoteStatus[quote.status] || { id: quote.status, en: quote.status, tone: 'info' };
}

/** Teks pelabuhan tujuan "Port Klang, Malaysia" (negara bila ada). */
export function destinationPortText(port: OrderDestinationPort | null | undefined): string {
  if (!port) return '';
  return [port.name, port.country].filter(Boolean).join(', ');
}

/** Label baris ongkir/penawaran: teks bebas apa adanya, atau {id,en} menurut bahasa. */
export function freightLineLabel(label: string | I18n | null | undefined, lang: 'id' | 'en'): string {
  if (!label) return '';
  if (typeof label === 'string') return label;
  return label[lang] || label.id || label.en || '';
}

/** Teks warning quote `freight_quote_pending` (ringkasan checkout CIF). */
export const freightQuotePendingText: StatusLabel = {
  id: 'Ongkir CIF: kami tawarkan setelah pesanan dibuat',
  en: 'CIF freight: quoted by our team after the order is placed',
  tone: 'info',
};

/** Label bawaan baris penawaran admin (bisa diubah di modal). */
export const DEFAULT_FREIGHT_LINE_LABELS = ['Ocean freight', 'Port charges', 'Insurance'];

/**
 * Harga produk menurut mata uang yang dikirim server (ASUMSI A-86): USD = `priceUsd` tanpa promo; IDR = harga
 * efektif + harga normal untuk coretan promo. `amount` null = tidak ada harga di mata uang ini (tidak bisa dipesan).
 */
export function productPrice(product: Pick<Product, 'currency' | 'price' | 'promoPrice' | 'effectivePrice' | 'priceUsd'>): {
  currency: Currency;
  amount: number | null;
  base: number | null;
  promo: boolean;
} {
  const currency: Currency = product.currency === 'USD' ? 'USD' : 'IDR';
  if (currency === 'USD') return { currency, amount: product.priceUsd ?? null, base: null, promo: false };
  const base = product.price ?? null;
  const amount = product.effectivePrice ?? base;
  const promo = product.promoPrice != null && base != null && product.promoPrice < base;
  return { currency, amount, base, promo };
}

/** Produk ber-harga tetap yang tidak punya harga di mata uang pengunjung (customer ekspor, `priceUsd` null). */
export function priceUnavailable(product: Pick<Product, 'priceMode' | 'currency' | 'price' | 'promoPrice' | 'effectivePrice' | 'priceUsd'>): boolean {
  return product.priceMode === 'fixed' && productPrice(product).amount == null;
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
export const canAcceptFreightQuote = (order: Order): boolean => order.canAcceptFreightQuote === true;
export const canCounterFreightQuote = (order: Order): boolean => order.canCounterFreightQuote === true;
export const canQuoteFreight = (order: Order): boolean => order.canQuoteFreight === true;

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
  { key: 'pending_payment', statuses: ['awaiting_freight', 'pending_payment'], id: 'Perlu Bayar', en: 'To Pay' },
  { key: 'payment_review', statuses: ['payment_review'], id: 'Verifikasi', en: 'Review' },
  { key: 'processing', statuses: ['paid', 'processing'], id: 'Diproses', en: 'Processing' },
  { key: 'shipped', statuses: ['shipped', 'delivered'], id: 'Dikirim', en: 'Shipped' },
  { key: 'completed', statuses: ['completed'], id: 'Selesai', en: 'Completed' },
  { key: 'cancelled', statuses: ['cancelled', 'expired'], id: 'Batal', en: 'Cancelled' },
];

/** Rincian ongkir tiga parameter dalam satu baris, mis. "Dasar Rp 20.000 · Jarak Rp 15.000 · Berat Rp 6.000 · Volume Rp 30.000". */
export function shippingBreakdownText(breakdown: ShippingBreakdown, lang: 'id' | 'en'): string {
  const fmt = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const parts: string[] = [];
  if (breakdown.base) parts.push(`${lang === 'en' ? 'Base' : 'Dasar'} ${fmt(breakdown.base)}`);
  if (breakdown.distance) parts.push(`${lang === 'en' ? 'Distance' : 'Jarak'} ${fmt(breakdown.distance)}`);
  if (breakdown.weight) parts.push(`${lang === 'en' ? 'Weight' : 'Berat'} ${fmt(breakdown.weight)}`);
  if (breakdown.volume) parts.push(`${lang === 'en' ? 'Volume' : 'Volume'} ${fmt(breakdown.volume)}`);
  const text = parts.join(' · ');
  return breakdown.minimumApplied ? `${text} (${lang === 'en' ? 'minimum charge applies' : 'berlaku ongkir minimum'})` : text;
}

/**
 * Ringkasan parameter kiriman order: "±120 km · 3,5 kg · 0,06 m³". Untuk ongkir beberapa pabrik (ASUMSI A-90) server
 * mengirim berat/volume total dan jarak terjauh, jadi jarak diberi awalan "≤".
 */
export function shipmentMetricsText(
  method: { distanceKm?: number | null; weightGram?: number; volumeCm3?: number; origins?: ShippingOrigin[] | null } | null | undefined,
): string {
  if (!method) return '';
  const parts: string[] = [];
  const multi = (method.origins?.length ?? 0) > 1;
  if (method.distanceKm) parts.push(`${multi ? '≤' : '±'}${method.distanceKm.toLocaleString('id-ID')} km`);
  if (method.weightGram) parts.push(`${(method.weightGram / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} kg`);
  if (method.volumeCm3) parts.push(`${(method.volumeCm3 / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 3 })} m³`);
  return parts.join(' · ');
}

// ---- Dua pabrik (ASUMSI A-90) ----

/** Ongkir dihitung dari lebih dari satu pabrik asal (rincian per pabrik perlu ditampilkan). */
export function hasMultipleOrigins(method: { origins?: ShippingOrigin[] | null } | null | undefined): boolean {
  return (method?.origins?.length ?? 0) > 1;
}

/** Satu baris rincian per pabrik: "Dari Pabrik Tanjung Morawa: ±120 km · 3,5 kg · Rp 45.000". Jumlah semua baris = ongkir tarif. */
export function shippingOriginText(origin: ShippingOrigin, lang: 'id' | 'en'): string {
  const name = origin.factory ? origin.factory.name[lang] || origin.factory.name.id || origin.factory.code : lang === 'en' ? 'Factory' : 'Pabrik';
  const metrics = shipmentMetricsText(origin);
  const amount = origin.breakdown?.free ? (lang === 'en' ? 'Free' : 'Gratis') : `Rp ${origin.amount.toLocaleString('id-ID')}`;
  return `${lang === 'en' ? 'From' : 'Dari'} ${name}: ${metrics ? `${metrics} · ` : ''}${amount}`;
}

/**
 * Titik ambil Loco order: `pickupPoints[]` dari API, lalu `shippingAddress.points[]`, lalu satu titik dari `pickup`
 * (order lama tanpa kode pabrik). Kosong untuk order bukan Loco.
 */
export function orderPickupPoints(order: { pickupPoints?: FactoryPickupPoint[] | null; pickup?: { label: string | null; address: string | null; lat: number | null; lng: number | null } | null; shippingAddress?: OrderAddressSnapshot | null } | null | undefined): FactoryPickupPoint[] {
  if (!order) return [];
  if (order.pickupPoints && order.pickupPoints.length > 0) return order.pickupPoints;
  if (isPickupAddress(order.shippingAddress) && order.shippingAddress.points?.length) return order.shippingAddress.points;
  if (order.pickup) return [{ code: null, name: null, label: order.pickup.label, address: order.pickup.address, lat: order.pickup.lat, lng: order.pickup.lng, items: [] }];
  return [];
}

/** Nama titik ambil dalam bahasa tampilan (nama pabrik bila ada, else label beku saat checkout). */
export function pickupPointName(point: Pick<FactoryPickupPoint, 'name' | 'label'>, lang: 'id' | 'en'): string {
  return (point.name ? point.name[lang] || point.name.id : '') || point.label || '';
}

/** Gabungan nama titik ambil: "A", "A dan B", "A, B, dan C" (EN: and). */
export function joinNames(names: string[], lang: 'id' | 'en'): string {
  const list = names.filter(Boolean);
  const and = lang === 'en' ? 'and' : 'dan';
  if (list.length <= 1) return list[0] || '';
  if (list.length === 2) return `${list[0]} ${and} ${list[1]}`;
  return `${list.slice(0, -1).join(', ')}, ${and} ${list[list.length - 1]}`;
}

/** Nama produk untuk daftar "Diambil di sini" dari slug titik ambil (cadangan: slug). */
export function pickupItemNames(point: Pick<FactoryPickupPoint, 'items'>, items: { productSlug: string; name: I18n }[], lang: 'id' | 'en'): string[] {
  return (point.items || []).map((slug) => {
    const item = items.find((entry) => entry.productSlug === slug);
    return item ? item.name[lang] || item.name.id : slug;
  });
}
