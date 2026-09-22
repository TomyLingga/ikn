import type {
  AdminUser,
  AdditionalFee,
  BankAccount,
  Brochure,
  Category,
  Certificate,
  Customer,
  CustomerProfile,
  GalleryItem,
  NewsItem,
  Order,
  Product,
  Review,
  ShippingMethod,
  WbsReport,
} from '@/lib/types';
import type { CustomerAccount, AdminAccount } from '@/components/AuthProvider/AuthProvider';
import type { CommerceConfig } from '@/lib/server-data';

// ============================================================================
// MASTER DUMMY DATA - 3 PRODUK UTAMA
// ============================================================================

export const MOCK_CATEGORIES: Category[] = [
  {
    slug: 'rubber-articles',
    name: 'Barang Karet',
    nameEn: 'Rubber Articles',
    desc: 'Komponen dan perlengkapan karet industri untuk berbagai sektor perkebunan dan pabrik.',
  },
  {
    slug: 'resiprene',
    name: 'Resiprene',
    nameEn: 'Resiprene',
    desc: 'Cyclised natural rubber untuk protective coating & marine paint.',
  },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    slug: 'sarung-egrek',
    code: 'IKN-PRD-001',
    name: 'Sarung Egrek',
    nameEn: 'Rubber Palm Sickle Cover',
    category: 'rubber-articles',
    kind: 'Rubber Articles',
    aliases: ['sarung egrek', 'sarung pisau egrek', 'sarung egrek sawit', 'egrek', 'cover egrek'],
    priceMode: 'fixed',
    price: 125000,
    unit: 'pcs',
    moq: 1,
    stock: 500,
    stockStatus: 'in_stock',
    image: '/img/sarung-egrek.png',
    rating: 5.0,
    reviewCount: 1,
    summary:
      'Sarung pelindung pisau egrek kelapa sawit berbahan karet alam berkualitas tinggi untuk keselamatan kerja panen dan perlindungan mata pisau.',
    summaryEn:
      'Protective palm sickle cover made of high-grade natural rubber for harvesting safety and blade longevity.',
    highlights: [
      'Karet alam tebal & elastis',
      'Pengait pengunci presisi & aman',
      'Tahan benturan & sayatan pisau',
    ],
    specs: [
      ['Material', 'Karet Alam Tebal'],
      ['Fungsi', 'Pelindung Pisau Egrek Sawit'],
      ['Sistem Kancing', 'Klip Karet Fleksibel'],
      ['Aplikasi', 'Perkebunan Kelapa Sawit'],
    ],
    applications: ['Perkebunan Kelapa Sawit', 'Keamanan Kerja Panen', 'Perlindungan Alat Perkebunan'],
    solubility: [],
  },
  {
    slug: 'sepatu-boots',
    code: 'IKN-PRD-002',
    name: 'Sepatu Boots',
    nameEn: 'Industrial Rubber Boots',
    category: 'rubber-articles',
    kind: 'Rubber Articles',
    aliases: ['sepatu boots', 'boots karet', 'sepatu boots industri', 'sepatu perkebunan', 'boots ptpn', 'rubin boots'],
    priceMode: 'fixed',
    price: 170000,
    unit: 'pcs',
    moq: 1,
    stock: 350,
    stockStatus: 'in_stock',
    image: '/img/sepatu-boots.png',
    rating: 5.0,
    reviewCount: 1,
    summary:
      'Sepatu boots karet industri dan perkebunan standar mutu tinggi dengan logo Rubin PTPN. Tahan air, anti-slip, fleksibel, dan kuat di medan berat.',
    summaryEn:
      'High-standard industrial and plantation rubber boots branded Rubin PTPN. Waterproof, anti-slip, flexible, and built for heavy-duty field work.',
    highlights: [
      'Sol anti-slip berdaya cengkeram kuat',
      'Tahan air & tahan lumpur',
      'Nyaman digunakan seharian',
      'Standar resmi Rubin & PTPN',
    ],
    specs: [
      ['Material', '100% Karet Alam / Lateks'],
      ['Tinggi', 'Tinggi Betis Standar Industri'],
      ['Fitur Sol', 'Deep Tread Anti-Slip'],
      ['Standar', 'Perkebunan & Industri'],
    ],
    applications: ['Perkebunan Kelapa Sawit & Karet', 'Pabrik & Manufaktur Industri', 'Pertanian & Konstruksi'],
    solubility: [],
  },
  {
    slug: 'resiprene-35',
    code: 'RSP-35',
    name: 'Resiprene 35',
    nameEn: 'Resiprene 35',
    category: 'resiprene',
    kind: 'Cyclised Natural Rubber',
    aliases: ['resiprine', 'respirine', 'resiprene 35', 'karet siklis', 'cyclised rubber'],
    priceMode: 'fixed',
    price: 185000,
    unit: 'kg',
    moq: 25,
    stock: 1200,
    stockStatus: 'in_stock',
    image: '/img/resiprene-35.jpg',
    rating: 4.5,
    reviewCount: 2,
    summary:
      'Karet alam tersiklisasi dalam bentuk padatan/serpihan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, dan cat marine.',
    summaryEn:
      'Cyclised natural rubber in amber crystal solid/flake form with excellent solubility in odourless solvents. A key material for protective coatings, maintenance coatings, and marine paints.',
    highlights: [
      'Cepat kering',
      'Sangat tahan air',
      'Tahan kimia (alkali & asam)',
      'Adhesi baik ke beragam substrat',
    ],
    specs: [
      ['Bentuk', 'Padatan / Serpihan Amber'],
      ['Softening Point', '125–145 °C'],
      ['Viscosity', '18–24 detik (DIN 53211)'],
      ['Color', '11–13 Lovibond'],
      ['Acid Value', 'Maks. 5 mg KOH/g'],
      ['Density', '0,88–0,98 g/ml'],
      ['Appearance', 'Clear'],
    ],
    applications: [
      'Protective coatings',
      'Cat kapal / anti-fouling',
      'Concrete coating (baru & lapuk)',
      'Odor-free finishing',
    ],
    solubility: [
      ['White spirit', 'Sempurna'],
      ['Petroleum Solvent 100–140°C', 'Sempurna'],
      ['Aromatic Oil', 'Sempurna'],
    ],
  },
];

