import {
  MOCK_ADMIN_ACCOUNT,
  MOCK_ADMIN_USERS,
  MOCK_BROCHURES,
  MOCK_BUYER_ACCOUNT,
  MOCK_BUYER_PROFILE,
  MOCK_CATEGORIES,
  MOCK_CERTIFICATES,
  MOCK_COMMERCE_CONFIG,
  MOCK_CUSTOMERS,
  MOCK_GALLERY,
  MOCK_INITIAL_ORDERS,
  MOCK_NEWS,
  MOCK_PRODUCTS,
  MOCK_REVIEWS,
  MOCK_WBS_REPORTS,
} from '@/lib/mock-data';
import {
  saveOrderToDb,
  saveProductToDb,
  deleteProductFromDb,
  saveCategoryToDb,
  saveCustomerProfileToDb,
  saveCommerceConfigToDb,
  saveWbsReportToDb,
} from '@/lib/supabase-service';
import type { CustomerAccount, AdminAccount } from '@/components/AuthProvider/AuthProvider';
import type {
  CustomerProfile,
  Order,
  OrderItem,
  Product,
  Category,
  NewsItem,
  GalleryItem,
  Certificate,
  Brochure,
  Customer,
  AdminUser,
  WbsReport,
  OrderStatusKey,
} from '@/lib/types';
import type { CommerceConfig } from '@/lib/server-data';

// ============================================================================
// LOCAL STORAGE PERSISTENCE HELPERS
// ============================================================================

const STORAGE_KEYS = {
  CUSTOMER: 'ikn_mock_customer',
  ADMIN: 'ikn_mock_admin',
  ORDERS: 'ikn_mock_orders',
  PRODUCTS: 'ikn_mock_products',
  CATEGORIES: 'ikn_mock_categories',
  PROFILE: 'ikn_mock_profile',
  CONFIG: 'ikn_mock_config',
  NEWS: 'ikn_mock_news',
  GALLERY: 'ikn_mock_gallery',
  CERTIFICATES: 'ikn_mock_certificates',
  BROCHURES: 'ikn_mock_brochures',
  CUSTOMERS: 'ikn_mock_customers',
  ADMIN_USERS: 'ikn_mock_admin_users',
  WBS: 'ikn_mock_wbs',
  BLOCKS: 'ikn_mock_blocks',
};

function getStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

const STORE_VERSION = 'v4_3_products_only';

// Inisialisasi store saat pertama kali dijalankan
export function initMockStore(): void {
  if (typeof window === 'undefined') return;
  const currentVersion = localStorage.getItem('ikn_mock_version');
  if (currentVersion !== STORE_VERSION) {
    localStorage.setItem('ikn_mock_version', STORE_VERSION);
    setStorage(STORAGE_KEYS.PRODUCTS, MOCK_PRODUCTS);
    setStorage(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
  } else {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      setStorage(STORAGE_KEYS.PRODUCTS, MOCK_PRODUCTS);
    }
    if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
      setStorage(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    }
  }
  if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
    setStorage(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROFILE)) {
    setStorage(STORAGE_KEYS.PROFILE, MOCK_BUYER_PROFILE);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
    setStorage(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
  }
  if (!localStorage.getItem(STORAGE_KEYS.NEWS)) {
    setStorage(STORAGE_KEYS.NEWS, MOCK_NEWS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.GALLERY)) {
    setStorage(STORAGE_KEYS.GALLERY, MOCK_GALLERY);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CERTIFICATES)) {
    setStorage(STORAGE_KEYS.CERTIFICATES, MOCK_CERTIFICATES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.BROCHURES)) {
    setStorage(STORAGE_KEYS.BROCHURES, MOCK_BROCHURES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    setStorage(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USERS)) {
    setStorage(STORAGE_KEYS.ADMIN_USERS, MOCK_ADMIN_USERS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.WBS)) {
    setStorage(STORAGE_KEYS.WBS, MOCK_WBS_REPORTS);
  }
}

