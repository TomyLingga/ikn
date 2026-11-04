// ============================ TIPE BERSAMA ============================
// Bentuk data dari ikn-api (/api/v1) yang dipakai lintas file. Sumber kebenaran:
// plan/02-api-contract.md + ikn-api/docs/openapi.yaml. Tipe CMS ada di lib/cms.ts.
// Tipe khusus panel admin commerce (superset Resource admin) ada di lib/admin.ts.

import type { I18n, MediaSummary } from '@/lib/cms';

export type Lang = 'id' | 'en';

/** Mata uang order (ASUMSI A-86): semua uang di JSON = integer satuan terkecil (IDR rupiah bulat, USD sen). */
export type Currency = 'IDR' | 'USD';
/** Pasar customer: local = rupiah, export = USD (dikunci admin saat approve). */
export type CustomerMarket = 'local' | 'export';

/** GET /countries: negara ISO 3166-1 alpha-2 + nama {id,en}. */
export interface Country {
  code: string;
  name: I18n;
}

// Nada warna badge/status.
export type Tone = 'ok' | 'warn' | 'bad' | 'info';

// Nama ikon yang tersedia di komponen Icon.
export type IconName =
  | 'eye'
  | 'eyeOff'
  | 'microscope'
  | 'diamond'
  | 'award'
  | 'globe'
  | 'sparkle'
  | 'factory'
  | 'ruler'
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
  | 'panelLeft'
  | 'bell'
  | 'chat'
  | 'send'
  | 'star'
  | 'search'
  | 'video'
  | 'clock'
  | 'store'
  | 'sort'
  | 'expand'
  | 'tag'
  | 'minus';

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
  /** Pasar/negara/alamat perusahaan (ASUMSI A-86); hanya customer. */
  market?: CustomerMarket;
  countryCode?: string | null;
  companyAddress?: string | null;
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
  /** Hanya customer: pasar dan mata uang order (ASUMSI A-86). */
  market?: CustomerMarket;
  currency?: Currency;
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
  /** ISO 3166-1 alpha-2 (bawaan ID); admin menentukan pasar dari negara ini (ASUMSI A-86). */
  countryCode?: string;
  companyAddress?: string;
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
  /** Hanya dari `?scope=world` (Phase E5): negara, kode alpha-2, kelas/tipe OSM (mis. harbour, port). */
  country?: string | null;
  countryCode?: string | null;
  class?: string | null;
  type?: string | null;
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
  /** Pasar dikunci admin; negara + alamat perusahaan hanya bisa diubah selagi akun pending (ASUMSI A-86). */
  market: CustomerMarket;
  currency: Currency;
  countryCode: string;
  companyAddress: string | null;
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

/** Media produk: foto atau video (ASUMSI A-72). `isThumbnail` = foto yang dipilih admin sebagai thumbnail. */
export interface ProductImage {
  id: number;
  url: string;
  sort: number;
  type?: 'image' | 'video';
  mime?: string | null;
  isThumbnail?: boolean;
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
  /**
   * Mata uang harga yang dikirim (ASUMSI A-86): tamu/customer lokal = IDR dengan field rupiah; customer ekspor
   * yang login = USD dengan `priceUsd` (sen, basis FOB Belawan) dan tanpa field rupiah.
   */
  currency: Currency;
  price?: number | null;
  /** Hanya terisi bila promo sedang aktif. */
  promoPrice?: number | null;
  promoEndsAt?: string | null;
  /** promoPrice bila aktif, selain itu price. */
  effectivePrice?: number | null;
  /** Harga USD per satuan dalam sen; null = belum dijual ke pasar ekspor (tidak bisa dipesan). Hanya `currency` USD. */
  priceUsd?: number | null;
  unit: string;
  moq: number;
  weightGram: number;
  dimensions?: ProductDimensions;
  stock: number;
  /** stock − reserved. */
  available: number;
  stockStatus: StockStatus;
  isTaxable: boolean;
  images: ProductImage[];
  /** Thumbnail: foto pilihan admin atau foto pertama; tidak pernah video. */
  image: string | null;
  hasVideo?: boolean;
  summary: I18n;
  highlights: I18nList;
  specs: string[][];
  applications: I18nList;
  solubility: string[][];
  aliases: string[];
  ratingAvg: number;
  reviewCount: number;
  /** Pabrik asal efektif (ASUMSI A-90): titik asal ongkir Franco dan titik ambil Loco item ini. */
  factory?: FactoryBrief | null;
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
  /** Mata uang `unitPrice` (item lama tanpa field ini dianggap IDR); disamakan dengan mata uang customer lewat quote. */
  currency: Currency;
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
  /** Pabrik asal efektif item (ASUMSI A-90). */
  factory?: FactoryBrief | null;
}

