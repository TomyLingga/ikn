// ============================ TIPE & HELPER PANEL ADMIN COMMERCE ============================
// Bentuk data endpoint /admin/* commerce (order, payment, katalog, customer, konfigurasi, laporan,
// audit) sesuai Resource di ikn-api. Tipe customer/publik ada di lib/types.ts (milik FE-A) dan
// tidak diduplikasi di sini; file ini hanya menambah superset admin + label UI + helper kecil.

import type { I18n, MediaSummary } from '@/lib/cms';
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

export interface DashboardData {
  stats: DashboardStats;
  recentOrders: OrderSummary[];
  needsAction: OrderSummary[];
  salesChart: SalesChartPoint[];
  year: number;
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
  stockStatus: StockStatus | null;
  isTaxable: boolean;
  isPublished: boolean;
  images: number[];
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

export interface FeeRow {
  id: number;
  name: I18n;
  type: FeeType;
  amount: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CommerceSettingsData {
  paymentDueHours: number;
  uniqueCodeEnabled: boolean;
  taxRate: number;
  priceIncludesTax: boolean;
  autoCompleteDays: number;
  reminderHoursBeforeDue: number;
}

export type ShippingRateType = 'flat' | 'per_kg';

export interface ShippingRateRow {
  id: number;
  zoneId: number;
  name: I18n;
  type: ShippingRateType;
  baseAmount: number;
  perKgAmount: number;
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
  per_kg: { id: 'Per kg', en: 'Per kg' },
};

export const voucherTypeLabels: Record<VoucherType, { id: string; en: string }> = {
  percent: { id: 'Persentase (%)', en: 'Percentage (%)' },
  fixed: { id: 'Nominal tetap (Rp)', en: 'Fixed amount (Rp)' },
};

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
