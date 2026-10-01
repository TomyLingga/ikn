// ============================ TIPE & HELPER PANEL ADMIN COMMERCE ============================
// Bentuk data endpoint /admin/* commerce (order, payment, katalog, customer, konfigurasi, laporan,
// audit) sesuai Resource di ikn-api. Tipe customer/publik ada di lib/types.ts (milik FE-A) dan
// tidak diduplikasi di sini; file ini hanya menambah superset admin + label UI + helper kecil.

import type { I18n, MediaSummary, PagedMeta } from '@/lib/cms';
import type {
  AccountStatus,
  BankAccountInfo,
  CustomerAddress,
  OrderStatusKey,
  OrderSummary,
  Payment,
  PaymentMethodType,
  PaymentStatusKey,
  Product,
  RegionLevel,
  StatusLabel,
  StockStatus,
} from '@/lib/types';

// ---- Pembayaran (GET /admin/payments, /admin/payments/{id}) ----
export interface AdminPaymentOrder {
  id: number;
  number: string;
  invoiceNumber: string | null;
  status: OrderStatusKey;
  paymentStatus: PaymentStatusKey;
  customer: { id: number; name: string; company: string | null; pic: string; email: string };
  grandTotal: number;
  uniqueCode: number;
  paymentDueAt: string | null;
  paidAt: string | null;
  date: string;
}

/** AdminPaymentResource: PaymentResource + proofUrl (/api/v1/files/{id}) + order ringkas. */
export interface AdminPayment extends Payment {
  proofUrl: string | null;
  order: AdminPaymentOrder | null;
}

/** Respons POST /admin/payments/{id}/accept|reject. */
export interface PaymentVerifyResult {
  payment: AdminPayment;
  order: AdminPaymentOrder;
}

// ---- Dashboard (GET /admin/dashboard?year) ----
export interface DashboardStats {
  ordersToday: number;
  ordersThisMonth: number;
  awaitingVerification: number;
  revenueThisMonth: number;
  pendingCustomers: number;
  activeCustomers: number;
}

export interface SalesChartPoint {
  ym: string;
  month: string;
  monthIndex: number;
  year: number;
  total: number;
  orders: number;
}

/** KPI value for the current period vs the same elapsed span last month; changePct null when previous = 0. */
export interface DashboardMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

/** Work queue counters; null = the admin lacks that module (same rule as GET /admin/badges). */
export interface DashboardWorkQueue {
  paymentsToVerify: number | null;
  ordersToProcess: number | null;
  ordersToShip: number | null;
  ordersInTransit: number | null;
  ordersDelivered: number | null;
  paymentsOverdue: number | null;
  customersToApprove: number | null;
  unreadChats: number | null;
}

export interface DashboardTopProduct {
  productId: number;
  productSlug: string | null;
  code: string | null;
  name: I18n;
  image: string | null;
  unit: string | null;
  qty: number;
  orders: number;
  revenue: number;
}

export interface DashboardLowStockItem {
  id: number;
  slug: string;
  code: string | null;
  name: I18n;
  image: string | null;
  unit: string | null;
  moq: number;
  stock: number;
  reserved: number;
  available: number;
  threshold: number;
  stockStatus: 'in_stock' | 'made_to_order' | 'out_of_stock';
  isPublished: boolean;
}

export interface DashboardData {
  stats: DashboardStats;
  recentOrders: OrderSummary[];
  needsAction: OrderSummary[];
  salesChart: SalesChartPoint[];
  year: number;
  // Dashboard v2 (additive keys).
  period: { from: string; to: string; previousFrom: string; previousTo: string };
  kpis: {
    revenue: DashboardMetric;
    paidOrders: DashboardMetric;
    avgOrderValue: DashboardMetric;
    newCustomers: DashboardMetric;
  };
  workQueue: DashboardWorkQueue;
  topProducts: DashboardTopProduct[];
  lowStock: { total: number; rule: { min: number; moqFactor: number }; items: DashboardLowStockItem[] };
  paymentDue: { overdue: number; dueSoon: number; windowHours: number; items: OrderSummary[] };
}