/** Ringkas pabrik (kode + nama {id,en}) di produk, item quote, dan rincian ongkir per pabrik (ASUMSI A-90). */
export interface FactoryBrief {
  code: string;
  name: I18n;
}

/**
 * Rincian ongkir satu pabrik asal (ASUMSI A-90): berat/volume item pabrik itu dan jarak dari pabrik itu; tarif dasar
 * dan minimum berlaku per pabrik, gratis ongkir dibandingkan dengan subtotal seluruh order. Jumlah `amount` = ongkir tarif.
 */
export interface ShippingOrigin {
  factory: FactoryBrief | null;
  weightGram: number;
  volumeCm3: number;
  distanceKm: number | null;
  amount: number;
  breakdown: ShippingBreakdown;
}

/** Titik ambil Loco per pabrik asal (QuoteResult.pickupPoints[], Order.pickupPoints[]); code/name null untuk order lama. */
export interface FactoryPickupPoint {
  code: string | null;
  name: I18n | null;
  /** Nama pabrik dalam bahasa customer saat checkout. */
  label: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  /** productSlug item yang diambil di titik ini. */
  items: string[];
}

/** Baris ongkir quote: tarif zona (flat|calculated) atau baris sintetis term tanpa ongkir (pickup|included: rateId/zoneId null, amount 0; ASUMSI A-85). */
export interface ShippingRateQuote {
  rateId: number | null;
  zoneId: number | null;
  label: I18n;
  eta: I18n | null;
  amount: number;
  /** quoted = term CIF: ongkir ditawarkan admin setelah pesanan dibuat (amount 0, warning `freight_quote_pending`). */
  type: 'flat' | 'calculated' | 'pickup' | 'included' | 'quoted';
  available?: boolean;
  distanceKm?: number | null;
  weightGram?: number;
  volumeCm3?: number;
  breakdown?: ShippingBreakdown;
  /** Rincian per pabrik asal (ASUMSI A-90); satu elemen untuk keranjang satu pabrik. */
  origins?: ShippingOrigin[] | null;
}

export interface QuoteVoucher {
  id: number;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
}

/** GET /customer/vouchers: voucher yang ditujukan khusus ke customer ini dan masih bisa dipakai. */
export interface AssignedVoucher {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
  scope: 'all' | 'category';
  endsAt: string | null;
}

export interface QuoteFee {
  id: number;
  name: I18n;
  type: string;
  amount: number;
  currency?: Currency;
}

/** Syarat pembayaran ekspor (ASUMSI A-87): GET /commerce/config `paymentTerms[]`, `QuoteResult.paymentTerm`. */
export interface PaymentTerm {
  code: string;
  name: I18n;
  description: I18n | null;
  market: DeliveryTermMarket;
}

/**
 * distance_unavailable = ada tarif per km yang disembunyikan karena alamat belum punya titik peta;
 * factory_location_unset = ada pabrik asal item tanpa titik peta (kodenya di `warningMeta`), tarif per km tidak ditawarkan (ASUMSI A-90);
 * freight_quote_pending = term CIF: ongkir belum ada, ditawarkan admin setelah pesanan dibuat (ASUMSI A-89).
 */