export const MOCK_REVIEWS: Record<string, Review[]> = {
  'sarung-egrek': [
    {
      id: 'rv-egr-1',
      product: 'sarung-egrek',
      customer: 'PT Sawit Mandiri Perdana',
      rating: 5,
      body: 'Karet sangat tebal dan pas di bilah egrek. Mengurangi risiko kecelakaan kerja panen.',
      date: '2026-06-15',
    },
  ],
  'sepatu-boots': [
    {
      id: 'rv-bts-1',
      product: 'sepatu-boots',
      customer: 'Koperasi Kebun Nusantara',
      rating: 5,
      body: 'Sangat nyaman dan sol anti-slip sangat membantu di perkebunan berlumpur.',
      date: '2026-06-20',
    },
  ],
  'resiprene-35': [
    {
      id: 'rv1',
      product: 'resiprene-35',
      customer: 'Coating Solutions Co.',
      rating: 5,
      body: 'Konsisten antar batch, cepat kering. Cocok untuk formulasi cat marine kami.',
      date: '2026-05-12',
    },
    {
      id: 'rv2',
      product: 'resiprene-35',
      customer: 'PT Maritim Warna',
      rating: 4,
      body: 'Kualitas bagus dan pengiriman tepat waktu. Dokumentasi teknis lengkap.',
      date: '2026-04-02',
    },
  ],
};

// ============================================================================
// ACCOUNTS & PROFILES
// ============================================================================

export const MOCK_ADMIN_ACCOUNT: AdminAccount = {
  role: 'super_admin',
  id: 'u1',
  name: 'Super Admin IKN',
  email: 'superadmin@ptikn.com',
  permissions: ['*'],
};

export const MOCK_BUYER_ACCOUNT: CustomerAccount = {
  role: 'customer',
  id: 'c1',
  name: 'Budi Santoso',
  email: 'buyer@coatingsolutions.co.id',
  company: 'Coating Solutions Co.',
};

export const MOCK_BUYER_PROFILE: CustomerProfile = {
  customerId: 'c1',
  name: 'Budi Santoso',
  email: 'buyer@coatingsolutions.co.id',
  phone: '081234567890',
  company: 'Coating Solutions Co.',
  position: 'Procurement Manager',
  companyEmail: 'procurement@coatingsolutions.co.id',
  companyPhone: '021-5550123',
  taxId: '01.234.567.8-901.000',
  addresses: [
    {
      id: 'addr-1',
      label: 'Gudang Utama Jakarta',
      recipient: 'Budi Santoso / Gudang',
      phone: '081234567890',
      line: 'Jl. Industri Raya No. 45, Kawasan Industri Pulogadung, Jakarta Timur 13920',
      primary: true,
    },
    {
      id: 'addr-2',
      label: 'Pabrik Cikarang',
      recipient: 'Joko Widodo (Staff Logistik)',
      phone: '081298765432',
      line: 'Kawasan Industri GIIC Blok AB No. 12, Cikarang Pusat, Bekasi 17530',
      primary: false,
    },
  ],
};

