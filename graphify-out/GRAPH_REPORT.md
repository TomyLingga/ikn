# Graph Report - IKN  (2026-09-19)

## Corpus Check
- 183 files · ~303,960 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 886 nodes · 2257 edges · 72 communities (57 shown, 7 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 107 edges (avg confidence: 0.85)
- Token cost: 582,250 input · 0 output

## Community Hubs (Navigation)
- Admin API & Order Pages
- Shared React UI Components
- E-Commerce User Flow (PDF)
- Package Dependencies & Auth Layout
- Mock API & Data Models
- Supabase Data Service
- Admin CRUD Pages & DataTable
- Checkout & Customer Transactions
- Public Content Pages
- Root Layout & Context Providers
- Domain Types & Status Badge
- Product Catalog & Cart UI
- i18n, Navbar & Footer
- TypeScript Config
- Customer Dashboard Shell & Guards
- Admin Customers, Media & Login
- Catalog Pages & Product Fetching
- Company Profile Content
- Admin Order & Payment Actions
- Factory Aerial Photo
- Payment Management Mockup
- Admin Product Manager
- Home Page Hero & Marquee
- Admin Fees & Shipping Handlers
- Server Data & Mock Content
- Customer Addresses
- Admin Users & Whistleblowing Forms
- Head Office Hero Photo
- Rubber Production Photo
- Admin Company History
- Admin Navigation Editor
- Video Gallery
- Admin Sales Chart
- Rubber Tapping Photo
- Admin Brochures
- Admin Certificates
- Admin Contact Editor
- Admin News
- Customer Profile Form
- Sarung Egrek Product Photo
- Admin Bank Accounts
- Admin Gallery
- Admin Navigation Hierarchy
- Admin Users
- Admin Vision & Mission
- Customer Company Form
- Site Layout & Page Transition
- Product Manager Handlers
- Cart Context & Product Types
- Resiprene 35 Product Photo
- Rubber Boots Product Photo
- RUBIN Logo (Images)
- Additional Fees Page Types
- Admin Product Categories
- RUBIN Logo (Frontend)
- Admin Gallery Page Types
- News Detail Page
- Admin Page Component Props
- Admin Orders Page Route
- Customer Dashboard Route
- Customer Orders Route
- Next.js Config
- Mock API Error
- Next.js Env Types

## God Nodes (most connected - your core abstractions)
1. `errorMessage()` - 114 edges
2. `api()` - 94 edges
3. `react` - 58 edges
4. `Icon()` - 50 edges
5. `useLang()` - 45 edges
6. `formatIDR()` - 35 edges
7. `useAuth()` - 31 edges
8. `formatDate()` - 27 edges
9. `getSupabase()` - 24 edges
10. `StatusBadge()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Produksi Karet 1 (ikn-fe public image)` --semantically_similar_to--> `Produksi Karet 1 (Images source asset)`  [INFERRED] [semantically similar]
  ikn-fe/public/img/produksi-karet-1.webp → Images/produksi-karet-1.webp
- `Produksi Karet 1 (ikn-fe public image)` --references--> `Branded Worker Uniform`  [AMBIGUOUS]
  ikn-fe/public/img/produksi-karet-1.webp → Images/produksi-karet-1.webp
- `Aerial Photo of PT IKN Factory Complex (pabrik-2-1, frontend public asset)` --references--> `Keselamatan Kerja (Occupational Safety) Wall Signage`  [AMBIGUOUS]
  ikn-fe/public/img/pabrik-2-1.png → Images/pabrik-2-1.png
- `Raw Material Origin Imagery` --rationale_for--> `Rubber Tapping Photo (ikn-fe/public/img/karet-1-1-scaled.jpg)`  [INFERRED]
  Images/karet-1-1-scaled.jpg → ikn-fe/public/img/karet-1-1-scaled.jpg
- `Produksi Karet 1 (ikn-fe public image)` --conceptually_related_to--> `Crumb Rubber (SIR) Production Process`  [INFERRED]
  ikn-fe/public/img/produksi-karet-1.webp → Images/produksi-karet-1.webp

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **E-Commerce customer purchase flow (browse -> order -> transfer -> upload proof -> confirm receipt)** — doc_user_flow_e_commerce_pengunjung_mengunjungi_website, doc_user_flow_e_commerce_melihat_katalog, doc_user_flow_e_commerce_pilih_produk, doc_user_flow_e_commerce_check_out_keranjang, doc_user_flow_e_commerce_isi_alamat_dan_pilih_pengiriman, doc_user_flow_e_commerce_order_dibuat, doc_user_flow_e_commerce_sistem_menampilkan_informasi_pembayaran, doc_user_flow_e_commerce_pelanggan_melakukan_transfer, doc_user_flow_e_commerce_upload_bukti_pembayaran, doc_user_flow_e_commerce_konfirmasi_barang_telah_diterima [EXTRACTED 1.00]
- **E-Commerce admin order fulfillment flow (notification -> verify -> paid/rejected -> ship -> complete)** — doc_user_flow_e_commerce_menerima_notifikasi_pesanan, doc_user_flow_e_commerce_verifikasi_pembayaran, doc_user_flow_e_commerce_pembayaran_valid, doc_user_flow_e_commerce_status_dibayar, doc_user_flow_e_commerce_proses_pesanan_packaging, doc_user_flow_e_commerce_status_ditolak, doc_user_flow_e_commerce_pelanggan_upload_ulang_bukti_pembayaran, doc_user_flow_e_commerce_barang_dikirim, doc_user_flow_e_commerce_pelanggan_menerima_barang, doc_user_flow_e_commerce_status_selesai [EXTRACTED 1.00]
- **Admin payment verification checklist (proof, amount, destination account, bank statement) feeding the Pembayaran valid? decision** — doc_user_flow_e_commerce_verifikasi_pembayaran, doc_user_flow_e_commerce_cek_bukti_transfer, doc_user_flow_e_commerce_cek_nominal, doc_user_flow_e_commerce_cek_rekening_tujuan, doc_user_flow_e_commerce_cek_mutasi_rekening, doc_user_flow_e_commerce_pembayaran_valid [EXTRACTED 1.00]
- **Crumb Rubber Slab Cutting Workflow** — images_produksi_karet_1_coagulated_natural_rubber, images_produksi_karet_1_slab_cutter_machine, images_produksi_karet_1_rubber_slab_cutting_stage, images_produksi_karet_1_crumb_rubber_drying_racks, images_produksi_karet_1_crumb_rubber_production_process [INFERRED 0.85]
- **Factory Worker Safety Scene** — images_produksi_karet_1_rubber_factory_workers, images_produksi_karet_1_personal_protective_equipment, images_produksi_karet_1_rubber_processing_factory_floor [EXTRACTED 1.00]
- **Factory Site Buildings and Infrastructure** — images_pabrik_2_1_pt_ikn_factory_complex, images_pabrik_2_1_blue_steel_production_building, images_pabrik_2_1_secondary_production_hall, images_pabrik_2_1_blue_roofed_canopy, images_pabrik_2_1_red_roofed_guard_post, images_pabrik_2_1_water_tower, images_pabrik_2_1_exhaust_stack, images_pabrik_2_1_landscaped_grounds_internal_road [EXTRACTED 1.00]
- **Website Facility Showcase Imagery** — images_pabrik_2_1, ikn_fe_public_img_pabrik_2_1, images_pabrik_2_1_aerial_drone_photography, images_pabrik_2_1_company_facility_showcase [INFERRED 0.85]
- **RUBIN Visual Identity** — ikn_fe_public_img_rubin_logo_blue_triangle_mark, ikn_fe_public_img_rubin_logo_rubin_wordmark, ikn_fe_public_img_rubin_logo_blue_brand_color, ikn_fe_public_img_rubin_logo_rubin_brand [EXTRACTED 1.00]
- **Corporate Hero Image Composition** — ikn_fe_public_img_home, images_kantor_direksi_pt_ikn_1_head_office_building, images_kantor_direksi_pt_ikn_1_company_signage, images_kantor_direksi_pt_ikn_1_desaturated_color_grade, images_kantor_direksi_pt_ikn_1_hero_image_usage [INFERRED 0.75]
- **RUBIN Visual Identity Lockup** — images_logo_removebg_preview_rubin_brand, images_logo_removebg_preview_blue_triangle_emblem, images_logo_removebg_preview_boxed_wordmark, images_logo_removebg_preview_brand_blue_color [INFERRED 0.85]
- **Rubber Egrek Sheath Product Offering** — ikn_fe_public_img_sarung_egrek_sarung_egrek, ikn_fe_public_img_sarung_egrek_egrek, ikn_fe_public_img_sarung_egrek_black_rubber_material, ikn_fe_public_img_sarung_egrek_blade_protection [INFERRED 0.85]
- **Payment Record Row (Invoice + Customer + Method + Status + Date)** — doc_modul_referensi_manajemen_pembayaran_invoice_number, doc_modul_referensi_manajemen_pembayaran_customer, doc_modul_referensi_manajemen_pembayaran_payment_method, doc_modul_referensi_manajemen_pembayaran_payment_status, doc_modul_referensi_manajemen_pembayaran_transaction_date [EXTRACTED 1.00]
- **Payment Status Enum (Paid / Pending / Expired / Failed)** — doc_modul_referensi_manajemen_pembayaran_status_paid, doc_modul_referensi_manajemen_pembayaran_status_pending, doc_modul_referensi_manajemen_pembayaran_status_expired, doc_modul_referensi_manajemen_pembayaran_status_failed [EXTRACTED 1.00]
- **Supported Payment Channels (QRIS / VA BCA / E-Wallet / Transfer)** — doc_modul_referensi_manajemen_pembayaran_qris, doc_modul_referensi_manajemen_pembayaran_va_bca, doc_modul_referensi_manajemen_pembayaran_e_wallet, doc_modul_referensi_manajemen_pembayaran_transfer [EXTRACTED 1.00]
- **Resiprene 35 Product Listing Visual** — ikn_fe_public_img_resiprene_35, ikn_fe_public_img_resiprene_35_resiprene_35, ikn_fe_public_img_resiprene_35_amber_granular_flakes, ikn_fe_public_img_resiprene_35_zip_lock_sample_bag [INFERRED 0.85]
- **Latex Tapping Flow: tree cut -> spout -> cup** — images_karet_1_1_scaled_rubber_tree, images_karet_1_1_scaled_tapping_spout, images_karet_1_1_scaled_natural_latex, images_karet_1_1_scaled_latex_collection_cup [EXTRACTED 1.00]
- **Rubber Tapping Photo Reused from Images Folder into Next.js Public Assets** — images_karet_1_1_scaled, ikn_fe_public_img_karet_1_1_scaled, images_karet_1_1_scaled_raw_material_origin_imagery [INFERRED 0.85]
- **IKN / PTPN Branded Rubber Boot Product** — ikn_fe_public_img_sepatu_boots_rubber_safety_boots, ikn_fe_public_img_sepatu_boots_ikn_logo, ikn_fe_public_img_sepatu_boots_perkebunan_nusantara_branding, ikn_fe_public_img_sepatu_boots_natural_rubber_material [INFERRED 0.85]

## Communities (72 total, 7 thin omitted)

### Community 0 - "Admin API & Order Pages"
Cohesion: 0.12
Nodes (27): CustomerDetail, CustomerRow, proofStatusLabels, AdminDashboard(), DashboardData, DashboardStats, ChartDataItem, CURRENT_YEAR (+19 more)

### Community 1 - "Shared React UI Components"
Cohesion: 0.09
Nodes (19): metadata, AuthMode, AdminShell(), groupsEn, groupsId, moduleByHref, NavGroup, NavItem (+11 more)

### Community 2 - "E-Commerce User Flow (PDF)"
Cohesion: 0.10
Nodes (33): User Flow E-Commerce (document), User Flow: E-Commerce - Admin, Barang dikirim (Status: Dikirim / Shipped), Bukti pembayaran (Payment proof / transfer receipt), Cek bukti transfer (Check transfer proof), Cek mutasi rekening (Check bank account statement), Cek nominal (Check transferred amount), Cek rekening tujuan (Check destination bank account) (+25 more)

### Community 3 - "Package Dependencies & Auth Layout"
Cohesion: 0.07
Nodes (25): metadata, dependencies, next, react, react-dom, @supabase/supabase-js, devDependencies, @types/node (+17 more)

### Community 4 - "Mock API & Data Models"
Cohesion: 0.12
Nodes (25): AdminAccount, AuthContext, AuthContextValue, CustomerAccount, MeResponse, RegisterPayload, getStorage(), STORAGE_KEYS (+17 more)

### Community 5 - "Supabase Data Service"
Cohesion: 0.15
Nodes (26): handleMockApi(), initMockStore(), setStorage(), getSupabase(), isSupabaseConfigured(), deleteProductFromDb(), fetchAdminUsersFromDb(), fetchBrochuresFromDb() (+18 more)

### Community 6 - "Admin CRUD Pages & DataTable"
Cohesion: 0.12
Nodes (20): BankAccountRow, BankForm, emptyForm, BrochureForm, BrochureRow, emptyForm, CertificateForm, CertificateRow (+12 more)

### Community 7 - "Checkout & Customer Transactions"
Cohesion: 0.16
Nodes (19): CheckoutPage(), useAuth(), CustomerDashboard(), CustomerOrderDetail(), onSubmitReview(), run(), CustomerOrders(), getOrderAction() (+11 more)

### Community 8 - "Public Content Pages"
Cohesion: 0.12
Nodes (16): Berita(), metadata, metadata, Pelanggan(), metadata, metadata, Sertifikat(), metadata (+8 more)

### Community 9 - "Root Layout & Context Providers"
Cohesion: 0.08
Nodes (14): archivo, dynamic, metadata, plexMono, AuthProvider(), logoutAdmin(), logoutCustomer(), CartProvider() (+6 more)

### Community 10 - "Domain Types & Status Badge"
Cohesion: 0.09
Nodes (23): StatusBadgeProps, AdminUser, BankAccount, CustomerDashboardStats, CustomerLogo, CustomerStatus, DashboardStat, FeeType (+15 more)

### Community 11 - "Product Catalog & Cart UI"
Cohesion: 0.14
Nodes (10): CartPage(), AddToCart(), CartButton(), useCart(), SortKey, EmptyState(), ProductCard(), StarRating() (+2 more)

### Community 12 - "i18n, Navbar & Footer"
Cohesion: 0.18
Nodes (13): Footer(), HeroActions(), HeroSubtitle(), HeroTitle(), LangToggle(), useLang(), Navbar(), languages (+5 more)

### Community 13 - "TypeScript Config"
Cohesion: 0.10
Nodes (20): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 14 - "Customer Dashboard Shell & Guards"
Cohesion: 0.12
Nodes (7): metadata, AccountNav(), CustomerCart(), CustomerShell(), pageTitle(), SessionLoaderProps, react-dom

### Community 15 - "Admin Customers, Media & Login"
Cohesion: 0.16
Nodes (17): AdminMedia(), remove(), submit(), togglePublished(), AdminCustomers(), openDetail(), setStatus(), AdminWhistleblowing() (+9 more)

### Community 16 - "Catalog Pages & Product Fetching"
Cohesion: 0.19
Nodes (14): CustomerCatalogPage(), metadata, CategoryPage(), generateMetadata(), CatalogPage(), metadata, generateMetadata(), ProductDetail() (+6 more)

### Community 17 - "Company Profile Content"
Cohesion: 0.15
Nodes (12): metadata, Kontak(), metadata, akhlak, company, contact, locations, misi (+4 more)

### Community 18 - "Admin Order & Payment Actions"
Cohesion: 0.22
Nodes (18): save(), save(), AdminOrderDetail(), acceptPayment(), cancelOrder(), markDelivered(), markPacking(), markShipped() (+10 more)

### Community 19 - "Factory Aerial Photo"
Cohesion: 0.27
Nodes (18): Aerial Photo of PT IKN Factory Complex (pabrik-2-1, frontend public asset), Aerial Photo of PT IKN Factory Complex (pabrik-2-1), Aerial Drone Photography, Blue Corporate Color Scheme on Buildings, Blue-Roofed Open Canopy (Parking / Loading Shelter), Blue Corrugated-Steel Main Production Building, Blue Storage Drums / Containers in Yard, Company Facility Showcase for Website Trust-Building (+10 more)

### Community 20 - "Payment Management Mockup"
Cohesion: 0.16
Nodes (17): Admin Payment List Table, Admin Role, Customer Field, E-Wallet Payment Method, Invoice Number Field (INV001..INV004), Payment Management Module (Admin Reference Mockup), Payment Method Field (Metode), Payment Status Field (+9 more)

### Community 21 - "Admin Product Manager"
Cohesion: 0.13
Nodes (11): metadata, AdminCategory, AdminProduct, emptyForm, formFromProduct(), ModalState, ProductFormState, openEdit() (+3 more)

### Community 22 - "Home Page Hero & Marquee"
Cohesion: 0.14
Nodes (8): HeroSlider(), slides, Marquee(), capabilities, marquee, products, stats, videos

### Community 23 - "Admin Fees & Shipping Handlers"
Cohesion: 0.16
Nodes (10): AdminAdditionalFees(), closeFeeForm(), closeShipForm(), removeFee(), removeShip(), saveDueHours(), submitFee(), submitShip() (+2 more)

### Community 24 - "Server Data & Mock Content"
Cohesion: 0.16
Nodes (12): MOCK_BROCHURES, MOCK_CERTIFICATES, MOCK_COMMERCE_CONFIG, MOCK_GALLERY, MOCK_NEWS, MOCK_PRODUCTS, fetchCommerceConfig(), NewsDetail (+4 more)

### Community 25 - "Customer Addresses"
Cohesion: 0.19
Nodes (9): metadata, AddressFields, CustomerAddresses(), addAddress(), removeAddress(), setPrimary(), updateAddress(), readFields() (+1 more)

### Community 26 - "Admin Users & Whistleblowing Forms"
Cohesion: 0.23
Nodes (9): emptyForm, HelpGuideConfig, permissionList, UserForm, WbsFileConfig, FileUploadDropzone(), FileUploadDropzoneProps, SegmentedRadio() (+1 more)

### Community 27 - "Head Office Hero Photo"
Cohesion: 0.41
Nodes (12): Home Page Hero Image (home.png), Kantor Direksi PT IKN Photo, Facade Signage with Company Name, Desaturated Cool-Tinted Photo Treatment, Head Office Building (Kantor Direksi), Head Office Photo as Website Hero, 16:9 Landscape Format (2880x1620), White Modernist Facade with Curved Dark-Glass Curtain Wall (+4 more)

### Community 28 - "Rubber Production Photo"
Cohesion: 0.42
Nodes (12): Produksi Karet 1 (ikn-fe public image), Produksi Karet 1 (Images source asset), Branded Worker Uniform, Coagulated Natural Rubber (Raw Material), Crumb Rubber Drying Racks, Crumb Rubber (SIR) Production Process, Personal Protective Equipment (PPE), Production Showcase Photography (+4 more)

### Community 29 - "Admin Company History"
Cohesion: 0.25
Nodes (5): AdminHistory(), BlockResponse, parseTimeline(), TimelineRow, AdminCard()

### Community 30 - "Admin Navigation Editor"
Cohesion: 0.22
Nodes (7): categoryOptions, docBoxStyle, DocLinkForm, DocLinkRow, emptyDocForm, mainCardStyle, subBoxStyle

### Community 31 - "Video Gallery"
Cohesion: 0.28
Nodes (5): Galeri(), metadata, VideoGallery(), fetchGallery(), Video

### Community 32 - "Admin Sales Chart"
Cohesion: 0.31
Nodes (6): AdminSalesChart(), ChartPoint, formatAxis(), MONTHS_ID, niceCeil(), parsePoint()

### Community 33 - "Rubber Tapping Photo"
Cohesion: 0.58
Nodes (9): Rubber Tapping Photo (ikn-fe/public/img/karet-1-1-scaled.jpg), Rubber Tapping Photo (Images/karet-1-1-scaled.jpg), Latex Collection Cup (Mangkok Sadap), Natural Latex (Getah Karet), Raw Material Origin Imagery, Rubber Plantation (Perkebunan Karet), Rubber Tapping (Penyadapan Karet), Rubber Tree (Hevea brasiliensis) (+1 more)

### Community 34 - "Admin Brochures"
Cohesion: 0.29
Nodes (6): AdminBrochures(), closeForm(), remove(), submit(), togglePublished(), uploadFile()

### Community 35 - "Admin Certificates"
Cohesion: 0.29
Nodes (6): AdminCertificates(), closeForm(), remove(), submit(), togglePublished(), upload()

### Community 36 - "Admin Contact Editor"
Cohesion: 0.29
Nodes (6): AdminContact(), BlockResponse, ContactData, ContactLocation, ContactSocial, parseData()

### Community 37 - "Admin News"
Cohesion: 0.29
Nodes (6): AdminNews(), closeForm(), remove(), submit(), togglePublished(), uploadThumb()

### Community 38 - "Customer Profile Form"
Cohesion: 0.29
Nodes (4): metadata, CustomerProfileForm(), handlePasswordSubmit(), handleSubmit()

### Community 39 - "Sarung Egrek Product Photo"
Cohesion: 0.32
Nodes (8): Sarung Egrek Product Photo, Black Vulcanized Rubber Material, Blade Protection and Worker Safety, Egrek (Palm Harvesting Sickle), Palm Oil Harvesting (Kelapa Sawit), E-commerce Product Catalog Image Asset, Rubber Retaining Loop Tab, Sarung Egrek (Rubber Egrek Blade Sheath)

### Community 40 - "Admin Bank Accounts"
Cohesion: 0.33
Nodes (5): AdminBankAccounts(), closeForm(), remove(), submit(), toggleActive()

### Community 41 - "Admin Gallery"
Cohesion: 0.33
Nodes (5): AdminGallery(), closeForm(), remove(), submit(), togglePublished()

### Community 42 - "Admin Navigation Hierarchy"
Cohesion: 0.33
Nodes (5): AdminNavigationHierarchy(), closeForm(), handleSubmit(), remove(), toggleActive()

### Community 43 - "Admin Users"
Cohesion: 0.29
Nodes (4): AdminUsers(), handleGuideSave(), handleSubmit(), toggleActive()

### Community 44 - "Admin Vision & Mission"
Cohesion: 0.33
Nodes (6): AdminVisionMission(), AkhlakPair, BlockResponse, parseData(), VisionMissionData, AdminPageHead()

### Community 45 - "Customer Company Form"
Cohesion: 0.33
Nodes (3): metadata, CustomerCompanyForm(), handleSubmit()

### Community 47 - "Product Manager Handlers"
Cohesion: 0.43
Nodes (6): ProductManager(), closeModal(), handleImageFile(), setPublished(), submitProduct(), updateField()

### Community 48 - "Cart Context & Product Types"
Cohesion: 0.38
Nodes (6): CartContext, CartContextValue, CatalogBrowserProps, CartItem, Category, Product

### Community 49 - "Resiprene 35 Product Photo"
Cohesion: 0.43
Nodes (7): Resiprene 35 Product Photo, Amber Granular Resin Flakes, Cyclized Rubber Resin, Natural Rubber (Karet Alam), Paint, Ink and Adhesive Binder, Resiprene 35, Zip-Lock Sample Bag

### Community 50 - "Rubber Boots Product Photo"
Cohesion: 0.38
Nodes (7): Sepatu Boots Product Photo, E-commerce Product Catalog Image, IKN Logo Branding, Natural Rubber (Karet) Material, Perkebunan Nusantara (PTPN) Co-branding, Plantation and Industrial Workwear Use, Rubber Safety Boots (Sepatu Boots Karet)

### Community 51 - "RUBIN Logo (Images)"
Cohesion: 0.43
Nodes (7): Blue Triangle Emblem, Boxed RUBIN Wordmark, Brand Blue Color, PT IKN, RUBIN Brand, RUBIN Logo (transparent PNG), Transparent-Background Logo Asset

### Community 52 - "Additional Fees Page Types"
Cohesion: 0.33
Nodes (5): FeeKind, FeeRow, ShippingMethodRow, TabKey, typeLabels

### Community 53 - "Admin Product Categories"
Cohesion: 0.40
Nodes (4): AdminProductCategories(), closeForm(), remove(), submit()

### Community 54 - "RUBIN Logo (Frontend)"
Cohesion: 0.53
Nodes (6): RUBIN Logo Image, Blue Brand Color, Blue Triangle Mark, PT IKN, RUBIN Brand, RUBIN Wordmark

### Community 55 - "Admin Gallery Page Types"
Cohesion: 0.40
Nodes (4): emptyForm, GalleryForm, GalleryRow, GalleryType

### Community 56 - "News Detail Page"
Cohesion: 0.80
Nodes (4): generateMetadata(), NewsDetail(), fetchNews(), fetchNewsDetail()

### Community 57 - "Admin Page Component Props"
Cohesion: 0.40
Nodes (4): AdminCardProps, AdminPageHeadProps, DataTableProps, RowAction

## Ambiguous Edges - Review These
- `Verifikasi pembayaran (Admin payment verification)` → `Pelanggan upload ulang bukti pembayaran (Customer re-uploads payment proof)`  [AMBIGUOUS]
  doc/User Flow E-Commerce.pdf · relation: references
- `Produksi Karet 1 (Images source asset)` → `Branded Worker Uniform`  [AMBIGUOUS]
  Images/produksi-karet-1.webp · relation: references
- `Produksi Karet 1 (ikn-fe public image)` → `Branded Worker Uniform`  [AMBIGUOUS]
  ikn-fe/public/img/produksi-karet-1.webp · relation: references
- `Rubber Factory Workers` → `Branded Worker Uniform`  [AMBIGUOUS]
  Images/produksi-karet-1.webp · relation: references
- `Aerial Photo of PT IKN Factory Complex (pabrik-2-1)` → `Keselamatan Kerja (Occupational Safety) Wall Signage`  [AMBIGUOUS]
  Images/pabrik-2-1.png · relation: references
- `Aerial Photo of PT IKN Factory Complex (pabrik-2-1, frontend public asset)` → `Keselamatan Kerja (Occupational Safety) Wall Signage`  [AMBIGUOUS]
  ikn-fe/public/img/pabrik-2-1.png · relation: references
- `Blue Corrugated-Steel Main Production Building` → `Keselamatan Kerja (Occupational Safety) Wall Signage`  [AMBIGUOUS]
  Images/pabrik-2-1.png · relation: conceptually_related_to
- `Tall Exhaust Stack / Chimney` → `Rubber (Karet) Processing Facility`  [AMBIGUOUS]
  Images/pabrik-2-1.png · relation: conceptually_related_to
- `RUBIN Brand` → `PT IKN`  [AMBIGUOUS]
  ikn-fe/public/img/rubin-logo.png · relation: conceptually_related_to
- `RUBIN Brand` → `PT IKN`  [AMBIGUOUS]
  Images/logo-removebg-preview.png · relation: conceptually_related_to

## Knowledge Gaps
- **190 isolated node(s):** `FeeKind`, `TabKey`, `FeeRow`, `ShippingMethodRow`, `typeLabels` (+185 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 281 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Verifikasi pembayaran (Admin payment verification)` and `Pelanggan upload ulang bukti pembayaran (Customer re-uploads payment proof)`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Produksi Karet 1 (Images source asset)` and `Branded Worker Uniform`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Produksi Karet 1 (ikn-fe public image)` and `Branded Worker Uniform`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Rubber Factory Workers` and `Branded Worker Uniform`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Aerial Photo of PT IKN Factory Complex (pabrik-2-1)` and `Keselamatan Kerja (Occupational Safety) Wall Signage`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Aerial Photo of PT IKN Factory Complex (pabrik-2-1, frontend public asset)` and `Keselamatan Kerja (Occupational Safety) Wall Signage`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `Blue Corrugated-Steel Main Production Building` and `Keselamatan Kerja (Occupational Safety) Wall Signage`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._