export type QuoteWarning = 'no_shipping_rate' | 'shipping_rate_ignored_without_address' | 'distance_unavailable' | 'factory_location_unset' | 'freight_quote_pending';

/** Rincian ongkir tiga parameter (ASUMSI A-76). */
export interface ShippingBreakdown {
  base: number;
  distance: number;
  weight: number;
  volume: number;
  minimumApplied: boolean;
  free: boolean;
}

export interface ProductDimensions {
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  volumeCm3: number;
}

export interface QuoteResult {
  /** Mata uang seluruh angka quote (mengikuti pasar customer). */
  currency: Currency;
  items: QuoteItem[];
  subtotal: number;
  discountTotal: number;
  voucher: QuoteVoucher | null;
  /** Cara serah terima yang dipakai quote (null pada server lama). */
  deliveryTerm?: DeliveryTerm | null;
  /** Syarat pembayaran yang dikirim di `paymentTermCode` (null bila tidak dikirim). */
  paymentTerm?: PaymentTerm | null;
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
  volumeCm3?: number;
  warnings: QuoteWarning[];
  /** Data tambahan per warning; `{}` bila kosong. */
  warningMeta?: { factory_location_unset?: { factoryCodes: string[] } } | Record<string, never>;
  /** Titik ambil Loco per pabrik asal (kosong untuk term selain Loco). */
  pickupPoints?: FactoryPickupPoint[];
}

/**
 * Pelabuhan tujuan yang dikirim saat checkout term CIF (`requiresDestinationPort`, ASUMSI A-89): nama bebas + negara
 * + titik peta. `lat`/`lng` wajib di server, karena itu PortPicker tidak menyerahkan nilai sebelum pin ada.
 */
export interface DestinationPortInput {
  name: string;
  country: string;
  countryCode?: string | null;
  lat: number;
  lng: number;
}

export interface QuoteRequest {
  items: { productSlug: string; qty: number }[];
  /** Kode cara serah terima; addressId/shippingRateId hanya wajib untuk term bertarif zona (ASUMSI A-85). */
  deliveryTermCode?: string | null;
  /** Syarat pembayaran (ASUMSI A-87); wajib untuk customer ekspor saat checkout. */
  paymentTermCode?: string | null;
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
  /** Rekening USD (ASUMSI A-86) membawa SWIFT, alamat bank, bank koresponden; FE menyaring per mata uang order. */
  currency?: Currency;
  swiftCode?: string | null;
  bankAddress?: string | null;
  correspondentBank?: string | null;
  isActive?: boolean;
}

// ---- Cara serah terima (delivery term, ASUMSI A-85) ----
export type DeliveryTermFamily = 'pickup' | 'door' | 'port';
export type DeliveryTermMarket = 'local' | 'export';
/** none = tanpa ongkir (Loco); zone = tarif zona (Franco); included = sudah termasuk harga (FOB); quoted = penawaran admin (CIF). */
export type DeliveryTermPricingMode = 'none' | 'zone' | 'included' | 'quoted';

/** Pajak mengikuti term (ASUMSI A-86): domestic = tarif PPN, export = tarif PPN ekspor (bawaan 0). */
export type DeliveryTermTaxProfile = 'domestic' | 'export';

/** Bentuk publik term aktif: GET /commerce/config `deliveryTerms[]` dan `QuoteResult.deliveryTerm`. */
export interface DeliveryTerm {
  code: string;
  name: I18n;
  description: I18n | null;
  family: DeliveryTermFamily;
  market: DeliveryTermMarket;
  pricingMode: DeliveryTermPricingMode;
  taxProfile?: DeliveryTermTaxProfile;
  insuranceIncluded: boolean;
  loadingPort: string | null;
  requiresDestinationPort: boolean;
}