// ---- Laporan penjualan (GET /admin/reports/sales) ----
export interface SalesReportSummary {
  orders: number;
  revenue: number;
  avgOrder: number;
  items: number;
  subtotal: number;
  discount: number;
  shipping: number;
  fees: number;
  tax: number;
}

export interface SalesReportProduct {
  productId: number;
  productSlug: string | null;
  code: string | null;
  name: I18n;
  qty: number;
  orders: number;
  revenue: number;
}

export interface SalesReport {
  period: { from: string; to: string; year: number; month: number | null };
  summary: SalesReportSummary;
  byMonth: SalesChartPoint[];
  byProduct: SalesReportProduct[];
  orders: OrderSummary[];
}

// ---- Produk admin (AdminProductResource) ----
export interface AdminProductImage {
  id: number;
  url: string | null;
  sort: number;
  /** Media produk bisa foto atau video (ASUMSI A-72). */
  type?: 'image' | 'video';
  mime?: string | null;
  isThumbnail?: boolean;
  mediaId: number;
  media: MediaSummary | null;
}

export interface AdminProduct extends Omit<Product, 'images' | 'category'> {
  categoryId: number;
  category: { id: number; slug: string; name: I18n } | null;
  /** Nilai mentah (bukan hanya saat promo aktif). */
  promoPrice: number | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  promoActive: boolean;
  reserved: number;
  isPublished: boolean;
  images: AdminProductImage[];
  /** Foto yang menjadi thumbnail (pilihan admin, atau foto pertama); null bila belum ada foto. */
  thumbnailMediaId?: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt: string | null;
}

/** Body POST/PUT /admin/products (ProductRequest). */
export interface ProductPayload {
  code: string;
  slug?: string | null;
  categoryId: number;
  name: I18n;
  summary: I18n;
  kind: string | null;
  aliases: string[];
  highlights: { id: string[]; en: string[] };
  applications: { id: string[]; en: string[] };
  specs: string[][];
  solubility: string[][];
  priceMode: 'fixed' | 'quote';
  price: number | null;
  promoPrice: number | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  unit: string;
  moq: number;
  weightGram: number;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  stockStatus: StockStatus | null;
  isTaxable: boolean;
  isPublished: boolean;
  /** Id media foto/video berurutan. */
  images: number[];
  /** Foto di dalam `images` yang menjadi thumbnail; null = foto pertama. */
  thumbnailMediaId: number | null;
}

export type StockMovementType = 'in' | 'adjust' | 'reserve' | 'release' | 'commit';

export interface StockMovement {
  id: number;
  productId: number;
  type: StockMovementType;
  qty: number;
  referenceType: string | null;
  referenceId: number | null;
  idempotencyKey: string | null;
  note: string | null;
  createdBy: { id: number; name: string } | null;
  createdAt: string | null;
}

/** GET /admin/products/{id}/stock → data (ringkasan + movements[]) + meta paginasi. */
export interface StockSummary {
  product: { id: number; slug: string; code: string; name: I18n };
  stock: number;
  reserved: number;
  available: number;
  stockStatus: StockStatus;
  movements: StockMovement[];
}

// ---- Customer admin (AdminCustomerListResource / AdminCustomerResource) ----
export interface AdminCustomerRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  status: AccountStatus;
  joinedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  addressesCount: number;
}

export interface AdminCustomerOrder {
  number: string;
  invoiceNumber: string | null;
  date: string;
  status: OrderStatusKey;
  paymentStatus: PaymentStatusKey;
  itemsCount: number;
  grandTotal: number;
  paidAt: string | null;
}

