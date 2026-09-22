import { getSupabase } from '@/lib/supabase';
import type {
  Product,
  Category,
  Order,
  CustomerProfile,
  NewsItem,
  GalleryItem,
  Certificate,
  Brochure,
  Customer,
  AdminUser,
  WbsReport,
  Review,
  OrderStatusKey,
} from '@/lib/types';
import type { CommerceConfig } from '@/lib/server-data';
import {
  MOCK_PRODUCTS,
  MOCK_CATEGORIES,
  MOCK_COMMERCE_CONFIG,
  MOCK_INITIAL_ORDERS,
  MOCK_BUYER_PROFILE,
  MOCK_NEWS,
  MOCK_GALLERY,
  MOCK_CERTIFICATES,
  MOCK_BROCHURES,
  MOCK_CUSTOMERS,
  MOCK_ADMIN_USERS,
  MOCK_WBS_REPORTS,
  MOCK_REVIEWS,
} from '@/lib/mock-data';

// ============================================================================
// SUPABASE DATA SERVICE LAYER
// ============================================================================

// ----------------------------------------------------------------------------
// PRODUCTS & CATEGORIES
// ----------------------------------------------------------------------------

export async function fetchCategoriesFromDb(): Promise<Category[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_CATEGORIES;

  try {
    const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
    if (error || !data || data.length === 0) return MOCK_CATEGORIES;
    return data.map((c) => ({
      slug: c.slug,
      name: c.name,
      nameEn: c.name_en || c.name,
      desc: c.desc || '',
    }));
  } catch {
    return MOCK_CATEGORIES;
  }
}