/** Titik ambil Loco pabrik bawaan (GET /commerce/config `pickup`, ASUMSI A-90). */
export interface PickupPoint {
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

/** Lokasi pabrik, bentuk publik (GET /commerce/config `factories[]`). */
export interface FactoryLocation {
  code: string;
  name: I18n;
  address: string;
  lat: number | null;
  lng: number | null;
  /** false = keranjang berisi item pabrik ini tidak bisa Loco. */
  allowsPickup: boolean;
}

export interface CommerceConfig {
  /** Pasar dan mata uang pengunjung (ASUMSI A-86): tamu/admin/customer lokal = local/IDR. */
  market?: CustomerMarket;
  currency?: Currency;
  paymentMethods: PaymentMethodInfo[];
  /** Semua rekening aktif beserta mata uangnya; FE menyaring sesuai `currency`. */
  bankAccounts: BankAccountInfo[];
  fees: QuoteFee[];
  paymentDueHours: number;
  /** Batas bayar order USD (jam). */
  exportPaymentDueHours?: number;
  taxRate: number;
  /** Tarif PPN untuk term berprofil pajak ekspor (FOB/CIF). */
  exportTaxRate?: number;
  priceIncludesTax: boolean;
  uniqueCodeEnabled: boolean;
  autoCompleteDays: number;
  /** Cara serah terima aktif untuk pasar customer (kosong pada server lama = alur zona). */
  deliveryTerms?: DeliveryTerm[];
  /** Syarat pembayaran aktif pasar pengunjung (ASUMSI A-87); kosong untuk pasar lokal/tamu. */
  paymentTerms?: PaymentTerm[];
  pickup?: PickupPoint | null;
  /** Lokasi pabrik urut sortOrder (ASUMSI A-90): titik asal ongkir Franco dan titik ambil Loco. */
  factories?: FactoryLocation[];
  /** Teks cetakan invoice (penanda tangan, tembusan) dari pengaturan commerce. */
  invoice?: { signerName: string; signerTitle: string; cc: string };
}

// ---- Order & pembayaran (kontrak bagian 9–10, BE-3) ----
export type OrderStatusKey =
  | 'awaiting_freight'
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
  currency?: Currency;
  unitPrice: number;
  discountAmount: number;
  taxAmount?: number;
  lineTotal: number;
  image?: string | null;
  categoryId?: number | null;
  weightGram?: number;
  /** true/false bila order memuat relasi ulasan (detail); null pada ringkasan. */
  reviewed?: boolean | null;
  /** Ulasan customer untuk produk ini pada order ini. */
  review?: { rating: number; body: string | null; date: string | null } | null;
}

export interface OrderAttachment {
  id: number;
  label: string | null;
  file: { mediaId: number; url: string; originalName: string; mime: string; size: number } | null;
  at: string;
  actor?: { id: number; name: string } | null;
}

/** Catatan perjalanan kiriman dari admin di antara "Dikirim" dan "Diterima" (ASUMSI A-70). */
export interface TrackingUpdate {
  id: number;
  note: string;
  at: string;
  actor?: { id: number; name: string } | null;
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
  currency?: Currency;
  amount: number;
  /** Catatan verifikasi admin (ASUMSI A-86, informasi): jumlah yang masuk, biaya bank, catatan. */
  receivedAmount?: number | null;
  bankCharges?: number | null;
  receivedNote?: string | null;
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
  /** Snapshot pasar/negara/alamat perusahaan saat checkout (ASUMSI A-86). */
  market?: CustomerMarket | null;
  countryCode?: string | null;
  companyAddress?: string | null;
}