export interface AdminCustomerDetail extends AdminCustomerRow {
  locale: string;
  position: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  taxId: string | null;
  approvedBy: { id: number; name: string } | null;
  addresses: CustomerAddress[];
  orders: AdminCustomerOrder[];
  ordersCount: number;
}

// ---- Konfigurasi commerce ----
export interface BankAccountRow extends BankAccountInfo {
  isActive: boolean;
  sortOrder: number;
}

export type FeeType = 'admin' | 'other';

/** Sasaran voucher/biaya tambahan: semua customer atau hanya yang dipilih (ASUMSI A-67). */
export type Audience = 'all' | 'customers';

/** Baris GET /admin/customer-options dan isi `customers[]` pada voucher/biaya. */
export interface CustomerOption {
  id: number;
  name: string;
  company: string | null;
  email: string;
}

export interface FeeRow {
  id: number;
  name: I18n;
  type: FeeType;
  amount: number;
  isActive: boolean;
  sortOrder: number;
  audience: Audience;
  customers: CustomerOption[];
}

export interface CommerceSettingsData {
  paymentDueHours: number;
  uniqueCodeEnabled: boolean;
  taxRate: number;
  priceIncludesTax: boolean;
  autoCompleteDays: number;
  reminderHoursBeforeDue: number;
  /** Nomor invoice: {invoicePrefix}/{urut per bulan}/{bulan Romawi}/{tahun}. */
  invoicePrefix: string;
  invoiceSignerName: string;
  invoiceSignerTitle: string;
  invoiceCc: string;
}

/** flat = tarif tetap; calculated = dasar + jarak (km) + berat (kg) + volume (m³), ASUMSI A-76. */
export type ShippingRateType = 'flat' | 'calculated';

export interface ShippingOrigin {
  label: string;
  lat: number | null;
  lng: number | null;
  roadFactor: number;
}

/** Rincian ongkir yang sama dengan ShippingRate::breakdown() di server (untuk pratinjau form tarif). */
export function previewShippingAmount(
  rate: { type: ShippingRateType; baseAmount: number; perKmAmount: number; perKgAmount: number; perM3Amount: number; minAmount: number },
  input: { km: number; kg: number; m3: number },
): { base: number; distance: number; weight: number; volume: number; total: number; minimumApplied: boolean } {
  const base = rate.baseAmount;
  const calc = rate.type === 'calculated';
  const distance = calc ? rate.perKmAmount * Math.max(0, Math.ceil(input.km)) : 0;
  const weight = calc ? rate.perKgAmount * Math.max(0, Math.ceil(input.kg)) : 0;
  const volume = calc ? Math.round(rate.perM3Amount * (Math.ceil(Math.max(0, input.m3) * 100 - 1e-9) / 100)) : 0;
  const sum = base + distance + weight + volume;
  return { base, distance, weight, volume, total: Math.max(rate.minAmount, sum), minimumApplied: rate.minAmount > sum };
}

export interface ShippingRateRow {
  id: number;
  zoneId: number;
  name: I18n;
  type: ShippingRateType;
  baseAmount: number;
  perKmAmount: number;
  perKgAmount: number;
  perM3Amount: number;
  minAmount: number;
  freeAbove: number | null;
  eta: I18n | null;
  isActive: boolean;
  sortOrder: number;
}

export interface ZoneRegionRef {
  code: string;
  level: RegionLevel;
}

export interface ShippingZoneRow {
  id: number;
  name: I18n;
  isActive: boolean;
  isDefault: boolean;
  priority: number;
  regions: ZoneRegionRef[];
  rates: ShippingRateRow[];
}

export type VoucherType = 'percent' | 'fixed';
export type VoucherScope = 'all' | 'category';

export interface VoucherRow {
  id: number;
  code: string;
  type: VoucherType;
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  quota: number | null;
  usedCount: number;
  perUserLimit: number | null;
  scope: VoucherScope;
  categoryIds: number[];
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  audience: Audience;
  customers: CustomerOption[];
}

