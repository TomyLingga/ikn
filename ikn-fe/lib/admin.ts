// ============================ TIPE & HELPER PANEL ADMIN COMMERCE ============================
// Bentuk data endpoint /admin/* commerce (order, payment, katalog, customer, konfigurasi, laporan,
// audit) sesuai Resource di ikn-api. Tipe customer/publik ada di lib/types.ts (milik FE-A) dan
// tidak diduplikasi di sini; file ini hanya menambah superset admin + label UI + helper kecil.

import type { I18n, MediaSummary, PagedMeta } from '@/lib/cms';
import type {
  AccountStatus,
  BankAccountInfo,
  Currency,
  CustomerAddress,
  CustomerMarket,
  DeliveryTerm,
  DeliveryTermFamily,
  DeliveryTermMarket,
  DeliveryTermPricingMode,
  DeliveryTermTaxProfile,
  OrderStatusKey,
  OrderSummary,
  Payment,
  PaymentMethodType,
  PaymentStatusKey,
  FactoryLocation,
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
  currency: Currency;
  grandTotal: number;
  uniqueCode: number;
  paymentDueAt: string | null;
  paidAt: string | null;
  date: string;
}

/** Body opsional POST /admin/payments/{id}/accept (satuan terkecil mata uang payment; informasi saja, ASUMSI A-86). */
export interface AcceptPaymentPayload {
  receivedAmount?: number | null;
  bankCharges?: number | null;
  receivedNote?: string | null;
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
  /** Order CIF yang menunggu penawaran ongkir dari admin (ASUMSI A-89); undefined pada server lama. */
  freightToQuote?: number | null;
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

/**
 * Blok ekspor dashboard (Phase E6, kontrak 11.1): ringkasan order USD terpisah dari KPI IDR. `revenue` dalam sen
 * (order dibayar pada `period.from..to`), `orders` = order USD dibuat pada periode itu apa pun statusnya,
 * `awaitingFreight`/`pendingPayment` = jumlah saat ini. Null bila belum pernah ada order USD.
 */
export interface DashboardExportKpis {
  currency: Currency;
  revenue: number;
  paidOrders: number;
  orders: number;
  awaitingFreight: number;
  pendingPayment: number;
}

export interface DashboardData {
  /** Semua angka uang `stats`/`kpis`/`salesChart`/`topProducts` hanya order IDR (ASUMSI A-86); USD ada di `exportKpis`. */
  currency?: Currency;
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
  exportKpis: DashboardExportKpis | null;
  // Dashboard v3 (2026-11-04, additive).
  today?: { revenue: number; paidOrders: number; ordersCreated: number; yesterdayRevenue: number; yesterdayPaidOrders: number; yesterdayOrdersCreated: number };
  trend30?: TrendPoint[];
  statusBreakdown?: { status: string; count: number }[];
  topCustomers?: SalesTopCustomer[];
  byCategory?: SalesByCategory[];
}

/** Satu titik deret waktu pendapatan (tanggal awal bucket hari/minggu/bulan). */
export interface TrendPoint {
  date: string;
  total: number;
  orders: number;
}

export interface SalesByCategory {
  categoryId: number | null;
  name: I18n;
  qty: number;
  orders: number;
  revenue: number;
}

export interface SalesTopCustomer {
  userId: number | null;
  name: string;
  company: string;
  orders: number;
  revenue: number;
  lastPaidAt: string | null;
}

export interface SalesFunnel {
  created: number;
  paid: number;
  open: number;
  cancelled: number;
  expired: number;
  paidValue: number;
  openValue: number;
  lostValue: number;
  conversionPct: number | null;
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

/**
 * Total per mata uang (Phase E6): filter paid_at/status sama dengan `summary`, hanya mata uang yang punya order
 * dibayar dalam rentang (IDR dulu, lalu USD). `revenue`/`averageOrder` dalam satuan terkecil mata uang baris;
 * `paidOrders` = `orders`.
 */
export interface SalesByCurrency {
  currency: Currency;
  orders: number;
  revenue: number;
  paidOrders: number;
  averageOrder: number;
}

export interface SalesReport {
  /** `summary`/`byMonth`/`byProduct` hanya order IDR (ASUMSI A-86); `byCurrency` dan `orders` memuat semua mata uang. */
  currency?: Currency;
  period: { from: string; to: string; year: number; month: number | null };
  summary: SalesReportSummary;
  /** Kosong bila tidak ada order dibayar pada rentang. */
  byCurrency: SalesByCurrency[];
  byMonth: SalesChartPoint[];
  byProduct: SalesReportProduct[];
  /** Order dibayar semua mata uang (maks 1000); tiap baris membawa `currency`. */
  orders: OrderSummary[];
  // Rincian 2026-11-04 (additive, IDR).
  comparison?: { from: string; to: string; orders: number; revenue: number; avgOrder: number; items: number; changePct: { orders: number | null; revenue: number | null; avgOrder: number | null; items: number | null } };
  trend?: { granularity: 'day' | 'week' | 'month'; points: TrendPoint[] };
  byCategory?: SalesByCategory[];
  topCustomers?: SalesTopCustomer[];
  /** `region` = provinsi; `__pickup` = ambil di pabrik, `__none` = tanpa alamat. */
  byRegion?: { region: string; orders: number; revenue: number }[];
  byPaymentMethod?: { method: string; orders: number; revenue: number }[];
  byDeliveryTerm?: { term: string; orders: number; revenue: number }[];
  funnel?: SalesFunnel;
}

// ---- Kurs JISDOR (GET/POST /admin/exchange-rates, kontrak 11.7, ASUMSI A-84) ----
export type ExchangeRateSource = 'jisdor' | 'manual';

/** Satu kurs harian: rupiah bulat per 1 USD. */
export interface ExchangeRatePoint {
  date: string;
  rate: number;
  source: ExchangeRateSource;
}

export interface ExchangeRateSummary {
  latest: (ExchangeRatePoint & { fetchedAt: string | null }) | null;
  average: number | null;
  max: number | null;
  min: number | null;
  series: ExchangeRatePoint[];
  fetchedAt: string | null;
  /** Hari kerja (Senin-Jumat) sejak kurs terakhir; `stale` = lebih dari 3. */
  staleDays: number;
  stale: boolean;
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
  /** Bingkai gambar ini di kartu/galeri produk (A-93). */
  frame?: import('@/lib/cms').MediaFrame | null;
  mediaId: number;
  media: MediaSummary | null;
}

export interface AdminProduct extends Omit<Product, 'images' | 'category'> {
  categoryId: number;
  category: { id: number; slug: string; name: I18n } | null;
  /** Admin selalu melihat harga rupiah (currency IDR) + harga USD mentah. */
  currency: 'IDR';
  price: number | null;
  /** Nilai mentah (bukan hanya saat promo aktif). */
  promoPrice: number | null;
  promoStartsAt: string | null;
  promoEndsAt: string | null;
  promoActive: boolean;
  effectivePrice: number | null;
  /** Harga USD per satuan dalam sen (1250 = USD 12,50), basis FOB Belawan; null = belum dijual ke pasar ekspor. */
  priceUsd: number | null;
  /** true bila harga USD terisi dan mode harga tetap. */
  priceUsdSet: boolean;
  reserved: number;
  isPublished: boolean;
  images: AdminProductImage[];
  /** Foto yang menjadi thumbnail (pilihan admin, atau foto pertama); null bila belum ada foto. */
  thumbnailMediaId?: number | null;
  /** Pabrik asal tersimpan (null = pabrik bawaan) dan pabrik efektif (ASUMSI A-90). */
  factoryLocationId?: number | null;
  factoryLocation?: { id: number; code: string; name: I18n } | null;
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
  /** Harga USD dalam sen; null = hapus harga USD (produk tidak bisa dipesan customer ekspor). */
  priceUsd: number | null;
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
  /** Bingkai per id media (A-93); dikirim = semua bingkai diganti, id tanpa entri = bawaan. */
  imageFrames?: Record<string, import('@/lib/cms').MediaFrame>;
  /** Pabrik asal; null = pabrik bawaan (urutan pertama di Lokasi pabrik). Tidak dikirim = tetap. */
  factoryLocationId?: number | null;
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
  /** Pasar (local/export) dikunci admin saat approve; negara dari pendaftaran (ASUMSI A-86). */
  market: CustomerMarket;
  countryCode: string;
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
  currency: Currency;
  grandTotal: number;
  paidAt: string | null;
  /** Cara serah terima ringkas (A-85) untuk label status varian Loco/pelabuhan; null untuk order lama. */
  deliveryTerm?: { code: string; family: string | null } | null;
}

export interface AdminCustomerDetail extends AdminCustomerRow {
  locale: string;
  position: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  taxId: string | null;
  currency: Currency;
  companyAddress: string | null;
  /** Order yang belum berstatus akhir; pasar hanya bisa diubah bila 0 (409 CUSTOMER_HAS_OPEN_ORDERS). */
  openOrdersCount: number;
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
  /** Satuan terkecil `currency`; biaya hanya masuk ke order se-mata-uang (ASUMSI A-86). */
  currency: Currency;
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
  /** Ekspor (ASUMSI A-86): tarif PPN untuk term berprofil pajak ekspor (bawaan 0) dan batas bayar order USD (jam). */
  exportTaxRate: number;
  exportPaymentDueHours: number;
  /** Penawaran ongkir CIF (ASUMSI A-89): masa berlaku bawaan penawaran admin (hari, 1..90) dan batas tunggu order tanpa penawaran berlaku (hari, 1..365). */
  freightQuoteValidDays?: number;
  freightQuoteMaxDays?: number;
  /** Nomor invoice: {invoicePrefix}/{urut per bulan}/{bulan Romawi}/{tahun}. */
  invoicePrefix: string;
  invoiceSignerName: string;
  invoiceSignerTitle: string;
  invoiceCc: string;
}

/** flat = tarif tetap; calculated = dasar + jarak (km) + berat (kg) + volume (m³), ASUMSI A-76. */
export type ShippingRateType = 'flat' | 'calculated';

// ---- Lokasi pabrik (GET/POST /admin/factory-locations, PUT/DELETE /admin/factory-locations/{id}; kontrak 11.8, ASUMSI A-90) ----
export interface AdminFactoryLocation extends FactoryLocation {
  id: number;
  sortOrder: number;
  /** Urutan pertama = pabrik untuk produk tanpa pabrik asal. */
  isDefault: boolean;
  /** Produk yang menunjuk pabrik ini; hapus ditolak 409 FACTORY_LOCATION_IN_USE bila > 0 atau tinggal satu baris. */
  productsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Body FactoryLocationRequest: PUT = penggantian penuh (lat/lng selalu dikirim); `code` hanya saat membuat. */
export interface FactoryLocationPayload {
  code?: string;
  name: I18n;
  address: string;
  lat: number | null;
  lng: number | null;
  allowsPickup: boolean;
  sortOrder?: number | null;
}

/** GET/PUT /admin/shipping/road-factor: jarak jalan = jarak garis lurus × faktor (1..3). */
export interface RoadFactorData {
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

// ---- Cara serah terima (GET/POST /admin/delivery-terms, PUT/DELETE /admin/delivery-terms/{id}; kontrak 11.8, ASUMSI A-85) ----
export interface AdminDeliveryTerm extends DeliveryTerm {
  id: number;
  isActive: boolean;
  sortOrder: number;
  /** Jumlah order yang memakai term ini; hapus ditolak 409 bila > 0. */
  ordersCount?: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Body DeliveryTermRequest: `code` hanya saat membuat (tidak bisa diubah). */
export interface DeliveryTermPayload {
  code?: string;
  name: I18n;
  description: I18n;
  family: DeliveryTermFamily;
  market: DeliveryTermMarket;
  pricingMode: DeliveryTermPricingMode;
  taxProfile: DeliveryTermTaxProfile;
  insuranceIncluded: boolean;
  loadingPort: string | null;
  requiresDestinationPort: boolean;
  isActive: boolean;
  sortOrder: number;
}

// ---- Syarat pembayaran (GET/POST /admin/payment-terms, PUT/DELETE /admin/payment-terms/{id}; kontrak 11.10, ASUMSI A-87) ----
export interface PaymentTermRow {
  id: number;
  code: string;
  name: I18n;
  description: I18n | null;
  market: DeliveryTermMarket;
  isActive: boolean;
  sortOrder: number;
  /** Jumlah order yang membekukan syarat ini; hapus ditolak 409 PAYMENT_TERM_IN_USE bila > 0. */
  ordersCount?: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Body PaymentTermRequest: `code` hanya saat membuat (tidak bisa diubah). */
export interface PaymentTermPayload {
  code?: string;
  name: I18n;
  description: I18n;
  market: DeliveryTermMarket;
  isActive: boolean;
  sortOrder: number;
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

/** Label cara serah terima untuk laporan (kode delivery_terms bawaan; kode lain tampil apa adanya). */
export const deliveryTermReportLabels: Record<string, { id: string; en: string }> = {
  loco: { id: 'Loco (ambil di pabrik)', en: 'Loco (plant pickup)' },
  franco: { id: 'Franco (dikirim)', en: 'Franco (delivered)' },
  fob: { id: 'FOB Belawan', en: 'FOB Belawan' },
  cif: { id: 'CIF (pelabuhan tujuan)', en: 'CIF (destination port)' },
};

export const stockMovementLabels: Record<StockMovementType, StatusLabel> = {
  in: { id: 'Stok masuk', en: 'Stock in', tone: 'ok' },
  adjust: { id: 'Penyesuaian', en: 'Adjustment', tone: 'info' },
  reserve: { id: 'Dipesan (reservasi)', en: 'Reserved', tone: 'warn' },
  release: { id: 'Reservasi dilepas', en: 'Released', tone: 'info' },
  commit: { id: 'Terjual (keluar)', en: 'Committed (out)', tone: 'bad' },
};

export const exchangeRateSourceLabels: Record<ExchangeRateSource, StatusLabel> = {
  jisdor: { id: 'JISDOR', en: 'JISDOR', tone: 'info' },
  manual: { id: 'Manual', en: 'Manual', tone: 'warn' },
};

export const feeTypeLabels: Record<FeeType, { id: string; en: string }> = {
  admin: { id: 'Biaya admin', en: 'Admin fee' },
  other: { id: 'Biaya lain', en: 'Other fee' },
};

export const shippingRateTypeLabels: Record<ShippingRateType, { id: string; en: string }> = {
  flat: { id: 'Tarif tetap', en: 'Flat rate' },
  calculated: { id: 'Dihitung (jarak, berat, volume)', en: 'Calculated (distance, weight, volume)' },
};

export const deliveryFamilyLabels: Record<DeliveryTermFamily, { id: string; en: string }> = {
  pickup: { id: 'Ambil di pabrik', en: 'Pickup at factory' },
  door: { id: 'Diantar ke alamat', en: 'Delivered to address' },
  port: { id: 'Serah di pelabuhan', en: 'Handed over at port' },
};

export const deliveryMarketLabels: Record<DeliveryTermMarket, { id: string; en: string }> = {
  local: { id: 'Lokal', en: 'Local' },
  export: { id: 'Ekspor', en: 'Export' },
};

/** Pasar customer memakai kata yang sama dengan pasar term. */
export const customerMarketLabels: Record<CustomerMarket, { id: string; en: string }> = deliveryMarketLabels;

export const currencyLabels: Record<Currency, { id: string; en: string }> = {
  IDR: { id: 'IDR (Rupiah)', en: 'IDR (Rupiah)' },
  USD: { id: 'USD (Dolar AS)', en: 'USD (US Dollar)' },
};

export const taxProfileLabels: Record<DeliveryTermTaxProfile, { id: string; en: string }> = {
  domestic: { id: 'Domestik (tarif PPN)', en: 'Domestic (VAT rate)' },
  export: { id: 'Ekspor (tarif PPN ekspor)', en: 'Export (export VAT rate)' },
};

/** Pasar bawaan untuk modal Setujui: Indonesia = lokal, negara lain = ekspor (admin tetap bisa mengubah). */
export function marketForCountry(countryCode: string | null | undefined): CustomerMarket {
  return (countryCode || 'ID').toUpperCase() === 'ID' ? 'local' : 'export';
}

export const deliveryPricingLabels: Record<DeliveryTermPricingMode, { id: string; en: string }> = {
  none: { id: 'Tanpa biaya', en: 'No charge' },
  zone: { id: 'Tarif zona', en: 'Zone rate' },
  included: { id: 'Termasuk harga', en: 'Included in price' },
  quoted: { id: 'Penawaran admin', en: 'Quoted by admin' },
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
export const adminCancellableStatuses: OrderStatusKey[] = ['awaiting_freight', 'pending_payment', 'payment_review', 'paid', 'processing'];

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