export interface OrderShippingMethod {
  rateId?: number | null;
  zoneId?: number | null;
  label: I18n;
  eta: I18n | null;
  amount?: number;
  /** pickup|included = baris sintetis term tanpa ongkir (ASUMSI A-85); quoted = penawaran admin CIF (ASUMSI A-89). */
  type?: 'flat' | 'calculated' | 'per_kg' | 'pickup' | 'included' | 'quoted' | null;
  weightGram?: number;
  volumeCm3?: number;
  distanceKm?: number | null;
  breakdown?: ShippingBreakdown | null;
  /** Snapshot rincian per pabrik asal (ASUMSI A-90); null untuk order lama dan term tanpa tarif zona. */
  origins?: ShippingOrigin[] | null;
  /** Rincian baris penawaran ongkir CIF yang disepakati (ongkos kapal, biaya pelabuhan, asuransi); null sebelum disepakati. */
  lines?: OrderShippingLine[] | null;
  /** Id penawaran yang disepakati (Order.freightQuotes[].id); null sebelum disepakati. */
  quoteId?: number | null;
}

/** Satu baris rincian ongkir/penawaran (label bebas atau {id,en}; amount satuan terkecil mata uang order). */
export interface OrderShippingLine {
  label: string | I18n;
  amount: number;
}

/** Pelabuhan tujuan order CIF (`orders.destination_port`, ASUMSI A-89): country/lat/lng null hanya pada data lama. */
export interface OrderDestinationPort {
  name: string;
  country: string | null;
  countryCode?: string | null;
  lat?: number | null;
  lng?: number | null;
}

// ---- Penawaran ongkir CIF per putaran (order_freight_quotes, ASUMSI A-89) ----
export type FreightQuoteStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'expired';

/** Satu baris penawaran: label bebas (≤80) + amount satuan terkecil mata uang order. */
export interface FreightQuoteLine {
  label: string;
  amount: number;
}

export interface FreightQuote {
  id: number;
  round: number;
  /** admin = penawaran dengan rincian baris; customer = harga balasan satu baris tanpa masa berlaku. */
  proposedBy: 'admin' | 'customer';
  lines: FreightQuoteLine[];
  /** Jumlah semua baris (satuan terkecil). */
  total: number;
  note: string | null;
  validUntil: string | null;
  status: FreightQuoteStatus;
  /** true bila status expired, atau masih proposed tetapi validUntil sudah lewat sebelum scheduler menandainya. */
  expired: boolean;
  createdBy: { id: number; name: string } | null;
  createdAt: string;
  respondedAt: string | null;
}

/** Metode + rekening yang dipilih saat checkout CIF; payment baru dibuat setelah penawaran ongkir disepakati. */
export interface OrderPendingPaymentMethod {
  code: string | null;
  bankAccountId: number | null;
}

/** Data kapal/B/L order FOB/CIF saat dimuat ke kapal (ASUMSI A-88); null sebelum shipped atau untuk order darat/Loco. */
export interface OrderShipmentDetails {
  vessel: string | null;
  voyage: string | null;
  blNumber: string | null;
  /** YYYY-MM-DD */
  blDate: string | null;
}

/** Proforma invoice per order (ASUMSI A-88): nomor `PI/{order}` tetap, `label` menambah " Rev.N" untuk revisi > 1. */
export interface OrderProforma {
  number: string;
  label: string;
  revision: number;
  vesselName: string | null;
  voyage: string | null;
  /** YYYY-MM-DD */
  etd: string | null;
  eta: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  paymentTerms: string | null;
  notes: string | null;
  validUntil: string | null;
  /** Saat revisi 1 dibuat; tidak berubah saat revisi. */
  issuedAt: string | null;
  updatedAt: string | null;
  updatedBy: { id: number; name: string } | null;
}

/** Body PUT /admin/orders/{number}/proforma: semua field dikirim (kosong = null) karena PUT mengganti seluruh isi. */
export interface ProformaPayload {
  vesselName: string | null;
  voyage: string | null;
  etd: string | null;
  eta: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  paymentTerms: string | null;
  notes: string | null;
  validUntil: string | null;
}

/** Cara serah terima order (OrderResource.deliveryTerm); name/loadingPort null bila baris term sudah dihapus. */
export interface OrderDeliveryTerm {
  code: string;
  name: I18n | null;
  family: DeliveryTermFamily | null;
  pricingMode: DeliveryTermPricingMode | null;
  loadingPort: string | null;
}