export class MockApiError extends Error {
  status: number;
  errors: Record<string, string[]>;

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

// ============================================================================
// MOCK API DISPATCHER
// ============================================================================

export function handleMockApi(path: string, options: { method?: string; body?: any; formData?: FormData } = {}): any {
  if (typeof window !== 'undefined') {
    initMockStore();
  }

  const method = (options.method || 'GET').toUpperCase();
  const pathPart = path.split('?')[0] || '';
  const cleanPath = pathPart.replace(/^\/api/, '');
  const queryPart = path.includes('?') ? (path.split('?')[1] || '') : '';
  const urlParams = new URLSearchParams(queryPart);
  const body = options.body || {};

  // --------------------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------------------

  if (cleanPath === '/sanctum/csrf-cookie') {
    return { ok: true };
  }

  if (cleanPath === '/auth/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    // Buyer / Customer login
    if (email === 'buyer@coatingsolutions.co.id' || email.includes('buyer') || email.includes('customer')) {
      if (password === 'password' || password.length >= 4) {
        const account = { ...MOCK_BUYER_ACCOUNT, email };
        setStorage(STORAGE_KEYS.CUSTOMER, account);
        return { account };
      }
      throw new MockApiError(422, 'Kata sandi tidak sesuai.', { password: ['Kata sandi salah.'] });
    }

    // Default match if user registered
    const registeredCustomers = getStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
    const matched = registeredCustomers.find((c) => c.email.toLowerCase() === email);
    if (matched && (password === 'password' || password.length >= 4)) {
      const account: CustomerAccount = {
        role: 'customer',
        id: matched.id,
        name: matched.pic || matched.name,
        email: matched.email,
        company: matched.company || matched.name,
      };
      setStorage(STORAGE_KEYS.CUSTOMER, account);
      return { account };
    }

    throw new MockApiError(422, 'Email atau kata sandi customer tidak ditemukan.', {
      email: ['Email tidak terdaftar sebagai customer.'],
    });
  }

  if (cleanPath === '/auth/admin/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (email === 'superadmin@ptikn.com' || email.includes('admin')) {
      if (password === 'password' || password.length >= 4) {
        const account = { ...MOCK_ADMIN_ACCOUNT, email };
        setStorage(STORAGE_KEYS.ADMIN, account);
        return { account };
      }
      throw new MockApiError(422, 'Kata sandi admin tidak sesuai.', { password: ['Kata sandi salah.'] });
    }

    throw new MockApiError(422, 'Email tidak terdaftar sebagai admin.', {
      email: ['Akun admin tidak ditemukan.'],
    });
  }

  if (cleanPath === '/auth/register' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '');
    const company = String(body.company || '');
    const phone = String(body.phone || '');

    const account: CustomerAccount = {
      role: 'customer',
      id: 'c-' + Date.now(),
      name,
      email,
      company,
    };
    setStorage(STORAGE_KEYS.CUSTOMER, account);

    const customers = getStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
    customers.push({
      id: account.id,
      name: company || name,
      email,
      pic: name,
      phone,
      company,
      orders: 0,
      status: 'active',
      joined: new Date().toISOString().split('T')[0] || '2026-08-20',
    });
    setStorage(STORAGE_KEYS.CUSTOMERS, customers);