export type PaymentDriver = 'manual' | 'xendit';

/** Hanya kunci non-rahasia (PaymentMethod::CONFIG_KEYS); kredensial gateway ada di .env server. */
export interface PaymentMethodConfig {
  qrisMediaId?: number | null;
  channelCode?: string | null;
  bankCode?: string | null;
  feePercent?: number | null;
  feeFixed?: number | null;
}

export interface PaymentMethodRow {
  id: number;
  code: string;
  type: PaymentMethodType;
  driver: PaymentDriver;
  name: I18n;
  instructions: I18n | null;
  /** PHP mengirim `[]` bila kosong. */
  config: PaymentMethodConfig | unknown[];
  qrisImageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

// ---- Audit log (GET /admin/audit-logs) ----
export interface AuditLogRow {
  id: number;
  action: string;
  subjectType: string | null;
  subjectId: number | null;
  user: { id: number; name: string; email: string; role: string } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string | null;
}

// ============================ LABEL UI ============================

export const paymentMethodTypeLabels: Record<PaymentMethodType, { id: string; en: string }> = {
  manual_transfer: { id: 'Transfer bank manual', en: 'Manual bank transfer' },
  qris_static: { id: 'QRIS statis', en: 'Static QRIS' },
  qris_dynamic: { id: 'QRIS dinamis (gateway)', en: 'Dynamic QRIS (gateway)' },
  virtual_account: { id: 'Virtual account (gateway)', en: 'Virtual account (gateway)' },
  ewallet: { id: 'E-wallet (gateway)', en: 'E-wallet (gateway)' },
};

export const stockMovementLabels: Record<StockMovementType, StatusLabel> = {
  in: { id: 'Stok masuk', en: 'Stock in', tone: 'ok' },
  adjust: { id: 'Penyesuaian', en: 'Adjustment', tone: 'info' },
  reserve: { id: 'Dipesan (reservasi)', en: 'Reserved', tone: 'warn' },
  release: { id: 'Reservasi dilepas', en: 'Released', tone: 'info' },
  commit: { id: 'Terjual (keluar)', en: 'Committed (out)', tone: 'bad' },
};

export const feeTypeLabels: Record<FeeType, { id: string; en: string }> = {
  admin: { id: 'Biaya admin', en: 'Admin fee' },
  other: { id: 'Biaya lain', en: 'Other fee' },
};

export const shippingRateTypeLabels: Record<ShippingRateType, { id: string; en: string }> = {
  flat: { id: 'Tarif tetap', en: 'Flat rate' },
  calculated: { id: 'Dihitung (jarak, berat, volume)', en: 'Calculated (distance, weight, volume)' },
};

export const voucherTypeLabels: Record<VoucherType, { id: string; en: string }> = {
  percent: { id: 'Persentase (%)', en: 'Percentage (%)' },
  fixed: { id: 'Nominal tetap (Rp)', en: 'Fixed amount (Rp)' },
};

export const audienceLabels: Record<Audience, { id: string; en: string }> = {
  all: { id: 'Semua customer', en: 'All customers' },
  customers: { id: 'Customer tertentu', en: 'Selected customers' },
};

/** Ringkasan sasaran untuk sel tabel: "Semua customer" atau "PT A, PT B +2". */
export function audienceSummary(row: { audience: Audience; customers: CustomerOption[] }, lang: 'id' | 'en'): string {
  if (row.audience !== 'customers') return audienceLabels.all[lang];
  const names = row.customers.map((c) => c.company || c.name);
  if (names.length === 0) return lang === 'en' ? 'No customer selected' : 'Belum ada customer';
  const shown = names.slice(0, 2).join(', ');
  return names.length > 2 ? `${shown} +${names.length - 2}` : shown;
}

export const voucherScopeLabels: Record<VoucherScope, { id: string; en: string }> = {
  all: { id: 'Semua produk', en: 'All products' },
  category: { id: 'Kategori tertentu', en: 'Selected categories' },
};

export const regionLevelLabels: Record<RegionLevel, { id: string; en: string }> = {
  province: { id: 'Provinsi', en: 'Province' },
  regency: { id: 'Kabupaten/Kota', en: 'Regency/City' },
  district: { id: 'Kecamatan', en: 'District' },
  village: { id: 'Desa/Kelurahan', en: 'Village' },
};

/** Status order yang masih boleh dibatalkan admin (server tetap memvalidasi lewat state machine). */
export const adminCancellableStatuses: OrderStatusKey[] = ['pending_payment', 'payment_review', 'paid', 'processing'];

/** Status order yang batas waktunya masih bisa diperpanjang. */
export const dueEditableStatuses: OrderStatusKey[] = ['pending_payment', 'payment_review'];

// ============================ HELPER ============================

/** Bangun query string dari objek; nilai kosong/null/undefined dilewati. */
export function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}

