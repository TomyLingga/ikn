-- ============================================================================
-- SKEMA DATABASE SUPABASE UNTUK PT INDUSTRI KARET NUSANTARA (IKN)
-- ============================================================================
-- Salin dan jalankan seluruh isi file ini di SQL Editor dashboard Supabase Anda.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL KATEGORI PRODUK
CREATE TABLE IF NOT EXISTS public.categories (
    slug TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    "desc" TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABEL PRODUK
CREATE TABLE IF NOT EXISTS public.products (
    slug TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    name_en TEXT,
    category TEXT REFERENCES public.categories(slug) ON UPDATE CASCADE ON DELETE SET NULL,
    kind TEXT NOT NULL,
    aliases JSONB DEFAULT '[]'::jsonb,
    price_mode TEXT DEFAULT 'fixed',
    price NUMERIC,
    unit TEXT DEFAULT 'pcs',
    moq INTEGER DEFAULT 1,
    stock INTEGER DEFAULT 100,
    stock_status TEXT DEFAULT 'in_stock',
    image TEXT NOT NULL,
    rating NUMERIC DEFAULT 5.0,
    review_count INTEGER DEFAULT 0,
    summary TEXT,
    summary_en TEXT,
    highlights JSONB DEFAULT '[]'::jsonb,
    specs JSONB DEFAULT '[]'::jsonb,
    applications JSONB DEFAULT '[]'::jsonb,
    solubility JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL ULASAN PRODUK
CREATE TABLE IF NOT EXISTS public.reviews (
    id TEXT PRIMARY KEY,
    product_slug TEXT REFERENCES public.products(slug) ON DELETE CASCADE,
    customer TEXT NOT NULL,
    rating INTEGER DEFAULT 5,
    date DATE DEFAULT CURRENT_DATE,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL PESANAN & TRANSAKSI
CREATE TABLE IF NOT EXISTS public.orders (
    number TEXT PRIMARY KEY,
    date TIMESTAMPTZ DEFAULT NOW(),
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_pic TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC NOT NULL DEFAULT 0,
    shipping NUMERIC NOT NULL DEFAULT 0,
    admin_fee NUMERIC NOT NULL DEFAULT 0,
    total NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'awaiting_payment',
    payment TEXT NOT NULL DEFAULT 'unpaid',
    bank TEXT,
    bank_info JSONB,
    shipping_method TEXT,
    address JSONB NOT NULL,
    tracking_no TEXT,
    note TEXT,
    reject_reason TEXT,
    proof_uploaded BOOLEAN DEFAULT FALSE,
    proof JSONB,
    reviewed BOOLEAN DEFAULT FALSE,
    due_at TIMESTAMPTZ,
    timeline JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL PROFIL CUSTOMER & ALAMAT
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    customer_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    company TEXT,
    position TEXT,
    company_email TEXT,
    company_phone TEXT,
    tax_id TEXT,
    addresses JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TABEL KONFIGURASI COMMERCE
CREATE TABLE IF NOT EXISTS public.commerce_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABEL BERITA & ARTIKEL
CREATE TABLE IF NOT EXISTS public.news (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    title_en TEXT,
    date TEXT,
    tag TEXT DEFAULT 'Berita',
    thumb TEXT,
    excerpt TEXT,
    excerpt_en TEXT,
    body TEXT,
    body_en TEXT,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABEL GALERI
CREATE TABLE IF NOT EXISTS public.gallery (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT DEFAULT 'image',
    src TEXT NOT NULL,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABEL SERTIFIKAT
CREATE TABLE IF NOT EXISTS public.certificates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    material TEXT,
    "desc" TEXT,
    file TEXT,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABEL BROSUR / UNDUHAN
CREATE TABLE IF NOT EXISTS public.brochures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file TEXT,
    size TEXT,
    published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABEL PELANGGAN (ADMIN VIEW)
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    pic TEXT,
    phone TEXT,
    company TEXT,
    orders INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    joined DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TABEL PENGGUNA ADMIN
CREATE TABLE IF NOT EXISTS public.admin_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT DEFAULT 'admin',
    active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '["orders", "payments"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. TABEL WBS / PENGADUAN
CREATE TABLE IF NOT EXISTS public.wbs_reports (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'new',
    anonymous BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Mengaktifkan RLS dengan kebijakan publik untuk mempermudah koneksi frontend.

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commerce_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brochures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wbs_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Categories
    DROP POLICY IF EXISTS "Public categories read" ON public.categories;
    CREATE POLICY "Public categories read" ON public.categories FOR ALL USING (true) WITH CHECK (true);

    -- Products
    DROP POLICY IF EXISTS "Public products read" ON public.products;
    CREATE POLICY "Public products read" ON public.products FOR ALL USING (true) WITH CHECK (true);

    -- Reviews
    DROP POLICY IF EXISTS "Public reviews read" ON public.reviews;
    CREATE POLICY "Public reviews read" ON public.reviews FOR ALL USING (true) WITH CHECK (true);

    -- Orders
    DROP POLICY IF EXISTS "Public orders read" ON public.orders;
    CREATE POLICY "Public orders read" ON public.orders FOR ALL USING (true) WITH CHECK (true);

    -- Customer profiles
    DROP POLICY IF EXISTS "Public profiles read" ON public.customer_profiles;
    CREATE POLICY "Public profiles read" ON public.customer_profiles FOR ALL USING (true) WITH CHECK (true);

    -- Commerce config
    DROP POLICY IF EXISTS "Public config read" ON public.commerce_config;
    CREATE POLICY "Public config read" ON public.commerce_config FOR ALL USING (true) WITH CHECK (true);

    -- News
    DROP POLICY IF EXISTS "Public news read" ON public.news;
    CREATE POLICY "Public news read" ON public.news FOR ALL USING (true) WITH CHECK (true);

    -- Gallery
    DROP POLICY IF EXISTS "Public gallery read" ON public.gallery;
    CREATE POLICY "Public gallery read" ON public.gallery FOR ALL USING (true) WITH CHECK (true);

    -- Certificates
    DROP POLICY IF EXISTS "Public certs read" ON public.certificates;
    CREATE POLICY "Public certs read" ON public.certificates FOR ALL USING (true) WITH CHECK (true);

    -- Brochures
    DROP POLICY IF EXISTS "Public brochures read" ON public.brochures;
    CREATE POLICY "Public brochures read" ON public.brochures FOR ALL USING (true) WITH CHECK (true);

    -- Customers
    DROP POLICY IF EXISTS "Public customers read" ON public.customers;
    CREATE POLICY "Public customers read" ON public.customers FOR ALL USING (true) WITH CHECK (true);

    -- Admin Users
    DROP POLICY IF EXISTS "Public admin users read" ON public.admin_users;
    CREATE POLICY "Public admin users read" ON public.admin_users FOR ALL USING (true) WITH CHECK (true);

    -- WBS Reports
    DROP POLICY IF EXISTS "Public wbs read" ON public.wbs_reports;
    CREATE POLICY "Public wbs read" ON public.wbs_reports FOR ALL USING (true) WITH CHECK (true);
END $$;

-- ============================================================================
-- SEED DATA AWAL (INITIAL MASTER DATA)
-- ============================================================================

-- Kategori
INSERT INTO public.categories (slug, name, name_en, "desc") VALUES
('rubber-articles', 'Barang Karet', 'Rubber Articles', 'Komponen dan perlengkapan karet industri untuk berbagai sektor perkebunan dan pabrik.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.categories (slug, name, name_en, "desc") VALUES
('resiprene', 'Resiprene', 'Resiprene', 'Cyclised natural rubber untuk protective coating & marine paint.')
ON CONFLICT (slug) DO NOTHING;

-- Produk 1: Sarung Egrek
INSERT INTO public.products (
    slug, code, name, name_en, category, kind, aliases, price_mode, price, unit, moq, stock, stock_status,
    image, rating, review_count, summary, summary_en, highlights, specs, applications, solubility
) VALUES (
    'sarung-egrek',
    'IKN-PRD-001',
    'Sarung Egrek',
    'Rubber Palm Sickle Cover',
    'rubber-articles',
    'Rubber Articles',
    '["sarung egrek", "sarung pisau egrek", "sarung egrek sawit", "egrek", "cover egrek"]'::jsonb,
    'fixed',
    125000,
    'pcs',
    1,
    500,
    'in_stock',
    '/img/sarung-egrek.png',
    5.0,
    1,
    'Sarung pelindung pisau egrek kelapa sawit berbahan karet alam berkualitas tinggi untuk keselamatan kerja panen dan perlindungan mata pisau.',
    'Protective palm sickle cover made of high-grade natural rubber for harvesting safety and blade longevity.',
    '["Karet alam tebal & elastis", "Pengait pengunci presisi & aman", "Tahan benturan & sayatan pisau"]'::jsonb,
    '[["Material", "Karet Alam Tebal"], ["Fungsi", "Pelindung Pisau Egrek Sawit"], ["Sistem Kancing", "Klip Karet Fleksibel"], ["Aplikasi", "Perkebunan Kelapa Sawit"]]'::jsonb,
    '["Perkebunan Kelapa Sawit", "Keamanan Kerja Panen", "Perlindungan Alat Perkebunan"]'::jsonb,
    '[]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock;

-- Produk 2: Sepatu Boots
INSERT INTO public.products (
    slug, code, name, name_en, category, kind, aliases, price_mode, price, unit, moq, stock, stock_status,
    image, rating, review_count, summary, summary_en, highlights, specs, applications, solubility
) VALUES (
    'sepatu-boots',
    'IKN-PRD-002',
    'Sepatu Boots',
    'Industrial Rubber Boots',
    'rubber-articles',
    'Rubber Articles',
    '["sepatu boots", "boots karet", "sepatu boots industri", "sepatu perkebunan", "boots ptpn", "rubin boots"]'::jsonb,
    'fixed',
    170000,
    'pcs',
    1,
    350,
    'in_stock',
    '/img/sepatu-boots.png',
    5.0,
    1,
    'Sepatu boots karet industri dan perkebunan standar mutu tinggi dengan logo Rubin PTPN. Tahan air, anti-slip, fleksibel, dan kuat di medan berat.',
    'High-standard industrial and plantation rubber boots branded Rubin PTPN. Waterproof, anti-slip, flexible, and built for heavy-duty field work.',
    '["Sol anti-slip berdaya cengkeram kuat", "Tahan air & tahan lumpur", "Nyaman digunakan seharian", "Standar resmi Rubin & PTPN"]'::jsonb,
    '[["Material", "100% Karet Alam / Lateks"], ["Tinggi", "Tinggi Betis Standar Industri"], ["Fitur Sol", "Deep Tread Anti-Slip"], ["Standar", "Perkebunan & Industri"]]'::jsonb,
    '["Perkebunan Kelapa Sawit & Karet", "Pabrik & Manufaktur Industri", "Pertanian & Konstruksi"]'::jsonb,
    '[]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock;

-- Produk 3: Resiprene 35
INSERT INTO public.products (
    slug, code, name, name_en, category, kind, aliases, price_mode, price, unit, moq, stock, stock_status,
    image, rating, review_count, summary, summary_en, highlights, specs, applications, solubility
) VALUES (
    'resiprene-35',
    'RSP-35',
    'Resiprene 35',
    'Resiprene 35',
    'resiprene',
    'Cyclised Natural Rubber',
    '["resiprine", "respirine", "resiprene 35", "karet siklis", "cyclised rubber"]'::jsonb,
    'fixed',
    185000,
    'kg',
    25,
    1200,
    'in_stock',
    '/img/resiprene-35.jpg',
    4.5,
    2,
    'Karet alam tersiklisasi dalam bentuk padatan/serpihan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, dan cat marine.',
    'Cyclised natural rubber in amber crystal solid/flake form with excellent solubility in odourless solvents. A key material for protective coatings, maintenance coatings, and marine paints.',
    '["Cepat kering", "Sangat tahan air", "Tahan kimia (alkali & asam)", "Adhesi baik ke beragam substrat"]'::jsonb,
    '[["Bentuk", "Padatan / Serpihan Amber"], ["Softening Point", "125–145 °C"], ["Viscosity", "18–24 detik (DIN 53211)"], ["Color", "11–13 Lovibond"], ["Acid Value", "Maks. 5 mg KOH/g"], ["Density", "0,88–0,98 g/ml"], ["Appearance", "Clear"]]'::jsonb,
    '["Protective coatings", "Cat kapal / anti-fouling", "Concrete coating (baru & lapuk)", "Odor-free finishing"]'::jsonb,
    '[["White spirit", "Sempurna"], ["Petroleum Solvent 100–140°C", "Sempurna"], ["Aromatic Oil", "Sempurna"]]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    price = EXCLUDED.price,
    stock = EXCLUDED.stock;

-- Ulasan
INSERT INTO public.reviews (id, product_slug, customer, rating, body, date) VALUES
('rv-egr-1', 'sarung-egrek', 'PT Sawit Mandiri Perdana', 5, 'Karet sangat tebal dan pas di bilah egrek. Mengurangi risiko kecelakaan kerja panen.', '2026-06-15'),
('rv-bts-1', 'sepatu-boots', 'Koperasi Kebun Nusantara', 5, 'Sangat nyaman dan sol anti-slip sangat membantu di perkebunan berlumpur.', '2026-06-20'),
('rv1', 'resiprene-35', 'Coating Solutions Co.', 5, 'Konsisten antar batch, cepat kering. Cocok untuk formulasi cat marine kami.', '2026-05-12'),
('rv2', 'resiprene-35', 'PT Maritim Warna', 4, 'Kualitas bagus dan pengiriman tepat waktu. Dokumentasi teknis lengkap.', '2026-04-02')
ON CONFLICT (id) DO NOTHING;

-- Commerce Config
INSERT INTO public.commerce_config (key, value) VALUES (
    'main',
    '{
        "bankAccounts": [
            {"id": "bca", "bank": "Bank BCA", "number": "0123456789", "holder": "PT Industri Karet Nusantara", "active": true},
            {"id": "mandiri", "bank": "Bank Mandiri", "number": "1060099887766", "holder": "PT Industri Karet Nusantara", "active": true},
            {"id": "bni", "bank": "Bank BNI", "number": "0987654321", "holder": "PT Industri Karet Nusantara", "active": true}
        ],
        "shippingMethods": [
            {"id": "ship-medan", "label": "Reguler Medan (1–2 hari)", "amount": 25000},
            {"id": "ship-sumut", "label": "Reguler Sumatera Utara (2–4 hari)", "amount": 55000},
            {"id": "ship-luar", "label": "Kargo luar Sumatera (4–9 hari)", "amount": 150000}
        ],
        "additionalFees": [
            {"id": "admin-fee", "label": "Biaya administrasi", "type": "admin", "amount": 5000, "active": true}
        ],
        "paymentDueHours": 24
    }'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Profil Customer Awal
INSERT INTO public.customer_profiles (
    customer_id, name, email, phone, company, position, company_email, company_phone, tax_id, addresses
) VALUES (
    'c1',
    'Budi Santoso',
    'buyer@coatingsolutions.co.id',
    '081234567890',
    'Coating Solutions Co.',
    'Procurement Manager',
    'procurement@coatingsolutions.co.id',
    '021-5550123',
    '01.234.567.8-901.000',
    '[
        {
            "id": "addr-1",
            "label": "Gudang Utama Jakarta",
            "recipient": "Budi Santoso / Gudang",
            "phone": "081234567890",
            "line": "Jl. Industri Raya No. 45, Kawasan Industri Pulogadung, Jakarta Timur 13920",
            "primary": true
        },
        {
            "id": "addr-2",
            "label": "Pabrik Cikarang",
            "recipient": "Joko Widodo (Staff Logistik)",
            "phone": "081298765432",
            "line": "Kawasan Industri GIIC Blok AB No. 12, Cikarang Pusat, Bekasi 17530",
            "primary": false
        }
    ]'::jsonb
) ON CONFLICT (customer_id) DO NOTHING;

-- Initial Order
INSERT INTO public.orders (
    number, date, customer_id, customer_name, customer_email, customer_pic,
    items, subtotal, shipping, admin_fee, total, status, payment, bank, bank_info,
    shipping_method, address, tracking_no, proof_uploaded, proof, reviewed, due_at, timeline
) VALUES (
    'IKN-20260815-00042',
    '2026-08-15T09:24:00Z',
    'c1',
    'Coating Solutions Co.',
    'buyer@coatingsolutions.co.id',
    'Budi Santoso',
    '[{"slug": "resiprene-35", "name": "Resiprene 35", "code": "RSP-35", "qty": 100, "unit": "kg", "price": 185000}]'::jsonb,
    18500000,
    150000,
    5000,
    18655000,
    'processing',
    'paid',
    'Bank BCA',
    '{"bank": "Bank BCA", "number": "0123456789", "holder": "PT Industri Karet Nusantara"}'::jsonb,
    'Kargo luar Sumatera (4–9 hari)',
    '{"label": "Gudang Utama Jakarta", "recipient": "Budi Santoso / Gudang", "phone": "081234567890", "line": "Jl. Industri Raya No. 45, Kawasan Industri Pulogadung, Jakarta Timur 13920"}'::jsonb,
    'IKN-EXP-889912',
    true,
    '{"id": "prf-1", "originalName": "bukti_transfer_bca.jpg", "mime": "image/jpeg", "size": 245000, "status": "accepted", "uploadedAt": "2026-08-15T10:15:00Z", "rejectReason": null}'::jsonb,
    false,
    '2026-08-16T09:24:00Z',
    '[{"status": "awaiting_payment", "at": "2026-08-15T09:24:00Z"}, {"status": "awaiting_verification", "at": "2026-08-15T10:15:00Z"}, {"status": "processing", "at": "2026-08-15T11:00:00Z"}]'::jsonb
) ON CONFLICT (number) DO NOTHING;

-- Berita
INSERT INTO public.news (slug, title, date, tag, thumb, excerpt, published) VALUES
('resiprene-pasar-ekspor', 'Resiprene 35 menembus pasar cat marine ekspor', '18.06.2026', 'Produk', '/img/produksi-karet-1.webp', 'Permintaan karet siklis untuk cat pelindung kapal terus tumbuh. IKN memperkuat kapasitas produksi Resiprene 35 untuk memenuhi order ekspor.', true),
('nilai-akhlak-sdm', 'Penguatan budaya AKHLAK di lingkungan kerja', '02.05.2026', 'Perusahaan', '/img/pabrik-2-1.png', 'Program pengembangan SDM berlandaskan nilai Amanah, Kompeten, Harmonis, Loyal, Adaptif, dan Kolaboratif digelar sepanjang tahun.', true),
('kemitraan-hilir-karet', 'IKN perkuat kemitraan hilir karet Sumatera Utara', '14.03.2026', 'Kemitraan', '/img/karet-1-1-scaled.jpg', 'Sebagai anak perusahaan PTPN III, IKN membangun kolaborasi rantai pasok karet alam yang saling menguntungkan dengan mitra lokal.', true)
ON CONFLICT (slug) DO NOTHING;

-- Galeri
INSERT INTO public.gallery (id, title, type, src, published) VALUES
('g1', 'Fasilitas Produksi Pabrik Resiprene', 'image', '/img/home.png', true),
('g2', 'Pengolahan Karet Alam', 'image', '/img/karet-1-1-scaled.jpg', true),
('g3', 'Kompleks Pabrik Hilir', 'image', '/img/pabrik-2-1.png', true),
('g4', 'Aktivitas Pemotongan Slab Karet', 'image', '/img/produksi-karet-1.webp', true)
ON CONFLICT (id) DO NOTHING;

-- Sertifikat
INSERT INTO public.certificates (id, name, material, "desc", file, published) VALUES
('c1', 'ISO 37001:2016', 'Sistem Manajemen Anti Penyuapan (SMAP)', 'Sertifikasi kepatuhan anti-penyuapan berstandar internasional.', '/storage/iso-37001.pdf', true),
('c2', 'REACH Compliance', 'European Chemicals Agency (ECHA)', 'Kepatuhan ekspor bahan kimia dan polimer ke Uni Eropa.', '/storage/reach-compliance.pdf', true)
ON CONFLICT (id) DO NOTHING;

-- Brosur
INSERT INTO public.brochures (id, title, file, size, published) VALUES
('b1', 'Brosur Produk Resiprene 35 (Spesifikasi & Solubilitas)', '/storage/brosur-resiprene-35.pdf', '2.4 MB', true),
('b2', 'Katalog Barang Karet & Komponen Industri', '/storage/katalog-barang-karet.pdf', '3.1 MB', true)
ON CONFLICT (id) DO NOTHING;

-- Admin Users
INSERT INTO public.admin_users (id, name, email, role, active, permissions) VALUES
('u1', 'Super Admin IKN', 'superadmin@ptikn.com', 'super_admin', true, '["*"]'::jsonb),
('u2', 'Admin Penjualan', 'sales.admin@ptikn.com', 'admin', true, '["orders", "payments", "products", "customers", "reports"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Customers (Admin View)
INSERT INTO public.customers (id, name, email, pic, phone, company, orders, status, joined) VALUES
('c1', 'Coating Solutions Co.', 'buyer@coatingsolutions.co.id', 'Budi Santoso', '081234567890', 'Coating Solutions Co.', 2, 'active', '2026-01-10'),
('c2', 'PT Maritim Warna Cat', 'purchasing@maritimwarna.co.id', 'Hendro Wijaya', '08119876543', 'PT Maritim Warna Cat', 5, 'active', '2026-02-14')
ON CONFLICT (id) DO NOTHING;