    return { account };
  }

  if (cleanPath === '/auth/me' && method === 'GET') {
    const customer = getStorage<CustomerAccount | null>(STORAGE_KEYS.CUSTOMER, null);
    const admin = getStorage<AdminAccount | null>(STORAGE_KEYS.ADMIN, null);
    return { customer, admin };
  }

  if (cleanPath === '/auth/logout' && method === 'POST') {
    const scope = body.scope;
    if (scope === 'customer') setStorage(STORAGE_KEYS.CUSTOMER, null);
    else if (scope === 'admin') setStorage(STORAGE_KEYS.ADMIN, null);
    else {
      setStorage(STORAGE_KEYS.CUSTOMER, null);
      setStorage(STORAGE_KEYS.ADMIN, null);
    }
    return { ok: true };
  }

  // --------------------------------------------------------------------------
  // CUSTOMER PROFILE & ADDRESSES
  // --------------------------------------------------------------------------

  if (cleanPath === '/customer/profile') {
    const profile = getStorage<CustomerProfile>(STORAGE_KEYS.PROFILE, MOCK_BUYER_PROFILE);
    if (method === 'GET') return profile;
    if (method === 'PUT') {
      const updated = { ...profile, ...body };
      setStorage(STORAGE_KEYS.PROFILE, updated);
      saveCustomerProfileToDb(updated).catch(() => {});
      return updated;
    }
  }

  if (cleanPath === '/customer/profile/company' && method === 'PUT') {
    const profile = getStorage<CustomerProfile>(STORAGE_KEYS.PROFILE, MOCK_BUYER_PROFILE);
    const updated = {
      ...profile,
      company: body.company ?? profile.company,
      position: body.position ?? profile.position,
      companyEmail: body.companyEmail ?? profile.companyEmail,
      companyPhone: body.companyPhone ?? profile.companyPhone,
      taxId: body.taxId ?? profile.taxId,
    };
    setStorage(STORAGE_KEYS.PROFILE, updated);
    saveCustomerProfileToDb(updated).catch(() => {});
    return updated;
  }

  if (cleanPath === '/customer/addresses') {
    const profile = getStorage<CustomerProfile>(STORAGE_KEYS.PROFILE, MOCK_BUYER_PROFILE);
    if (method === 'GET') return profile.addresses;
    if (method === 'POST') {
      const newAddress = {
        id: 'addr-' + Date.now(),
        label: body.label || 'Alamat',
        recipient: body.recipient || '',
        phone: body.phone || '',
        line: body.line || '',
        primary: profile.addresses.length === 0,
      };
      profile.addresses.push(newAddress);
      setStorage(STORAGE_KEYS.PROFILE, profile);
      saveCustomerProfileToDb(profile).catch(() => {});
      return profile;
    }
  }

  const addrMatch = cleanPath.match(/^\/customer\/addresses\/([^/]+)(\/primary)?$/);
  if (addrMatch) {
    const addrId = decodeURIComponent(addrMatch[1] || '');
    const isPrimaryAction = Boolean(addrMatch[2]);
    const profile = getStorage<CustomerProfile>(STORAGE_KEYS.PROFILE, MOCK_BUYER_PROFILE);

    if (isPrimaryAction && method === 'PUT') {
      profile.addresses = profile.addresses.map((a) => ({
        ...a,
        primary: a.id === addrId,
      }));
      setStorage(STORAGE_KEYS.PROFILE, profile);
      saveCustomerProfileToDb(profile).catch(() => {});
      return profile;
    }

    if (method === 'PUT') {
      profile.addresses = profile.addresses.map((a) =>
        a.id === addrId ? { ...a, ...body } : a
      );
      setStorage(STORAGE_KEYS.PROFILE, profile);
      saveCustomerProfileToDb(profile).catch(() => {});
      return profile;
    }

    if (method === 'DELETE') {
      profile.addresses = profile.addresses.filter((a) => a.id !== addrId);
      setStorage(STORAGE_KEYS.PROFILE, profile);
      saveCustomerProfileToDb(profile).catch(() => {});
      return profile;
    }
  }

  // --------------------------------------------------------------------------
  // CUSTOMER ORDERS & TRANSACTIONS
  // --------------------------------------------------------------------------

  if (cleanPath === '/customer/orders') {
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    if (method === 'GET') return orders;
    if (method === 'POST') {
      const products = getStorage<Product[]>(STORAGE_KEYS.PRODUCTS, MOCK_PRODUCTS);
      const config = getStorage<CommerceConfig>(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
      const profile = getStorage<CustomerProfile>(STORAGE_KEYS.PROFILE, MOCK_BUYER_PROFILE);

      const items: OrderItem[] = (body.items || []).map((it: { slug: string; qty: number }) => {
        const prod = products.find((p) => p.slug === it.slug);
        return {
          slug: it.slug,
          name: prod?.name || it.slug,
          code: prod?.code || 'PRD',
          qty: it.qty,
          unit: prod?.unit || 'pcs',
          price: prod?.price || 0,
        };
      });

      const subtotal = items.reduce((acc: number, it: OrderItem) => acc + it.price * it.qty, 0);
      const shippingMethod = config.shippingMethods.find((m) => m.id === body.shippingMethodId);
      const shipping = shippingMethod?.amount || 25000;
      const adminFee = config.additionalFees.reduce((acc, f) => acc + (f.active ? f.amount : 0), 0);
      const total = subtotal + shipping + adminFee;
      const bank = config.bankAccounts.find((b) => b.id === body.bankId) || config.bankAccounts[0] || {
        id: 'bca',
        bank: 'Bank BCA',
        number: '0123456789',
        holder: 'PT Industri Karet Nusantara',
        active: true,
      };

      const now = new Date();
      const orderNumber = `IKN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(10000 + Math.random() * 90000))}`;
      const dueAt = new Date(now.getTime() + (config.paymentDueHours || 24) * 3600 * 1000).toISOString();

      const newOrder: Order = {
        number: orderNumber,
        date: now.toISOString(),
        customer: {
          id: profile.customerId,
          name: profile.company || profile.name,
          email: profile.email,
          pic: profile.name,
        },
        items,
        subtotal,
        shipping,
        adminFee,
        total,
        status: 'awaiting_payment',
        payment: 'unpaid',
        bank: bank.bank,
        bankInfo: { bank: bank.bank, number: bank.number, holder: bank.holder },
        shippingMethod: shippingMethod?.label || 'Reguler',
        address: body.address || profile.addresses[0] || { label: 'Alamat', recipient: profile.name, phone: profile.phone, line: '' },
        trackingNo: null,
        note: body.note || '',
        proofUploaded: false,
        proof: null,
        reviewed: false,
        dueAt,
        timeline: [{ status: 'awaiting_payment', at: now.toISOString() }],
      };

      orders.unshift(newOrder);
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(newOrder).catch(() => {});
      return newOrder;
    }
  }

  const custOrderMatch = cleanPath.match(/^\/customer\/orders\/([^/]+)(\/(proof|confirm-received|reviews|cancel))?$/);
  if (custOrderMatch) {
    const orderNumber = decodeURIComponent(custOrderMatch[1] || '');
    const action = custOrderMatch[3];
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    const orderIndex = orders.findIndex((o) => o.number === orderNumber);

    if (orderIndex === -1) {
      throw new MockApiError(404, 'Pesanan tidak ditemukan.');
    }

    const existingOrder = orders[orderIndex];
    if (!existingOrder) {
      throw new MockApiError(404, 'Pesanan tidak ditemukan.');
    }
    const order: Order = { ...existingOrder };

    if (!action && method === 'GET') {
      return order;
    }

    if (action === 'proof' && method === 'POST') {
      const now = new Date().toISOString();
      order.proofUploaded = true;
      order.proof = {
        id: 'prf-' + Date.now(),
        originalName: 'bukti_transfer.jpg',
        mime: 'image/jpeg',
        size: 150000,
        status: 'pending',
        uploadedAt: now,
        rejectReason: null,
      };
      order.status = 'awaiting_verification';
      order.payment = 'awaiting_confirmation';
      order.timeline = [...(order.timeline || []), { status: 'awaiting_verification', at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }

    if (action === 'confirm-received' && method === 'POST') {
      const now = new Date().toISOString();
      order.status = 'delivered';
      order.timeline = [...(order.timeline || []), { status: 'delivered', at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }

    if (action === 'reviews' && method === 'POST') {
      const now = new Date().toISOString();
      order.reviewed = true;
      order.status = 'completed';
      order.timeline = [...(order.timeline || []), { status: 'completed', at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }

    if (action === 'cancel' && method === 'POST') {
      const now = new Date().toISOString();
      order.status = 'cancelled';
      order.timeline = [...(order.timeline || []), { status: 'cancelled', at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }
  }

  // --------------------------------------------------------------------------
  // ADMIN BACK-OFFICE & COMMERCE
  // --------------------------------------------------------------------------

  if (cleanPath === '/admin/permissions/self') {
    return {
      role: 'super_admin',
      allowed: [
        'orders',
        'payments',
        'products',
        'categories',
        'customers',
        'bank',
        'fees',
        'reports',
        'menu',
        'gallery',
        'news',
        'content',
        'wbs',
        'users',
      ],
    };
  }

  if (cleanPath === '/admin/dashboard' && method === 'GET') {
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    const paidOrders = orders.filter((o) => o.payment === 'paid');
    const revenueThisMonth = paidOrders.reduce((acc, o) => acc + o.total, 0);
    const pendingVerification = orders.filter((o) => o.status === 'awaiting_verification').length;

    return {
      stats: {
        ordersThisMonth: orders.length,
        revenueThisMonth,
        activeCustomers: 12,
        pendingVerification,
      },
      needsAction: orders.filter((o) => o.status === 'awaiting_verification' || o.status === 'processing'),
      recentOrders: orders.slice(0, 5),
      salesByMonth: [
        { ym: '2026-01', month: 'Jan', total: 45000000, orders: 8 },
        { ym: '2026-02', month: 'Feb', total: 62000000, orders: 12 },
        { ym: '2026-03', month: 'Mar', total: 58000000, orders: 11 },
        { ym: '2026-04', month: 'Apr', total: 75000000, orders: 15 },
        { ym: '2026-05', month: 'Mei', total: 89000000, orders: 18 },
        { ym: '2026-06', month: 'Jun', total: 95000000, orders: 20 },
        { ym: '2026-07', month: 'Jul', total: 110000000, orders: 24 },
        { ym: '2026-08', month: 'Agu', total: revenueThisMonth || 85000000, orders: orders.length },
      ],
    };
  }

  if (cleanPath === '/admin/orders') {
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    const status = urlParams.get('status');
    if (status && status !== 'all') {
      return orders.filter((o) => o.status === status);
    }
    return orders;
  }

  const adminOrderMatch = cleanPath.match(/^\/admin\/orders\/([^/]+)(\/(status|ship|cancel))?$/);
  if (adminOrderMatch) {
    const orderNumber = decodeURIComponent(adminOrderMatch[1] || '');
    const action = adminOrderMatch[3];
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    const orderIndex = orders.findIndex((o) => o.number === orderNumber);

    if (orderIndex === -1) {
      throw new MockApiError(404, 'Order tidak ditemukan.');
    }

    const existingOrder = orders[orderIndex];
    if (!existingOrder) {
      throw new MockApiError(404, 'Order tidak ditemukan.');
    }
    const order: Order = { ...existingOrder };

    if (!action && method === 'GET') {
      return order;
    }

    if (action === 'status' && method === 'POST') {
      const now = new Date().toISOString();
      order.status = body.status as OrderStatusKey;
      order.timeline = [...(order.timeline || []), { status: order.status, at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }

    if (action === 'ship' && method === 'POST') {
      const now = new Date().toISOString();
      order.trackingNo = body.trackingNo || 'IKN-EXP-' + Math.floor(100000 + Math.random() * 900000);
      order.status = 'shipped';
      order.timeline = [...(order.timeline || []), { status: 'shipped', at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }

    if (action === 'cancel' && method === 'POST') {
      const now = new Date().toISOString();
      order.status = 'cancelled';
      order.timeline = [...(order.timeline || []), { status: 'cancelled', at: now }];
      orders[orderIndex] = order;
      setStorage(STORAGE_KEYS.ORDERS, orders);
      saveOrderToDb(order).catch(() => {});
      return order;
    }
  }

  if (cleanPath === '/admin/payments' && method === 'GET') {
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    return orders.filter((o) => o.proofUploaded || o.payment === 'awaiting_confirmation');
  }

  const adminPaymentMatch = cleanPath.match(/^\/admin\/payments\/([^/]+)\/(accept|reject)$/);
  if (adminPaymentMatch) {
    const orderNumber = decodeURIComponent(adminPaymentMatch[1] || '');
    const action = adminPaymentMatch[2];
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    const orderIndex = orders.findIndex((o) => o.number === orderNumber);

    if (orderIndex === -1) {
      throw new MockApiError(404, 'Order tidak ditemukan.');
    }

    const existingOrder = orders[orderIndex];
    if (!existingOrder) {
      throw new MockApiError(404, 'Order tidak ditemukan.');
    }
    const order: Order = { ...existingOrder };
    const now = new Date().toISOString();

    if (action === 'accept') {
      order.payment = 'paid';
      order.status = 'processing';
      if (order.proof) order.proof.status = 'accepted';
      order.timeline = [...(order.timeline || []), { status: 'processing', at: now }];
    } else {
      order.payment = 'rejected';
      order.rejectReason = body.reason || 'Bukti transfer tidak valid atau tidak terbaca.';
      if (order.proof) {
        order.proof.status = 'rejected';
        order.proof.rejectReason = order.rejectReason || null;
      }
    }

    orders[orderIndex] = order;
    setStorage(STORAGE_KEYS.ORDERS, orders);
    saveOrderToDb(order).catch(() => {});
    return order;
  }

  if (cleanPath === '/admin/reports/sales') {
    const orders = getStorage<Order[]>(STORAGE_KEYS.ORDERS, MOCK_INITIAL_ORDERS);
    const paidOrders = orders.filter((o) => o.payment === 'paid');
    const totalPaid = paidOrders.reduce((acc, o) => acc + o.total, 0);

    return {
      summary: {
        orderCount: orders.length,
        paidCount: paidOrders.length,
        totalPaid,
        itemsSold: paidOrders.reduce((acc, o) => acc + o.items.reduce((sum, it) => sum + it.qty, 0), 0),
      },
      chartMode: 'monthly',
      chartData: [
        { label: 'Jan', key: '1', total: 45000000, orders: 8 },
        { label: 'Feb', key: '2', total: 62000000, orders: 12 },
        { label: 'Mar', key: '3', total: 58000000, orders: 11 },
        { label: 'Apr', key: '4', total: 75000000, orders: 15 },
        { label: 'Mei', key: '5', total: 89000000, orders: 18 },
        { label: 'Jun', key: '6', total: 95000000, orders: 20 },
        { label: 'Jul', key: '7', total: 110000000, orders: 24 },
        { label: 'Agu', key: '8', total: totalPaid || 85000000, orders: orders.length },
      ],
      topProducts: [
        { product_slug: 'sarung-egrek', name: 'Sarung Egrek', qty: 250, value: 31250000 },
        { product_slug: 'sepatu-boots', name: 'Sepatu Boots', qty: 180, value: 30600000 },
        { product_slug: 'resiprene-35', name: 'Resiprene 35', qty: 450, value: 83250000 },
      ],
      orders,
    };
  }

  // --------------------------------------------------------------------------
  // PRODUCTS & CATEGORIES
  // --------------------------------------------------------------------------

  if (cleanPath === '/catalog/categories' || cleanPath === '/admin/product-categories' || cleanPath === '/admin/categories') {
    const categories = getStorage<Category[]>(STORAGE_KEYS.CATEGORIES, MOCK_CATEGORIES);
    const products = getStorage<Product[]>(STORAGE_KEYS.PRODUCTS, MOCK_PRODUCTS);

    if (method === 'GET') {
      if (cleanPath.startsWith('/admin')) {
        return categories.map((c) => ({
          ...c,
          productCount: products.filter((p) => p.category === c.slug).length,
        }));
      }
      return categories;
    }

    if (method === 'POST') {
      const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-');
      const newCat: Category = {
        slug,
        name: body.name,
        nameEn: body.nameEn || body.name,
        desc: body.desc || '',
      };
      categories.push(newCat);
      setStorage(STORAGE_KEYS.CATEGORIES, categories);
      saveCategoryToDb(newCat).catch(() => {});
      return newCat;
    }
  }

  if (cleanPath === '/catalog/products' || cleanPath === '/admin/products') {
    let products = getStorage<Product[]>(STORAGE_KEYS.PRODUCTS, MOCK_PRODUCTS);

    if (method === 'GET') {
      const q = (urlParams.get('q') || '').toLowerCase();
      const cat = urlParams.get('category');
      if (cat && cat !== 'all') {
        products = products.filter((p) => p.category === cat);
      }
      if (q) {
        products = products.filter((p) =>
          [p.name, p.nameEn, p.code, p.kind, ...(p.aliases || [])].join(' ').toLowerCase().includes(q)
        );
      }

      // Prioritas 3 produk utama
      products.sort((a, b) => {
        const order = ['sarung-egrek', 'sepatu-boots', 'resiprene-35'];
        const idxA = order.indexOf(a.slug);
        const idxB = order.indexOf(b.slug);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.name.localeCompare(b.name);
      });

      if (cleanPath === '/admin/products') return products;

      return {
        items: products,
        total: products.length,
        page: 1,
        pageCount: 1,
      };
    }

    if (method === 'POST') {
      const newProduct: Product = {
        slug: body.slug || body.name.toLowerCase().replace(/\s+/g, '-'),
        code: body.code || 'IKN-PRD-' + Math.floor(100 + Math.random() * 900),
        name: body.name,
        nameEn: body.nameEn || body.name,
        category: body.category || 'rubber-articles',
        kind: body.kind || 'Rubber Articles',
        priceMode: body.priceMode || 'fixed',
        price: body.price ?? 100000,
        unit: body.unit || 'pcs',
        moq: body.moq || 1,
        stock: body.stock || 100,
        stockStatus: body.stockStatus || 'in_stock',
        image: body.image || '/img/sarung-egrek.png',
        summary: body.summary || '',
        summaryEn: body.summaryEn || '',
        highlights: body.highlights || [],
        specs: body.specs || [],
        applications: body.applications || [],
        rating: 5.0,
        reviewCount: 0,
      };
      products.push(newProduct);
      setStorage(STORAGE_KEYS.PRODUCTS, products);
      saveProductToDb(newProduct).catch(() => {});
      return newProduct;
    }
  }

  const prodDetailMatch = cleanPath.match(/^\/(catalog|admin)\/products\/([^/]+)(\/publish)?$/);
  if (prodDetailMatch) {
    const slug = decodeURIComponent(prodDetailMatch[2] || '');
    const isPublishAction = Boolean(prodDetailMatch[3]);
    const products = getStorage<Product[]>(STORAGE_KEYS.PRODUCTS, MOCK_PRODUCTS);
    const prod = products.find((p) => p.slug === slug);

    if (!prod) {
      throw new MockApiError(404, 'Produk tidak ditemukan.');
    }

    if (isPublishAction && method === 'POST') {
      return { ok: true, published: true };
    }

    if (method === 'GET') {
      const reviews = MOCK_REVIEWS[slug] || [];
      return { product: prod, reviews };
    }

    if (method === 'PUT') {
      const updated = { ...prod, ...body };
      const idx = products.findIndex((p) => p.slug === slug);
      products[idx] = updated;
      setStorage(STORAGE_KEYS.PRODUCTS, products);
      saveProductToDb(updated).catch(() => {});
      return updated;
    }

    if (method === 'DELETE') {
      const filtered = products.filter((p) => p.slug !== slug);
      setStorage(STORAGE_KEYS.PRODUCTS, filtered);
      deleteProductFromDb(slug).catch(() => {});
      return { ok: true };
    }
  }

  // --------------------------------------------------------------------------
  // COMMERCE CONFIG & SETTINGS
  // --------------------------------------------------------------------------

  if (cleanPath === '/commerce/config' && method === 'GET') {
    return getStorage<CommerceConfig>(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
  }

  if (cleanPath === '/admin/bank-accounts') {
    const config = getStorage<CommerceConfig>(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
    if (method === 'GET') return config.bankAccounts;
    if (method === 'POST') {
      const newBank = {
        id: body.id || 'bank-' + Date.now(),
        bank: body.bank,
        number: body.number,
        holder: body.holder,
        active: body.active !== false,
      };
      config.bankAccounts.push(newBank);
      setStorage(STORAGE_KEYS.CONFIG, config);
      saveCommerceConfigToDb(config).catch(() => {});
      return newBank;
    }
  }

  if (cleanPath === '/admin/fees') {
    const config = getStorage<CommerceConfig>(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
    if (method === 'GET') return config.additionalFees;
    if (method === 'POST') {
      const newFee = {
        id: body.id || 'fee-' + Date.now(),
        label: body.label,
        type: body.type || 'admin',
        amount: Number(body.amount) || 0,
        active: body.active !== false,
      };
      config.additionalFees.push(newFee);
      setStorage(STORAGE_KEYS.CONFIG, config);
      saveCommerceConfigToDb(config).catch(() => {});
      return newFee;
    }
  }

  if (cleanPath === '/admin/shipping-methods') {
    const config = getStorage<CommerceConfig>(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
    if (method === 'GET') return config.shippingMethods;
    if (method === 'POST') {
      const newShip = {
        id: body.id || 'ship-' + Date.now(),
        label: body.label,
        amount: Number(body.amount) || 0,
      };
      config.shippingMethods.push(newShip);
      setStorage(STORAGE_KEYS.CONFIG, config);
      saveCommerceConfigToDb(config).catch(() => {});
      return newShip;
    }
  }

  if (cleanPath === '/admin/settings') {
    const config = getStorage<CommerceConfig>(STORAGE_KEYS.CONFIG, MOCK_COMMERCE_CONFIG);
    if (method === 'GET') return { paymentDueHours: config.paymentDueHours || 24 };
    if (method === 'PUT') {
      config.paymentDueHours = Number(body.paymentDueHours) || 24;
      setStorage(STORAGE_KEYS.CONFIG, config);
      saveCommerceConfigToDb(config).catch(() => {});
      return { paymentDueHours: config.paymentDueHours };
    }
  }

  // --------------------------------------------------------------------------
  // CONTENT: NEWS, GALLERY, CERTIFICATES, BROCHURES, USERS, WBS
  // --------------------------------------------------------------------------

  if (cleanPath === '/content/news' || cleanPath === '/admin/news') {
    const news = getStorage<NewsItem[]>(STORAGE_KEYS.NEWS, MOCK_NEWS);
    if (method === 'GET') return news;
    if (method === 'POST') {
      const item: NewsItem = {
        slug: body.slug || body.title.toLowerCase().replace(/\s+/g, '-'),
        title: body.title,
        date: new Date().toLocaleDateString('id-ID'),
        tag: body.tag || 'Berita',
        thumb: body.thumb || '/img/produksi-karet-1.webp',
        excerpt: body.excerpt || '',
        published: true,
      };
      news.unshift(item);
      setStorage(STORAGE_KEYS.NEWS, news);
      return item;
    }
  }

  const newsDetailMatch = cleanPath.match(/^\/(content|admin)\/news\/([^/]+)$/);
  if (newsDetailMatch) {
    const slug = decodeURIComponent(newsDetailMatch[2] || '');
    const news = getStorage<NewsItem[]>(STORAGE_KEYS.NEWS, MOCK_NEWS);
    const item = news.find((n) => n.slug === slug);
    if (!item) throw new MockApiError(404, 'Berita tidak ditemukan.');
    if (method === 'GET') {
      return {
        ...item,
        titleEn: item.title,
        excerptEn: item.excerpt,
        body: item.excerpt + '\n\nPT Industri Karet Nusantara terus berkomitmen menghadirkan produk hilir berkualitas tinggi.',
        bodyEn: item.excerpt + '\n\nPT Industri Karet Nusantara is committed to delivering premium quality downstream rubber products.',
      };
    }
    if (method === 'PUT') {
      const updated = { ...item, ...body };
      const idx = news.findIndex((n) => n.slug === slug);
      news[idx] = updated;
      setStorage(STORAGE_KEYS.NEWS, news);
      return updated;
    }
    if (method === 'DELETE') {
      setStorage(STORAGE_KEYS.NEWS, news.filter((n) => n.slug !== slug));
      return { ok: true };
    }
  }

  if (cleanPath === '/admin/media' && method === 'POST') {
    const file = options.formData?.get('file');
    let name = 'media-upload.webp';
    let url = '/img/produksi-karet-1.webp';
    if (file && typeof file === 'object' && 'name' in file) {
      name = (file as any).name;
    }
    return { url, name, id: 'med-' + Date.now() };
  }

  if (cleanPath === '/content/gallery' || cleanPath === '/admin/gallery' || cleanPath === '/admin/content/media') {
    const gallery = getStorage<GalleryItem[]>(STORAGE_KEYS.GALLERY, MOCK_GALLERY);
    if (method === 'GET') return gallery;
    if (method === 'POST') {
      const item: GalleryItem = {
        id: 'g-' + Date.now(),
        title: body.title || 'Foto Galeri',
        type: body.type || 'image',
        src: body.src || '/img/home.png',
        published: true,
      };
      gallery.push(item);
      setStorage(STORAGE_KEYS.GALLERY, gallery);
      return item;
    }
  }

  if (cleanPath === '/content/certificates' || cleanPath === '/admin/certificates') {
    const certs = getStorage<Certificate[]>(STORAGE_KEYS.CERTIFICATES, MOCK_CERTIFICATES);
    if (method === 'GET') return certs;
    if (method === 'POST') {
      const item: Certificate = {
        id: 'c-' + Date.now(),
        name: body.name,
        material: body.material || '',
        desc: body.desc || '',
        file: body.file || '/storage/sertifikat.pdf',
        published: true,
      };
      certs.push(item);
      setStorage(STORAGE_KEYS.CERTIFICATES, certs);
      return item;
    }
  }

  if (cleanPath === '/content/brochures' || cleanPath === '/admin/brochures') {
    const brochures = getStorage<Brochure[]>(STORAGE_KEYS.BROCHURES, MOCK_BROCHURES);
    if (method === 'GET') return brochures;
    if (method === 'POST') {
      const item: Brochure = {
        id: 'b-' + Date.now(),
        title: body.title,
        file: body.file || '/storage/brosur.pdf',
        size: body.size || '2.0 MB',
        published: true,
      };
      brochures.push(item);
      setStorage(STORAGE_KEYS.BROCHURES, brochures);
      return item;
    }
  }

  if (cleanPath === '/content/customer-logos') {
    return [
      { id: 'logo-1', name: 'PT Perkebunan Nusantara' },
      { id: 'logo-2', name: 'PT Maritim Warna' },
      { id: 'logo-3', name: 'Coating Solutions Co.' },
    ];
  }

  if (cleanPath === '/admin/customers') {
    const customers = getStorage<Customer[]>(STORAGE_KEYS.CUSTOMERS, MOCK_CUSTOMERS);
    return customers;
  }

  if (cleanPath === '/admin/users') {
    const users = getStorage<AdminUser[]>(STORAGE_KEYS.ADMIN_USERS, MOCK_ADMIN_USERS);
    if (method === 'GET') return users;
    if (method === 'POST') {
      const user: AdminUser = {
        id: 'u-' + Date.now(),
        name: body.name,
        email: body.email,
        role: body.role || 'admin',
        active: true,
        permissions: body.permissions || ['orders', 'payments'],
        createdAt: new Date().toISOString().split('T')[0] || '2026-08-20',
      };
      users.push(user);
      setStorage(STORAGE_KEYS.ADMIN_USERS, users);
      return user;
    }
  }

  if (cleanPath === '/admin/whistleblowing' || cleanPath === '/wbs/reports') {
    const reports = getStorage<WbsReport[]>(STORAGE_KEYS.WBS, MOCK_WBS_REPORTS);
    if (method === 'GET') return reports;
    if (method === 'POST') {
      const code = 'WBS-' + new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + Math.floor(100 + Math.random() * 900);
      const rep: WbsReport = {
        id: 'wbs-' + Date.now(),
        code,
        subject: body.subject || 'Laporan Pengaduan',
        date: new Date().toISOString().split('T')[0] || '2026-08-20',
        status: 'new',
        anonymous: Boolean(body.anonymous),
      };
      reports.unshift(rep);
      setStorage(STORAGE_KEYS.WBS, reports);
      saveWbsReportToDb(rep).catch(() => {});
      return { code, report: rep };
    }
  }

  if (cleanPath.startsWith('/content/blocks/') || cleanPath.startsWith('/admin/blocks/')) {
    const key = cleanPath.split('/').pop() || '';
    const blocks = getStorage<Record<string, any>>(STORAGE_KEYS.BLOCKS, {});
    if (method === 'GET') {
      return { key, data: blocks[key] || {} };
    }
    if (method === 'PUT') {
      blocks[key] = body.data || body;
      setStorage(STORAGE_KEYS.BLOCKS, blocks);
      return { key, data: blocks[key] };
    }
  }

  if (cleanPath === '/navigation/doc-links' || cleanPath === '/admin/navigation/doc-links') {
    return [
      {
        id: 'wbs',
        title: 'Whistle Blowing System',
        description: 'Kanal pelaporan resmi PT IKN',
        targetUrl: '/storage/wbs-dokumen.pdf',
        parentCategory: 'Keberlanjutan',
        active: true,
      },
      {
        id: 'smap',
        title: 'Sertifikasi ISO 37001',
        description: 'Sistem Manajemen Anti Penyuapan',
        targetUrl: '/storage/iso-37001.pdf',
        parentCategory: 'Keberlanjutan',
        active: true,
      },
    ];
  }

  // Default fallback
  return { ok: true };
}