export async function saveCategoryToDb(category: Category): Promise<Category> {
  const supabase = getSupabase();
  if (!supabase) return category;

  try {
    await supabase.from('categories').upsert({
      slug: category.slug,
      name: category.name,
      name_en: category.nameEn,
      desc: category.desc,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving category to Supabase:', err);
  }
  return category;
}

export async function fetchProductsFromDb(params: { q?: string; category?: string } = {}): Promise<Product[]> {
  const supabase = getSupabase();
  if (!supabase) {
    let list = [...MOCK_PRODUCTS];
    if (params.category && params.category !== 'all') {
      list = list.filter((p) => p.category === params.category);
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      list = list.filter((p) =>
        [p.name, p.nameEn, p.code, p.kind, ...(p.aliases || [])].join(' ').toLowerCase().includes(q)
      );
    }
    return list;
  }

  try {
    let query = supabase.from('products').select('*');
    if (params.category && params.category !== 'all') {
      query = query.eq('category', params.category);
    }
    if (params.q) {
      query = query.or(`name.ilike.%${params.q}%,code.ilike.%${params.q}%,kind.ilike.%${params.q}%`);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      // Jika tabel masih kosong di Supabase, gunakan mock
      return MOCK_PRODUCTS;
    }

    return data.map((p) => ({
      slug: p.slug,
      code: p.code,
      name: p.name,
      nameEn: p.name_en || p.name,
      category: p.category,
      kind: p.kind,
      aliases: p.aliases || [],
      priceMode: p.price_mode || 'fixed',
      price: p.price,
      unit: p.unit || 'pcs',
      moq: p.moq || 1,
      stock: p.stock || 100,
      stockStatus: p.stock_status || 'in_stock',
      image: p.image || '/img/sarung-egrek.png',
      rating: p.rating || 5.0,
      reviewCount: p.review_count || 0,
      summary: p.summary || '',
      summaryEn: p.summary_en || '',
      highlights: p.highlights || [],
      specs: p.specs || [],
      applications: p.applications || [],
      solubility: p.solubility || [],
    }));
  } catch {
    return MOCK_PRODUCTS;
  }
}

export async function fetchProductDetailFromDb(slug: string): Promise<{ product: Product; reviews: Review[] } | null> {
  const supabase = getSupabase();
  if (!supabase) {
    const prod = MOCK_PRODUCTS.find((p) => p.slug === slug) || null;
    const reviews = MOCK_REVIEWS[slug] || [];
    return prod ? { product: prod, reviews } : null;
  }

  try {
    const { data: p, error } = await supabase.from('products').select('*').eq('slug', slug).single();
    if (error || !p) {
      const prod = MOCK_PRODUCTS.find((item) => item.slug === slug) || null;
      const reviews = MOCK_REVIEWS[slug] || [];
      return prod ? { product: prod, reviews } : null;
    }

    const { data: reviewData } = await supabase.from('reviews').select('*').eq('product_slug', slug);
    const reviews: Review[] = (reviewData || []).map((r) => ({
      id: r.id,
      product: r.product_slug,
      customer: r.customer,
      rating: r.rating,
      date: r.date || r.created_at,
      body: r.body,
    }));

    const product: Product = {
      slug: p.slug,
      code: p.code,
      name: p.name,
      nameEn: p.name_en || p.name,
      category: p.category,
      kind: p.kind,
      aliases: p.aliases || [],
      priceMode: p.price_mode || 'fixed',
      price: p.price,
      unit: p.unit || 'pcs',
      moq: p.moq || 1,
      stock: p.stock || 100,
      stockStatus: p.stock_status || 'in_stock',
      image: p.image || '/img/sarung-egrek.png',
      rating: p.rating || 5.0,
      reviewCount: reviews.length || p.review_count || 0,
      summary: p.summary || '',
      summaryEn: p.summary_en || '',
      highlights: p.highlights || [],
      specs: p.specs || [],
      applications: p.applications || [],
      solubility: p.solubility || [],
    };

    return { product, reviews: reviews.length > 0 ? reviews : (MOCK_REVIEWS[slug] || []) };
  } catch {
    const prod = MOCK_PRODUCTS.find((item) => item.slug === slug) || null;
    const reviews = MOCK_REVIEWS[slug] || [];
    return prod ? { product: prod, reviews } : null;
  }
}

export async function saveProductToDb(product: Product): Promise<Product> {
  const supabase = getSupabase();
  if (!supabase) return product;

  try {
    await supabase.from('products').upsert({
      slug: product.slug,
      code: product.code,
      name: product.name,
      name_en: product.nameEn,
      category: product.category,
      kind: product.kind,
      aliases: product.aliases,
      price_mode: product.priceMode,
      price: product.price,
      unit: product.unit,
      moq: product.moq,
      stock: product.stock,
      stock_status: product.stockStatus,
      image: product.image,
      rating: product.rating,
      review_count: product.reviewCount,
      summary: product.summary,
      summary_en: product.summaryEn,
      highlights: product.highlights,
      specs: product.specs,
      applications: product.applications,
      solubility: product.solubility,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving product to Supabase:', err);
  }
  return product;
}

export async function deleteProductFromDb(slug: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return true;
  try {
    await supabase.from('products').delete().eq('slug', slug);
    return true;
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// ORDERS & TRANSACTIONS
// ----------------------------------------------------------------------------

export async function fetchOrdersFromDb(customerId?: string): Promise<Order[]> {
  const supabase = getSupabase();
  if (!supabase) {
    return MOCK_INITIAL_ORDERS;
  }

  try {
    let query = supabase.from('orders').select('*').order('date', { ascending: false });
    if (customerId) {
      query = query.eq('customer_id', customerId);
    }
    const { data, error } = await query;
    if (error || !data || data.length === 0) return MOCK_INITIAL_ORDERS;

    return data.map((o) => ({
      number: o.number,
      date: o.date || o.created_at,
      customer: {
        id: o.customer_id,
        name: o.customer_name,
        email: o.customer_email,
        pic: o.customer_pic,
      },
      items: o.items || [],
      subtotal: Number(o.subtotal) || 0,
      shipping: Number(o.shipping) || 0,
      adminFee: Number(o.admin_fee) || 0,
      total: Number(o.total) || 0,
      status: o.status as OrderStatusKey,
      payment: o.payment,
      bank: o.bank,
      bankInfo: o.bank_info,
      shippingMethod: o.shipping_method,
      address: o.address,
      trackingNo: o.tracking_no,
      note: o.note,
      rejectReason: o.reject_reason,
      proofUploaded: Boolean(o.proof_uploaded),
      proof: o.proof,
      reviewed: Boolean(o.reviewed),
      dueAt: o.due_at,
      timeline: o.timeline || [],
    }));
  } catch {
    return MOCK_INITIAL_ORDERS;
  }
}

export async function fetchOrderDetailFromDb(orderNumber: string): Promise<Order | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return MOCK_INITIAL_ORDERS.find((o) => o.number === orderNumber) || null;
  }

  try {
    const { data: o, error } = await supabase.from('orders').select('*').eq('number', orderNumber).single();
    if (error || !o) {
      return MOCK_INITIAL_ORDERS.find((item) => item.number === orderNumber) || null;
    }

    return {
      number: o.number,
      date: o.date || o.created_at,
      customer: {
        id: o.customer_id,
        name: o.customer_name,
        email: o.customer_email,
        pic: o.customer_pic,
      },
      items: o.items || [],
      subtotal: Number(o.subtotal) || 0,
      shipping: Number(o.shipping) || 0,
      adminFee: Number(o.admin_fee) || 0,
      total: Number(o.total) || 0,
      status: o.status as OrderStatusKey,
      payment: o.payment,
      bank: o.bank,
      bankInfo: o.bank_info,
      shippingMethod: o.shipping_method,
      address: o.address,
      trackingNo: o.tracking_no,
      note: o.note,
      rejectReason: o.reject_reason,
      proofUploaded: Boolean(o.proof_uploaded),
      proof: o.proof,
      reviewed: Boolean(o.reviewed),
      dueAt: o.due_at,
      timeline: o.timeline || [],
    };
  } catch {
    return MOCK_INITIAL_ORDERS.find((item) => item.number === orderNumber) || null;
  }
}

export async function saveOrderToDb(order: Order): Promise<Order> {
  const supabase = getSupabase();
  if (!supabase) return order;

  try {
    await supabase.from('orders').upsert({
      number: order.number,
      date: order.date,
      customer_id: order.customer.id,
      customer_name: order.customer.name,
      customer_email: order.customer.email,
      customer_pic: order.customer.pic,
      items: order.items,
      subtotal: order.subtotal,
      shipping: order.shipping,
      admin_fee: order.adminFee,
      total: order.total,
      status: order.status,
      payment: order.payment,
      bank: order.bank,
      bank_info: order.bankInfo,
      shipping_method: order.shippingMethod,
      address: order.address,
      tracking_no: order.trackingNo,
      note: order.note,
      reject_reason: order.rejectReason,
      proof_uploaded: order.proofUploaded,
      proof: order.proof,
      reviewed: order.reviewed,
      due_at: order.dueAt,
      timeline: order.timeline,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving order to Supabase:', err);
  }
  return order;
}

// ----------------------------------------------------------------------------
// CUSTOMER PROFILE & ADDRESSES
// ----------------------------------------------------------------------------

export async function fetchCustomerProfileFromDb(customerId: string): Promise<CustomerProfile> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_BUYER_PROFILE;

  try {
    const { data, error } = await supabase.from('customer_profiles').select('*').eq('customer_id', customerId).single();
    if (error || !data) return MOCK_BUYER_PROFILE;

    return {
      customerId: data.customer_id,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      company: data.company || '',
      position: data.position || '',
      companyEmail: data.company_email || '',
      companyPhone: data.company_phone || '',
      taxId: data.tax_id || '',
      addresses: data.addresses || [],
    };
  } catch {
    return MOCK_BUYER_PROFILE;
  }
}

export async function saveCustomerProfileToDb(profile: CustomerProfile): Promise<CustomerProfile> {
  const supabase = getSupabase();
  if (!supabase) return profile;

  try {
    await supabase.from('customer_profiles').upsert({
      customer_id: profile.customerId,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      company: profile.company,
      position: profile.position,
      company_email: profile.companyEmail,
      company_phone: profile.companyPhone,
      tax_id: profile.taxId,
      addresses: profile.addresses,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving customer profile to Supabase:', err);
  }
  return profile;
}

// ----------------------------------------------------------------------------
// COMMERCE CONFIG
// ----------------------------------------------------------------------------

export async function fetchCommerceConfigFromDb(): Promise<CommerceConfig> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_COMMERCE_CONFIG;

  try {
    const { data, error } = await supabase.from('commerce_config').select('*').eq('key', 'main').single();
    if (error || !data || !data.value) return MOCK_COMMERCE_CONFIG;
    return data.value as CommerceConfig;
  } catch {
    return MOCK_COMMERCE_CONFIG;
  }
}

export async function saveCommerceConfigToDb(config: CommerceConfig): Promise<CommerceConfig> {
  const supabase = getSupabase();
  if (!supabase) return config;

  try {
    await supabase.from('commerce_config').upsert({
      key: 'main',
      value: config,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving commerce config to Supabase:', err);
  }
  return config;
}

// ----------------------------------------------------------------------------
// CONTENT (NEWS, GALLERY, CERTIFICATES, BROCHURES, WBS, ADMIN USERS, CUSTOMERS)
// ----------------------------------------------------------------------------

export async function fetchNewsFromDb(): Promise<NewsItem[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_NEWS;

  try {
    const { data, error } = await supabase.from('news').select('*').order('date', { ascending: false });
    if (error || !data || data.length === 0) return MOCK_NEWS;
    return data.map((n) => ({
      slug: n.slug,
      title: n.title,
      date: n.date || n.created_at,
      tag: n.tag || 'Berita',
      thumb: n.thumb || '/img/produksi-karet-1.webp',
      excerpt: n.excerpt || '',
      published: Boolean(n.published),
    }));
  } catch {
    return MOCK_NEWS;
  }
}

export async function fetchGalleryFromDb(): Promise<GalleryItem[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_GALLERY;

  try {
    const { data, error } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) return MOCK_GALLERY;
    return data.map((g) => ({
      id: g.id,
      title: g.title,
      type: g.type || 'image',
      src: g.src,
      published: Boolean(g.published),
    }));
  } catch {
    return MOCK_GALLERY;
  }
}

export async function fetchCertificatesFromDb(): Promise<Certificate[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_CERTIFICATES;

  try {
    const { data, error } = await supabase.from('certificates').select('*');
    if (error || !data || data.length === 0) return MOCK_CERTIFICATES;
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      material: c.material || '',
      desc: c.desc || '',
      file: c.file || '',
      published: Boolean(c.published),
    }));
  } catch {
    return MOCK_CERTIFICATES;
  }
}

export async function fetchBrochuresFromDb(): Promise<Brochure[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_BROCHURES;

  try {
    const { data, error } = await supabase.from('brochures').select('*');
    if (error || !data || data.length === 0) return MOCK_BROCHURES;
    return data.map((b) => ({
      id: b.id,
      title: b.title,
      file: b.file || '',
      size: b.size || '',
      published: Boolean(b.published),
    }));
  } catch {
    return MOCK_BROCHURES;
  }
}

export async function fetchCustomersFromDb(): Promise<Customer[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_CUSTOMERS;

  try {
    const { data, error } = await supabase.from('customers').select('*');
    if (error || !data || data.length === 0) return MOCK_CUSTOMERS;
    return data.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      pic: c.pic || c.name,
      phone: c.phone || '',
      company: c.company || '',
      orders: Number(c.orders) || 0,
      status: c.status || 'active',
      joined: c.joined || c.created_at,
    }));
  } catch {
    return MOCK_CUSTOMERS;
  }
}

export async function fetchAdminUsersFromDb(): Promise<AdminUser[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_ADMIN_USERS;

  try {
    const { data, error } = await supabase.from('admin_users').select('*');
    if (error || !data || data.length === 0) return MOCK_ADMIN_USERS;
    return data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'admin',
      active: Boolean(u.active),
      permissions: u.permissions || ['orders', 'payments'],
      createdAt: u.created_at,
    }));
  } catch {
    return MOCK_ADMIN_USERS;
  }
}

export async function fetchWbsReportsFromDb(): Promise<WbsReport[]> {
  const supabase = getSupabase();
  if (!supabase) return MOCK_WBS_REPORTS;

  try {
    const { data, error } = await supabase.from('wbs_reports').select('*').order('created_at', { ascending: false });
    if (error || !data || data.length === 0) return MOCK_WBS_REPORTS;
    return data.map((w) => ({
      id: w.id,
      code: w.code,
      subject: w.subject,
      date: w.date || w.created_at,
      status: w.status || 'new',
      anonymous: Boolean(w.anonymous),
    }));
  } catch {
    return MOCK_WBS_REPORTS;
  }
}

export async function saveWbsReportToDb(report: WbsReport): Promise<WbsReport> {
  const supabase = getSupabase();
  if (!supabase) return report;

  try {
    await supabase.from('wbs_reports').insert({
      id: report.id,
      code: report.code,
      subject: report.subject,
      date: report.date,
      status: report.status,
      anonymous: report.anonymous,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error saving WBS report to Supabase:', err);
  }
  return report;
}