/** Titik ambil yang dibekukan saat checkout (OrderResource.pickup); hanya order Loco. */
export interface OrderPickup {
  label: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
}

/** Snapshot alamat order Loco: titik ambil, bukan alamat customer (tanpa kode wilayah). */
export interface PickupAddressSnapshot {
  type: 'pickup';
  /** Semua titik ambil (ASUMSI A-90); field datar = titik pertama. */
  points?: FactoryPickupPoint[];
  label: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  recipientName: string | null;
  phone: string | null;
}

/** Snapshot alamat order FOB (term keluarga port): pelabuhan muat + identitas perusahaan pembeli, bukan alamat kirim. */
export interface PortAddressSnapshot {
  type: 'port';
  label: I18n | null;
  loadingPort: string | null;
  /** Pelabuhan tujuan CIF yang dibekukan saat checkout; null untuk FOB. */
  destinationPort?: OrderDestinationPort | null;
  companyName: string | null;
  companyAddress: string | null;
  countryCode: string | null;
  recipientName: string | null;
  phone: string | null;
}

export type OrderAddressSnapshot = AddressSnapshot | PickupAddressSnapshot | PortAddressSnapshot;

/** Syarat pembayaran yang dibekukan di order (ASUMSI A-87); null untuk order lokal tanpa syarat. */
export interface OrderPaymentTerm {
  code: string;
  name: I18n;
  description: I18n | null;
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
  /** Mata uang semua angka order (ASUMSI A-86). */
  currency: Currency;
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
  shippingAddress: OrderAddressSnapshot;
  deliveryTerm?: OrderDeliveryTerm | null;
  paymentTerm?: OrderPaymentTerm | null;
  pickup?: OrderPickup | null;
  /** Titik ambil per pabrik (ASUMSI A-90); [] untuk order bukan Loco, order lama = satu titik dengan code/name null. */
  pickupPoints?: FactoryPickupPoint[];
  courier: string | null;
  /** Order FOB/CIF: server mengisi nomor B/L di sini agar kolom daftar lama tetap terisi (ASUMSI A-88). */
  trackingNumber: string | null;
  /** true untuk term keluarga port (FOB/CIF). */
  isPort?: boolean;
  shipmentDetails?: OrderShipmentDetails | null;
  /** Pelabuhan tujuan CIF yang dipilih customer saat checkout (ASUMSI A-89); null untuk term lain. */
  destinationPort?: OrderDestinationPort | null;
  /** Penawaran ongkir CIF, terbaru dulu; kosong untuk term lain. */
  freightQuotes?: FreightQuote[];
  /** Putaran terakhir bila masih `proposed` (pihak mana pun, termasuk `expired: true` yang belum ditandai); null bila tidak ada. */
  activeFreightQuote?: FreightQuote | null;
  /** Metode bayar yang ditunda sampai penawaran ongkir disepakati (order awaiting_freight). */
  pendingPaymentMethod?: OrderPendingPaymentMethod | null;
  /** Customer: order awaiting_freight + penawaran admin terakhir proposed dan masih berlaku. */
  canAcceptFreightQuote?: boolean;
  canCounterFreightQuote?: boolean;
  /** Admin: order awaiting_freight (boleh menawar atau menerima balasan customer). */
  canQuoteFreight?: boolean;
  /** Proforma invoice (null sebelum admin pertama menyimpannya); `canEditProforma` false hanya untuk cancelled/expired. */
  proforma?: OrderProforma | null;
  canEditProforma?: boolean;
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
  trackingUpdates?: TrackingUpdate[];
  canAddTracking?: boolean;
  /** Lampiran dari admin (faktur pajak, surat jalan; berkas privat lewat /files/{media}). */
  attachments?: OrderAttachment[];
  canAttach?: boolean;
  canCancel: boolean;
  canUploadProof: boolean;
  canChangePayment: boolean;
  canConfirmReceived: boolean;
  canComplete: boolean;
  canReview: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Baris daftar order (OrderSummaryResource): GET /customer/orders, dashboard `recentOrders`. */
export interface OrderSummaryItem {
  productSlug: string;
  name: I18n;
  code: string | null;
  image?: string | null;
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
  currency: Currency;
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
  /** Nama pelabuhan tujuan order CIF (ASUMSI A-89); null untuk term lain. */
  destinationPort?: string | null;
  /** Ringkasan cara serah terima untuk label daftar (null pada order lama). */
  deliveryTerm?: { code: string; family: DeliveryTermFamily | null } | null;
  canCancel?: boolean;
  canUploadProof?: boolean | null;
  canConfirmReceived?: boolean;
  canComplete?: boolean;
  canReview?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Kelompok status untuk tab "Pesanan saya" (GET /customer/orders?group=, meta.groups). */
export type OrderGroupKey = 'unpaid' | 'processing' | 'shipped' | 'completed' | 'cancelled' | 'to_review';
export type OrderGroupCounts = Record<OrderGroupKey, number>;

export interface CheckoutPayload extends QuoteRequest {
  /** Wajib hanya untuk term bertarif zona. */
  addressId?: number | null;
  paymentMethodCode: string;
  /** Wajib untuk term `requiresDestinationPort` (CIF); 422 `destinationPort.*` bila kurang. */
  destinationPort?: DestinationPortInput | null;
}

export interface InsufficientStockItem {
  productSlug: string;
  requested: number;
  available: number;
}

export interface ReviewInput {
  productSlug: string;
  rating: number;
  body: string | null;
}

// ---- Dashboard customer (GET /customer/dashboard) ----
export interface CustomerDashboardStats {
  totalOrders: number;
  awaitingPayment: number;
  inProgress: number;
  completed: number;
  transactionValue: number;
}

export interface MonthlySpend {
  ym: string;
  month: string;
  monthIndex: number;
  year: number;
  total: number;
  orders: number;
}

/**
 * GET /customer/dashboard?from&to: totalOrders/completed/transactionValue/recentOrders mengikuti rentang tanggal;
 * awaitingPayment/inProgress/toReview/actionOrders selalu sepanjang waktu (pekerjaan yang masih terbuka).
 */
export interface CustomerDashboardData extends CustomerDashboardStats {
  /** Mata uang pasar customer untuk transactionValue/monthly (ASUMSI A-86). */
  currency?: Currency;
  range?: { from: string | null; to: string | null };
  toReview?: number;
  actionOrders?: OrderSummary[];
  recentOrders: OrderSummary[];
  monthly?: MonthlySpend[];
  account: { status: AccountStatus; rejectionReason: string | null; canOrder: boolean };
}

// ---- Notifikasi dalam aplikasi (ASUMSI A-71) ----
export interface UserNotification {
  id: number;
  type: string;
  title: I18n;
  body: I18n;
  url: string | null;
  data: Record<string, unknown> | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/** GET /customer/badges. */
export interface CustomerBadges {
  notifications: number;
  chat: number;
}

// ---- Live chat (ASUMSI A-73) ----
export type ChatRole = 'customer' | 'admin';

export type ChatContext =
  | { type: 'product'; slug: string; code?: string | null; name: I18n; image: string | null; price: number | null; currency?: Currency | null; unit?: string | null }
  | { type: 'order'; number: string; status?: OrderStatusKey; grandTotal?: number; currency?: Currency | null; family?: string | null };

export interface ChatMessage {
  id: number;
  role: ChatRole;
  body: string;
  context: ChatContext | null;
  senderName: string | null;
  createdAt: string;
}

/** GET /customer/chat. */
export interface CustomerChat {
  conversation: { id: number; unread: number; lastMessageAt: string | null } | null;
  messages: ChatMessage[];
  hasMore: boolean;
}
