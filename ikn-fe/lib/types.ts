// ============================ TIPE BERSAMA ============================
// Bentuk data dari ikn-api (/api/v1) yang dipakai lintas file. Sumber kebenaran:
// plan/02-api-contract.md + ikn-api/docs/openapi.yaml. Tipe CMS ada di lib/cms.ts.
// Tipe khusus panel admin commerce (superset Resource admin) ada di lib/admin.ts.

import type { I18n, MediaSummary } from '@/lib/cms';

export type Lang = 'id' | 'en';

// Nada warna badge/status.
export type Tone = 'ok' | 'warn' | 'bad' | 'info';

// Nama ikon yang tersedia di komponen Icon.
export type IconName =
  | 'arrow'
  | 'arrowDown'
  | 'chevronLeft'
  | 'chevronRight'
  | 'play'
  | 'leaf'
  | 'flask'
  | 'handshake'
  | 'target'
  | 'compass'
  | 'gear'
  | 'pin'
  | 'phone'
  | 'mail'
  | 'bag'
  | 'image'
  | 'trash'
  | 'orders'
  | 'wallet'
  | 'shieldCheck'
  | 'package'
  | 'truck'
  | 'checkCircle'
  | 'cancelCircle'
  | 'trendUp'
  | 'users'
  | 'paymentCheck'
  | 'drop'
  | 'check'
  | 'plus'
  | 'close'
  | 'quote'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'panelLeft';

// Label bilingual + nada (dipakai orderStatus, paymentStatus, stockLabels).
export interface StatusLabel {
  id: string;
  en: string;
  tone: Tone;
}

/** Daftar string per bahasa (highlights, applications). */
export interface I18nList {
  id: string[];
  en: string[];
}

// ---- Auth & akun ----
// Pengunjung publik adalah viewer tanpa sesi, bukan role ketiga.
export type Role = 'super_admin' | 'admin' | 'customer';
export type AccountStatus = 'pending' | 'active' | 'rejected' | 'inactive';

export interface AuthUserProfile {
  company: string | null;
  position: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  taxId: string | null;
  phone: string | null;
}

/** UserResource dari /auth/login, /auth/admin/login, /auth/me. */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: Role;
  status: AccountStatus;
  locale: Lang;
  emailVerifiedAt: string | null;
  lastLoginAt?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  profile?: AuthUserProfile | null;
  // Hanya admin/super_admin.
  permissions?: string[];
  modules?: string[];
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  phone?: string;
  company?: string;
  position?: string;
  taxId?: string;
}

/** Respons POST /auth/register (tidak login otomatis). */
export interface RegisterResult {
  id: number;
  email: string;
  status: AccountStatus;
  emailVerifiedAt: string | null;
}

// ---- Wilayah & geo ----
export type RegionLevel = 'province' | 'regency' | 'district' | 'village';

export interface Region {
  code: string;
  parentCode: string | null;
  level: RegionLevel;
  name: string;
  // Hanya dari /regions/search.
  path?: string[];
  fullName?: string;
}

export interface GeoResult {
  displayName: string;
  lat: number;
  lng: number;
  address: {
    road: string | null;
    village: string | null;
    district: string | null;
    city: string | null;
    state: string | null;
    postcode: string | null;
  };
}

// ---- Alamat customer (BE-1) ----
export interface RegionNames {
  province: string | null;
  regency: string | null;
  district: string | null;
  village: string | null;
}

/** Bentuk beku alamat (snapshot di order). */
export interface AddressSnapshot {
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  provinceCode: string;
  regencyCode: string;
  districtCode: string;
  villageCode: string;
  region: RegionNames;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
}