export const MOCK_COMMERCE_CONFIG: CommerceConfig = {
  bankAccounts: [
    { id: 'bca', bank: 'Bank BCA', number: '0123456789', holder: 'PT Industri Karet Nusantara', active: true },
    { id: 'mandiri', bank: 'Bank Mandiri', number: '1060099887766', holder: 'PT Industri Karet Nusantara', active: true },
    { id: 'bni', bank: 'Bank BNI', number: '0987654321', holder: 'PT Industri Karet Nusantara', active: true },
  ],
  shippingMethods: [
    { id: 'ship-medan', label: 'Reguler Medan (1–2 hari)', amount: 25000 },
    { id: 'ship-sumut', label: 'Reguler Sumatera Utara (2–4 hari)', amount: 55000 },
    { id: 'ship-luar', label: 'Kargo luar Sumatera (4–9 hari)', amount: 150000 },
  ],
  additionalFees: [
    { id: 'admin-fee', label: 'Biaya administrasi', type: 'admin', amount: 5000, active: true },
  ],
  paymentDueHours: 24,
};

export const MOCK_INITIAL_ORDERS: Order[] = [
  {
    number: 'IKN-20260815-00042',
    date: '2026-08-15T09:24:00Z',
    customer: { id: 'c1', name: 'Coating Solutions Co.', email: 'buyer@coatingsolutions.co.id', pic: 'Budi Santoso' },
    items: [
      { slug: 'resiprene-35', name: 'Resiprene 35', code: 'RSP-35', qty: 100, unit: 'kg', price: 185000 },
    ],
    subtotal: 18500000,
    shipping: 150000,
    adminFee: 5000,
    total: 18655000,
    status: 'processing',
    payment: 'paid',
    bank: 'Bank BCA',
    bankInfo: { bank: 'Bank BCA', number: '0123456789', holder: 'PT Industri Karet Nusantara' },
    shippingMethod: 'Kargo luar Sumatera (4–9 hari)',
    address: {
      label: 'Gudang Utama Jakarta',
      recipient: 'Budi Santoso / Gudang',
      phone: '081234567890',
      line: 'Jl. Industri Raya No. 45, Kawasan Industri Pulogadung, Jakarta Timur 13920',
    },
    trackingNo: 'IKN-EXP-889912',
    proofUploaded: true,
    proof: {
      id: 'prf-1',
      originalName: 'bukti_transfer_bca.jpg',
      mime: 'image/jpeg',
      size: 245000,
      status: 'accepted',
      uploadedAt: '2026-08-15T10:15:00Z',
      rejectReason: null,
    },
    reviewed: false,
    timeline: [
      { status: 'awaiting_payment', at: '2026-08-15T09:24:00Z' },
      { status: 'awaiting_verification', at: '2026-08-15T10:15:00Z' },
      { status: 'processing', at: '2026-08-15T11:00:00Z' },
    ],
  },
  {
    number: 'IKN-20260818-00043',
    date: '2026-08-18T14:10:00Z',
    customer: { id: 'c1', name: 'Coating Solutions Co.', email: 'buyer@coatingsolutions.co.id', pic: 'Budi Santoso' },
    items: [
      { slug: 'sarung-egrek', name: 'Sarung Egrek', code: 'IKN-PRD-001', qty: 20, unit: 'pcs', price: 125000 },
      { slug: 'sepatu-boots', name: 'Sepatu Boots', code: 'IKN-PRD-002', qty: 10, unit: 'pcs', price: 170000 },
    ],
    subtotal: 4200000,
    shipping: 55000,
    adminFee: 5000,
    total: 4260000,
    status: 'awaiting_payment',
    payment: 'unpaid',
    bank: 'Bank Mandiri',
    bankInfo: { bank: 'Bank Mandiri', number: '1060099887766', holder: 'PT Industri Karet Nusantara' },
    shippingMethod: 'Reguler Sumatera Utara (2–4 hari)',
    address: {
      label: 'Gudang Utama Jakarta',
      recipient: 'Budi Santoso / Gudang',
      phone: '081234567890',
      line: 'Jl. Industri Raya No. 45, Kawasan Industri Pulogadung, Jakarta Timur 13920',
    },
    trackingNo: null,
    proofUploaded: false,
    proof: null,
    reviewed: false,
    timeline: [{ status: 'awaiting_payment', at: '2026-08-18T14:10:00Z' }],
  },
];

