<?php

// Pengaturan aplikasi IKN yang bukan rahasia. Nilai yang bisa diubah admin ada di tabel settings.
return [
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    // Modul panel admin. Admin biasa dibatasi lewat users.permissions (array kode modul);
    // super_admin selalu punya semua modul.
    'modules' => [
        'dashboard' => ['id' => 'Dashboard', 'en' => 'Dashboard'],
        'cms' => ['id' => 'Halaman & Menu', 'en' => 'Pages & Menus'],
        'media' => ['id' => 'Media', 'en' => 'Media'],
        'news' => ['id' => 'Berita', 'en' => 'News'],
        'gallery' => ['id' => 'Galeri', 'en' => 'Gallery'],
        'certificates' => ['id' => 'Sertifikat', 'en' => 'Certificates'],
        'brochures' => ['id' => 'Brosur', 'en' => 'Brochures'],
        'wbs' => ['id' => 'Whistle Blowing System', 'en' => 'Whistle Blowing System'],
        'messages' => ['id' => 'Pesan Kontak', 'en' => 'Contact Messages'],
        'settings' => ['id' => 'Pengaturan', 'en' => 'Settings'],
        'users' => ['id' => 'Akun Admin', 'en' => 'Admin Accounts'],
        // Modul commerce (diaktifkan pada phase e-commerce).
        'orders' => ['id' => 'Order', 'en' => 'Orders'],
        'payments' => ['id' => 'Pembayaran', 'en' => 'Payments'],
        'products' => ['id' => 'Produk', 'en' => 'Products'],
        'categories' => ['id' => 'Kategori Produk', 'en' => 'Product Categories'],
        'stock' => ['id' => 'Stok', 'en' => 'Stock'],
        'customers' => ['id' => 'Customer', 'en' => 'Customers'],
        'chat' => ['id' => 'Live Chat', 'en' => 'Live Chat'],
        'shipping' => ['id' => 'Ongkir', 'en' => 'Shipping'],
        'vouchers' => ['id' => 'Voucher', 'en' => 'Vouchers'],
        'fees' => ['id' => 'Biaya Tambahan', 'en' => 'Fees'],
        'bank_accounts' => ['id' => 'Rekening Bank', 'en' => 'Bank Accounts'],
        'payment_methods' => ['id' => 'Metode Bayar', 'en' => 'Payment Methods'],
        'reports' => ['id' => 'Laporan', 'en' => 'Reports'],
        'audit' => ['id' => 'Audit Log', 'en' => 'Audit Log'],
    ],

    'cms' => [
        // Halaman bawaan yang dirujuk route FE: slug tidak boleh diubah/dihapus dari admin.
        // Halaman bawaan (punya rute statis di FE): sertifikat/pelanggan/reach/whistleblowing kini section di
        // keberlanjutan, unduhan section di bisnis (2026-09-29).
        'protected_pages' => ['home', 'tentang', 'bisnis', 'media', 'berita', 'galeri', 'keberlanjutan', 'kontak'],
    ],

    'media' => [
        // Batas ukuran (KB) dan mime yang diizinkan per jenis unggahan.
        'image_max_kb' => 5120,
        'document_max_kb' => 20480,
        'image_mimes' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
        'document_mimes' => ['application/pdf'],
        // Video pendek untuk kepala halaman (slideshow); disajikan langsung dari disk public.
        'video_max_kb' => 51200,
        'video_mimes' => ['video/mp4', 'video/webm'],
        'collections' => ['general', 'hero', 'gallery', 'news', 'certificates', 'brochures', 'logos', 'documents', 'wbs', 'help-guide', 'products', 'categories', 'qris', 'payment-proofs', 'order-attachments'],
    ],

    // ---- Commerce (phase e-commerce) ----
    'commerce' => [
        // Bukti bayar (disk private): jpg/png/pdf ≤ 5 MB (kontrak bagian 9).
        'proof_max_kb' => 5120,
        'proof_mimes' => ['image/jpeg', 'image/png', 'application/pdf'],
        // Lampiran order dari admin (faktur pajak, surat jalan): pdf/gambar/office ≤ 10 MB, disk private (ASUMSI A-74).
        'attachment_max_kb' => 10240,
        'attachment_mimes' => [
            'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword',
            'text/csv', 'text/plain', 'application/zip',
        ],
        // Sisa waktu minimum (jam) setelah bukti ditolak agar customer sempat unggah ulang (ASUMSI A-77).
        'reupload_grace_hours' => 12,
        // Default settings commerce (tabel settings, grup "commerce"); admin mengubah lewat /admin/settings.
        'defaults' => [
            'payment_due_hours' => 24,
            'unique_code_enabled' => true,
            'tax_rate' => 11,
            'price_includes_tax' => true,
            'auto_complete_days' => 7,
            'reminder_hours_before_due' => 2,
            // Invoice: {prefix}/{urut per bulan}/{bulan Romawi}/{tahun}, mis. PMS/X/INV/RA/77/IV/2026 (format klien).
            'invoice_prefix' => 'PMS/X/INV/RA',
            'invoice_signer_name' => 'Amalia Nasution',
            'invoice_signer_title' => 'SEVP Operation',
            'invoice_cc' => 'ATU, File',
            // Titik asal pengiriman (ASUMSI A-76): bawaan = pabrik Resiprene (CmsPageSeeder::GEO_RESIPRENE_PLANT).
            'shipping_origin_label' => 'Pabrik Resiprene',
            'shipping_origin_lat' => 3.3495,
            'shipping_origin_lng' => 99.0862,
            // Jarak jalan ≈ jarak garis lurus × faktor ini (tanpa layanan rute eksternal).
            'shipping_road_factor' => 1.3,
        ],
        'order_number_prefix' => 'IKN',
    ],

    // Kerangka payment gateway (ASUMSI A-15: Xendit). Nilai rahasia hanya dari .env; kosong = non-aktif.
    'gateways' => [
        'xendit' => [
            'base_url' => env('XENDIT_BASE_URL', 'https://api.xendit.co'),
            'secret_key' => env('XENDIT_SECRET_KEY'),
            'callback_token' => env('XENDIT_CALLBACK_TOKEN'),
        ],
    ],

    // Proxy geocoding Nominatim (OSM): cache + rate limit 1 req/detik ke upstream (KEPUTUSAN akun & alamat).
    'nominatim' => [
        'base_url' => env('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'),
        'user_agent' => env('NOMINATIM_USER_AGENT', 'IKN-Web/1.0 (+http://localhost; it@example.com)'),
        'search_cache_days' => 7,
        'reverse_cache_days' => 30,
    ],

    'wbs' => [
        'attachment_max_kb' => 10240,
        'attachment_mimes' => ['application/pdf', 'image/jpeg', 'image/png'],
    ],

    'seed' => [
        'super_admin_email' => env('SEED_SUPER_ADMIN_EMAIL', 'superadmin@ptikn.com'),
        'super_admin_password' => env('SEED_SUPER_ADMIN_PASSWORD', 'password'),
    ],
];