export interface CustomerAddress extends AddressSnapshot {
  id: number;
  isDefault: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CustomerAddressInput {
  label: string;
  recipientName: string;
  phone: string;
  addressLine: string;
  provinceCode: string;
  regencyCode: string;
  districtCode: string;
  villageCode: string;
  postalCode: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  isDefault?: boolean;
}

export interface CustomerProfile {
  id: number;
  name: string;
  email: string;
  status: AccountStatus;
  locale: Lang;
  emailVerifiedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  taxId: string | null;
  addresses: CustomerAddress[];
  createdAt: string | null;
}

// ---- Katalog ----
export type PriceMode = 'fixed' | 'quote';
export type StockStatus = 'in_stock' | 'made_to_order' | 'out_of_stock';

export interface Category {
  id: number;
  slug: string;
  name: I18n;
  description: I18n;
  image: MediaSummary | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface ProductImage {
  id: number;
  url: string;
  sort: number;
}

export interface ProductCategoryRef {
  slug: string;
  name: I18n;
}

export interface Product {
  id: number;
  slug: string;
  code: string;
  name: I18n;
  category: ProductCategoryRef | null;
  kind: string | null;
  priceMode: PriceMode;
  price: number | null;
  /** Hanya terisi bila promo sedang aktif. */
  promoPrice: number | null;
  promoEndsAt: string | null;
  /** promoPrice bila aktif, selain itu price. */
  effectivePrice: number | null;
  unit: string;
  moq: number;
  weightGram: number;
  stock: number;
  /** stock − reserved. */
  available: number;
  stockStatus: StockStatus;
  isTaxable: boolean;
  images: ProductImage[];
  image: string | null;
  summary: I18n;
  highlights: I18nList;
  specs: string[][];
  applications: I18nList;
  solubility: string[][];
  aliases: string[];
  ratingAvg: number;
  reviewCount: number;
}

export interface ProductReview {
  id: number;
  productId: number;
  productSlug?: string;
  productName?: I18n;
  userId: number;
  customer: string | null;
  orderId: number | null;
  rating: number;
  body: string | null;
  isPublished: boolean;
  date: string;
  createdAt: string;
}

export interface ProductDetail extends Product {
  reviews: ProductReview[];
  related: Product[];
}

export interface ProductQuery {
  q?: string;
  category?: string;
  sort?: 'name' | 'price' | 'newest' | '';
  page?: number;
  perPage?: number;
}

// ---- Keranjang (localStorage, ASUMSI A-11) ----
export interface CartItem {
  productId: number;
  slug: string;
  code: string;
  name: I18n;
  unit: string;
  image: string | null;
  qty: number;
  moq: number;
  /** Harga efektif saat ditambahkan; harga final selalu dari POST /cart/quote. */
  unitPrice: number | null;
}

// ---- Quote (POST /cart/quote, bentuk BE-2) ----
export interface QuoteItem {
  productId: number;
  productSlug: string;
  code: string;
  name: I18n;
  unit: string;
  image: string | null;
  categoryId: number;
  qty: number;
  moq: number;
  unitPrice: number;
  basePrice: number;
  promoApplied: boolean;
  lineTotal: number;
  discountAmount: number;
  taxAmount: number;
  isTaxable: boolean;
  weightGram: number;
  available: number;
}

export interface ShippingRateQuote {
  rateId: number;
  zoneId: number;
  label: I18n;
  eta: I18n | null;
  amount: number;
  type: 'flat' | 'per_kg';
  weightGram?: number;
}

export interface QuoteVoucher {
  id: number;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
}

export interface QuoteFee {
  id: number;
  name: I18n;
  type: string;
  amount: number;
}

export type QuoteWarning = 'no_shipping_rate' | 'shipping_rate_ignored_without_address';

export interface QuoteResult {
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  voucher: QuoteVoucher | null;
  shipping: ShippingRateQuote | null;
  availableShippingRates: ShippingRateQuote[];
  shippingTotal: number;
  fees: QuoteFee[];
  feeTotal: number;
  taxRate: number;
  priceIncludesTax: boolean;
  taxTotal: number;
  paymentMethodCode: string | null;
  uniqueCodeRequired: boolean;
  /** Sementara 1–999 (0 bila tidak berlaku); final ditetapkan saat checkout. */
  uniqueCode: number;
  grandTotal: number;
  weightGram: number;
  warnings: QuoteWarning[];
}

export interface QuoteRequest {
  items: { productSlug: string; qty: number }[];
  addressId?: number | null;
  shippingRateId?: number | null;
  paymentMethodCode?: string | null;
  bankAccountId?: number | null;
  voucherCode?: string | null;
  note?: string | null;
}

// ---- Konfigurasi commerce (GET /commerce/config) ----
export type PaymentMethodType = 'manual_transfer' | 'qris_static' | 'qris_dynamic' | 'virtual_account' | 'ewallet';

export interface PaymentMethodInfo {
  id: number;
  code: string;
  type: PaymentMethodType;
  driver: 'manual' | 'xendit';
  name: I18n;
  instructions: I18n;
  /** Hanya qris_static. */
  qrisImageUrl: string | null;
  sortOrder: number;
}

export interface BankAccountInfo {
  id: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  isActive?: boolean;
}

export interface CommerceConfig {
  paymentMethods: PaymentMethodInfo[];
  bankAccounts: BankAccountInfo[];
  fees: QuoteFee[];
  paymentDueHours: number;
  taxRate: number;
  priceIncludesTax: boolean;
  uniqueCodeEnabled: boolean;
  autoCompleteDays: number;
}

// ---- Order & pembayaran (kontrak bagian 9–10, BE-3) ----
export type OrderStatusKey =
  | 'pending_payment'
  | 'payment_review'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type PaymentStatusKey =
  | 'pending'
  | 'awaiting_verification'
  | 'paid'
  | 'rejected'
  | 'expired'
  | 'failed'
  | 'cancelled';

export interface OrderItem {
  id?: number;
  productId?: number;
  productSlug: string;
  name: I18n;
  code: string;
  qty: number;
  unit: string;
  unitPrice: number;
  discountAmount: number;
  taxAmount?: number;
  lineTotal: number;
  image?: string | null;
  categoryId?: number | null;
  weightGram?: number;
  /** true/false bila order memuat relasi ulasan (detail); null pada ringkasan. */
  reviewed?: boolean | null;
}

export interface PaymentProofInfo {
  mediaId: number;
  url?: string | null;
  originalName: string;
  mime: string;
  size: number;
  uploadedAt: string;
}

export interface Payment {
  id: number;
  orderId?: number;
  method: string;
  type?: PaymentMethodType | null;
  methodName?: I18n | null;
  provider?: string | null;
  externalId?: string | null;
  uniqueCode?: number;
  gateway?: Record<string, unknown> | null;
  verifiedBy?: { id: number; name: string } | null;
  status: PaymentStatusKey;
  amount: number;
  instructions?: I18n | null;
  bankAccount?: BankAccountInfo | null;
  qrisImageUrl?: string | null;
  proof?: PaymentProofInfo | null;
  rejectReason?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  verifiedAt?: string | null;
  createdAt?: string;
}

export interface TimelineEntry {
  id?: number;
  status: OrderStatusKey;
  fromStatus?: OrderStatusKey | null;
  at: string;
  note?: string | null;
  actorType?: string | null;
  actor?: { id: number; name: string } | null;
  meta?: Record<string, unknown> | null;
}

export interface OrderCustomer {
  id: number;
  name: string;
  company?: string | null;
  email: string;
  pic: string;
  phone?: string | null;
  taxId?: string | null;
}

export interface OrderShippingMethod {
  rateId?: number | null;
  zoneId?: number | null;
  label: I18n;
  eta: I18n | null;
  amount?: number;
  type?: 'flat' | 'per_kg' | null;
  weightGram?: number;
}

/** Bentuk penuh order (OrderResource): GET /customer/orders/{number}, respons checkout dan aksi. */
export interface Order {
  id?: number;
  number: string;
  invoiceNumber: string | null;
  date: string;
  status: OrderStatusKey;
  paymentStatus: PaymentStatusKey;
  locale?: Lang;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  feeTotal: number;
  fees?: QuoteFee[];
  taxTotal: number;
  taxRate?: number;
  priceIncludesTax?: boolean;
  uniqueCode: number;
  grandTotal: number;
  voucherCode?: string | null;
  shippingMethod: OrderShippingMethod | null;
  shippingAddress: AddressSnapshot;
  courier: string | null;
  trackingNumber: string | null;
  note: string | null;
  cancelReason?: string | null;
  paymentDueAt: string | null;
  paidAt: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  expiredAt?: string | null;
  /** Percobaan bayar yang sedang aktif (`activePayment`; `payment` = alias kontrak). */
  activePayment?: Payment | null;
  payment?: Payment | null;
  payments: Payment[];
  timeline: TimelineEntry[];
  canCancel: boolean;
  canUploadProof: boolean;
  canChangePayment: boolean;
  canConfirmReceived: boolean;
  canComplete: boolean;
  canReview: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Baris daftar order (OrderSummaryResource): GET /customer/orders, dashboard `recentOrders`. Tanpa flag can*. */
export interface OrderSummaryItem {
  productSlug: string;
  name: I18n;
  code: string | null;
  qty: number;
  unit: string | null;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderSummary {
  id: number;
  number: string;
  invoiceNumber: string | null;
  date: string;
  status: OrderStatusKey;
  paymentStatus: PaymentStatusKey;
  customer: Pick<OrderCustomer, 'id' | 'name' | 'company' | 'pic' | 'email'>;
  itemsCount: number;
  items: OrderSummaryItem[];
  subtotal: number;
  grandTotal: number;
  paymentMethod: string | null;
  paymentDueAt: string | null;
  paidAt: string | null;
  courier: string | null;
  trackingNumber: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CheckoutPayload extends QuoteRequest {
  addressId: number;
  paymentMethodCode: string;
}

export interface InsufficientStockItem {
  productSlug: string;
  requested: number;
  available: number;
}

export interface ReviewInput {
  productSlug: string;
  rating: number;
  body: string;
}

// ---- Dashboard customer (GET /customer/dashboard) ----
export interface CustomerDashboardStats {
  totalOrders: number;
  awaitingPayment: number;
  inProgress: number;
  completed: number;
  transactionValue: number;
}

/** GET /customer/dashboard: statistik datar + recentOrders[] (ringkasan) + status akun. */
export interface CustomerDashboardData extends CustomerDashboardStats {
  recentOrders: OrderSummary[];
  account: { status: AccountStatus; rejectionReason: string | null; canOrder: boolean };
}