export const MOCK_NEWS: NewsItem[] = [
  {
    slug: 'resiprene-pasar-ekspor',
    title: 'Resiprene 35 menembus pasar cat marine ekspor',
    date: '18.06.2026',
    tag: 'Produk',
    thumb: '/img/produksi-karet-1.webp',
    excerpt: 'Permintaan karet siklis untuk cat pelindung kapal terus tumbuh. IKN memperkuat kapasitas produksi Resiprene 35 untuk memenuhi order ekspor.',
    published: true,
  },
  {
    slug: 'nilai-akhlak-sdm',
    title: 'Penguatan budaya AKHLAK di lingkungan kerja',
    date: '02.05.2026',
    tag: 'Perusahaan',
    thumb: '/img/pabrik-2-1.png',
    excerpt: 'Program pengembangan SDM berlandaskan nilai Amanah, Kompeten, Harmonis, Loyal, Adaptif, dan Kolaboratif digelar sepanjang tahun.',
    published: true,
  },
  {
    slug: 'kemitraan-hilir-karet',
    title: 'IKN perkuat kemitraan hilir karet Sumatera Utara',
    date: '14.03.2026',
    tag: 'Kemitraan',
    thumb: '/img/karet-1-1-scaled.jpg',
    excerpt: 'Sebagai anak perusahaan PTPN III, IKN membangun kolaborasi rantai pasok karet alam yang saling menguntungkan dengan mitra lokal.',
    published: true,
  },
];

export const MOCK_GALLERY: GalleryItem[] = [
  { id: 'g1', title: 'Fasilitas Produksi Pabrik Resiprene', type: 'image', src: '/img/home.png', published: true },
  { id: 'g2', title: 'Pengolahan Karet Alam', type: 'image', src: '/img/karet-1-1-scaled.jpg', published: true },
  { id: 'g3', title: 'Kompleks Pabrik Hilir', type: 'image', src: '/img/pabrik-2-1.png', published: true },
  { id: 'g4', title: 'Aktivitas Pemotongan Slab Karet', type: 'image', src: '/img/produksi-karet-1.webp', published: true },
];

export const MOCK_CERTIFICATES: Certificate[] = [
  { id: 'c1', name: 'ISO 37001:2016', material: 'Sistem Manajemen Anti Penyuapan (SMAP)', desc: 'Sertifikasi kepatuhan anti-penyuapan berstandar internasional.', file: '/storage/iso-37001.pdf', published: true },
  { id: 'c2', name: 'REACH Compliance', material: 'European Chemicals Agency (ECHA)', desc: 'Kepatuhan ekspor bahan kimia dan polimer ke Uni Eropa.', file: '/storage/reach-compliance.pdf', published: true },
];

export const MOCK_BROCHURES: Brochure[] = [
  { id: 'b1', title: 'Brosur Produk Resiprene 35 (Spesifikasi & Solubilitas)', file: '/storage/brosur-resiprene-35.pdf', size: '2.4 MB', published: true },
  { id: 'b2', title: 'Katalog Barang Karet & Komponen Industri', file: '/storage/katalog-barang-karet.pdf', size: '3.1 MB', published: true },
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'Coating Solutions Co.',
    email: 'buyer@coatingsolutions.co.id',
    pic: 'Budi Santoso',
    phone: '081234567890',
    company: 'Coating Solutions Co.',
    orders: 2,
    status: 'active',
    joined: '2026-01-10',
  },
  {
    id: 'c2',
    name: 'PT Maritim Warna Cat',
    email: 'purchasing@maritimwarna.co.id',
    pic: 'Hendro Wijaya',
    phone: '08119876543',
    company: 'PT Maritim Warna Cat',
    orders: 5,
    status: 'active',
    joined: '2026-02-14',
  },
];

export const MOCK_ADMIN_USERS: AdminUser[] = [
  {
    id: 'u1',
    name: 'Super Admin IKN',
    email: 'superadmin@ptikn.com',
    role: 'super_admin',
    active: true,
    permissions: ['*'],
    createdAt: '2026-01-01',
  },
  {
    id: 'u2',
    name: 'Admin Penjualan',
    email: 'sales.admin@ptikn.com',
    role: 'admin',
    active: true,
    permissions: ['orders', 'payments', 'products', 'customers', 'reports'],
    createdAt: '2026-02-01',
  },
];

export const MOCK_WBS_REPORTS: WbsReport[] = [
  {
    id: 'wbs-1',
    code: 'WBS-202607-001',
    subject: 'Laporan Integritas Pengadaan Bahan Penunjang',
    date: '2026-07-20',
    status: 'review',
    anonymous: true,
  },
];