/** Tanggal `YYYY-MM-DD` menurut zona browser (nilai input `date`). */
export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Rentang bawaan filter daftar admin: awal bulan berjalan sampai hari ini. */
/** Meta daftar admin + `counts` per status sepanjang waktu (angka tab), dari GET /admin/{orders,payments,customers}. */
export type CountsMeta = PagedMeta & { counts?: Record<string, number> };

export function defaultDateRange(now: Date = new Date()): { from: string; to: string } {
  return { from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoDate(now) };
}

/** Event jendela untuk meminta sidebar admin menghitung ulang badge (mis. setelah verifikasi pembayaran). */
export const ADMIN_BADGES_EVENT = 'ikn:admin-badges';

export function refreshAdminBadges(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ADMIN_BADGES_EVENT));
}

/** ISO-8601 (+07:00) → nilai input `datetime-local` (zona browser). */
export function toDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Nilai `datetime-local` → ISO-8601 UTC (server mengonversi ke zona aplikasi). Kosong → null. */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** `config` metode bayar: PHP mengirim `[]` bila kosong. */
export function paymentMethodConfig(method: Pick<PaymentMethodRow, 'config'>): PaymentMethodConfig {
  return Array.isArray(method.config) ? {} : method.config;
}

/** Teks multiline → daftar baris non-kosong (highlights/applications per bahasa). */
export function linesToList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Daftar → teks multiline untuk textarea. */
export function listToLines(items: string[] | null | undefined): string {
  return (items ?? []).join('\n');
}

/** Angka dari input teks; kosong/tidak valid → null. */
export function numberOrNull(value: string): number | null {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Nama ringkas metode bayar untuk tabel: nama metode + bank/QRIS. */
export function paymentMethodSummary(payment: Payment, lang: 'id' | 'en'): string {
  const name = payment.methodName ? payment.methodName[lang] || payment.methodName.id : payment.method;
  if (payment.bankAccount) return `${name} · ${payment.bankAccount.bankName}`;
  if (payment.type === 'qris_static' || payment.type === 'qris_dynamic') return `${name} · QRIS`;
  if (payment.gateway?.bankCode) return `${name} · ${String(payment.gateway.bankCode)}`;
  return name;
}

// ---- Live chat (ASUMSI A-73) ----
/** Baris kotak masuk chat admin: GET /admin/chats. */
export interface AdminChatConversation {
  id: number;
  /** guest = pengunjung belum login (identitas dari formulir), customer = akun. */
  kind: 'customer' | 'guest';
  customer: { id: number; name: string; company: string | null; email: string; status: string } | null;
  guest: { name: string; email: string; phone: string | null } | null;
  /** Pesan customer yang belum dibaca admin. */
  unread: number;
  lastMessagePreview: string | null;
  lastSenderRole: 'customer' | 'admin' | null;
  lastMessageAt: string | null;
  createdAt: string | null;
}
