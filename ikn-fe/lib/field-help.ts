// Penjelasan field form admin untuk tombol "?" di bawah setiap input (components/admin/AdminFieldHelp).
// Kunci = teks label Bahasa Indonesia (tanpa tanda * wajib). Label versi Inggris dipetakan lewat EN_ALIAS.
// Label yang maknanya berbeda per halaman ditaruh di ROUTE_HELP (awalan path admin → label → teks).
// Menambah field admin baru: tambahkan penjelasannya di sini (bila tidak ada, tombol "?" tidak muncul).

export interface HelpText {
  id: string;
  en: string;
}

const h = (id: string, en: string): HelpText => ({ id, en });

// ---------------------------------------------------------------------------------------------
// Umum (dipakai banyak halaman)
// ---------------------------------------------------------------------------------------------
const COMMON: Record<string, HelpText> = {
  'Nama': h('Nama yang tampil di situs dan di daftar admin.', 'The name shown on the site and in admin lists.'),
  'Judul': h('Judul utama item ini. Isi kolom ID; kolom EN boleh kosong dan otomatis memakai teks ID.', 'Main title of this item. Fill in ID; EN may stay empty and falls back to the ID text.'),
  'Deskripsi': h('Penjelasan singkat yang tampil di bawah judul. Opsional.', 'Short description shown under the title. Optional.'),
  'Deskripsi singkat': h('Satu kalimat penjelasan yang tampil di bawah judul tautan/item.', 'One-sentence description shown under the link/item title.'),
  'Urutan': h('Angka urutan tampil: angka lebih kecil tampil lebih dulu. Item dengan angka sama diurutkan menurut waktu dibuat.', 'Display order: lower numbers appear first. Items with the same number are ordered by creation time.'),
  'Urutan tampil': h('Angka urutan tampil: angka lebih kecil tampil lebih dulu.', 'Display order: lower numbers appear first.'),
  'Status': h('Terbit = tampil di situs publik. Draf = tersimpan tetapi belum tampil.', 'Published = visible on the public site. Draft = saved but not shown yet.'),
  'Slug': h('Bagian alamat URL (huruf kecil, angka, tanda hubung). Kosongkan agar dibuat otomatis dari judul/nama. Mengubah slug membuat tautan lama tidak berlaku.', 'Part of the URL (lowercase letters, digits, hyphens). Leave empty to generate it from the title/name. Changing it breaks old links.'),
  'Slug URL': h('Bagian alamat URL halaman (huruf kecil, angka, tanda hubung). Kosongkan agar dibuat otomatis dari nama.', 'URL part of the page (lowercase, digits, hyphens). Leave empty to generate it from the name.'),
  'Alamat (slug)': h('Alamat URL artikel, mis. /berita/judul-artikel. Kosongkan agar dibuat otomatis dari judul. Hindari mengubahnya setelah dibagikan.', 'Article URL, e.g. /berita/article-title. Leave empty to generate it from the title. Avoid changing it after sharing.'),
  'Kategori': h('Kelompok tempat item ini ditampilkan dan disaring. Kelola daftar kategori di menu kategori terkait.', 'The group this item belongs to for display and filtering. Manage categories in the related category menu.'),
  'Gambar': h('Pilih atau unggah gambar dari Media Library (JPG/PNG/WebP). Gunakan gambar yang tajam dan tidak terlalu besar (di bawah 1 MB).', 'Pick or upload an image from the Media Library (JPG/PNG/WebP). Use a sharp image under about 1 MB.'),
  'Label': h('Teks pendek yang tampil (mis. judul kecil di atas bagian atau teks menu).', 'Short visible text (e.g. a small eyebrow above a section or a menu text).'),
  'URL': h('Alamat tujuan. Untuk halaman situs sendiri cukup awali dengan /, mis. /kontak atau /bisnis#produk. Untuk situs lain tulis lengkap dengan https://.', 'Target address. For pages on this site start with /, e.g. /kontak or /bisnis#produk. For other sites use the full https:// address.'),
  'Tautan': h('Alamat tujuan saat diklik. Halaman sendiri diawali /, situs lain lengkap dengan https://.', 'Where the click goes. Own pages start with /, other sites use the full https:// address.'),
  'Tautan URL': h('Alamat web lengkap (https://...) yang dibuka saat diklik.', 'Full web address (https://...) opened on click.'),
  'Email': h('Alamat email yang valid. Untuk akun, email dipakai untuk login dan menerima notifikasi.', 'A valid email address. For accounts it is used to log in and receive notifications.'),
  'Jenis': h('Pilih jenis/tipe item ini; pilihan menentukan cara item diproses dan ditampilkan.', 'Choose the type of this item; it decides how the item is processed and shown.'),
  'Kode': h('Kode unik pengenal (huruf, angka, tanda hubung). Tidak boleh sama dengan item lain.', 'Unique identifier code (letters, digits, hyphens). Must not repeat.'),
  'Catatan': h('Catatan bebas untuk keperluan internal/riwayat, mis. nomor dokumen atau alasan.', 'Free note for internal records, e.g. document number or reason.'),
  'Catatan (opsional)': h('Catatan tambahan yang ikut tercatat di riwayat. Boleh dikosongkan.', 'Extra note recorded in the history. Optional.'),
  'Jabatan': h('Jabatan/posisi orang tersebut, mis. Direktur Utama atau Procurement.', 'The person\'s position, e.g. President Director or Procurement.'),
  'Alamat': h('Alamat lengkap (jalan, nomor, kota, kode pos).', 'Full address (street, number, city, postal code).'),
  'Nama lokasi': h('Nama tempat yang mudah dikenali, mis. "Kantor Pusat & Pabrik" atau "Pabrik Resiprene".', 'An easily recognised place name, e.g. "Head Office & Plant" or "Resiprene Plant".'),
  'Ringkasan': h('Ringkasan singkat 1–2 kalimat yang tampil di kartu/daftar sebelum pengunjung membuka detail.', 'A 1–2 sentence summary shown on cards/lists before the visitor opens the detail.'),
  'Satuan': h('Satuan jual atau satuan angka, mis. pcs, kg, roll, tahun, ton.', 'Sales unit or figure unit, e.g. pcs, kg, roll, years, tons.'),
  'Alasan penolakan': h('Wajib diisi. Alasan dikirim ke pihak terkait (email/notifikasi), jadi tulis jelas dan sopan, mis. "Nominal transfer kurang Rp 50.000".', 'Required. The reason is sent to the person concerned (email/notification); write it clearly and politely.'),
};

// ---------------------------------------------------------------------------------------------
// Toko: order, pembayaran, customer
// ---------------------------------------------------------------------------------------------
const COMMERCE: Record<string, HelpText> = {
  'Tambah catatan perjalanan': h('Kabar posisi kiriman untuk customer, mis. "Paket tiba di gudang transit Pekanbaru". Muncul di lacak pesanan dan customer mendapat notifikasi. Hanya untuk order berstatus Dikirim.', 'Shipment progress for the customer, e.g. "Parcel reached the Pekanbaru hub". Shown in order tracking and notified. Only for shipped orders.'),
  'Alasan pembatalan': h('Wajib. Alasan tampil di detail order customer dan dikirim lewat email. Order yang sudah dibayar mengembalikan stok otomatis; pengembalian dana dilakukan di luar sistem.', 'Required. Shown on the customer order and emailed. Paid orders return stock automatically; refunds are handled outside the system.'),
  'Kurir / ekspedisi': h('Nama jasa pengiriman yang dipakai, mis. JNE Trucking, Indah Cargo, armada sendiri. Tampil di lacak pesanan customer.', 'The carrier used, e.g. JNE Trucking, own fleet. Shown in customer tracking.'),
  'Nomor resi': h('Nomor resi/surat jalan dari kurir agar customer bisa melacak kiriman. Wajib saat menandai dikirim.', 'The carrier tracking/waybill number so the customer can track it. Required when marking as shipped.'),
  'Lampiran untuk customer (opsional)': h('Dokumen yang perlu diterima customer, mis. faktur pajak, surat jalan, sertifikat analisis (dokumen PDF atau gambar, maks. 10 MB per berkas). Tampil di "Dokumen dari penjual" pada detail pesanan.', 'Documents the customer should receive, e.g. tax invoice, waybill, certificate of analysis (PDF documents or images, max 10 MB each). Shown under "Documents from the seller".'),
  'Perpanjang selama': h('Tambah batas waktu bayar dari batas sekarang, dalam jam. Pengingat bayar dikirim ulang untuk batas baru.', 'Extend the payment deadline from the current one, in hours. The reminder is sent again for the new deadline.'),
  'Batas bayar baru': h('Atau tentukan tanggal dan jam batas bayar baru secara langsung (harus di masa depan).', 'Or set the new payment deadline directly (must be in the future).'),
  'Status pembayaran': h('Saring daftar menurut status percobaan pembayaran.', 'Filter the list by payment attempt status.'),
  'Status customer': h('Saring daftar menurut status akun customer.', 'Filter the list by customer account status.'),
  'Status order': h('Saring daftar menurut status order.', 'Filter the list by order status.'),
};

// ---------------------------------------------------------------------------------------------
// Katalog: produk, kategori, stok
// ---------------------------------------------------------------------------------------------
const CATALOG: Record<string, HelpText> = {
  'Kode produk': h('Kode unik produk (SKU), mis. RSP-35. Tampil di katalog, keranjang, invoice, dan laporan.', 'Unique product code (SKU), e.g. RSP-35. Shown in the catalog, cart, invoice and reports.'),
  'Nama produk': h('Nama produk yang tampil di katalog dan invoice. EN kosong = memakai teks ID.', 'Product name shown in the catalog and invoice. Empty EN = uses the ID text.'),
  'Jenis / material': h('Jenis atau bahan produk, mis. "Cyclised Natural Rubber". Tampil di atas nama produk.', 'Product type or material, e.g. "Cyclised Natural Rubber". Shown above the product name.'),
  'Kata kunci pencarian (alias)': h('Kata lain yang sering dipakai customer untuk mencari produk ini (dipisah koma), mis. salah eja atau nama dagang. Tidak tampil di katalog.', 'Other words customers use to search for this product (comma-separated), e.g. misspellings or trade names. Not shown in the catalog.'),
  'Mode harga': h('Harga tetap = bisa dibeli lewat keranjang. Penawaran = tanpa harga; customer menekan "Minta penawaran" dan tim penjualan menghubungi.', 'Fixed price = can be bought via the cart. Quote = no price; customers press "Request a quote" and sales follows up.'),
  'Harga (Rp, sebelum promo)': h('Harga normal per satuan dalam rupiah bulat. Termasuk/tidak termasuk PPN mengikuti Pengaturan Checkout.', 'Normal price per unit in whole rupiah. VAT inclusion follows Checkout Settings.'),
  'Harga promo (Rp)': h('Harga coret yang berlaku hanya selama periode promo. Harus lebih kecil dari harga normal. Kosong = tidak ada promo.', 'Discounted price valid only during the promo period. Must be below the normal price. Empty = no promo.'),
  'Promo mulai': h('Tanggal dan jam promo mulai berlaku. Kosong = langsung berlaku.', 'Date and time the promo starts. Empty = starts immediately.'),
  'Promo berakhir': h('Tanggal dan jam promo berakhir. Setelahnya harga kembali normal otomatis.', 'Date and time the promo ends. The price returns to normal automatically afterwards.'),
  'Panjang kemasan (cm)': h('Panjang kemasan per satuan jual. Bersama lebar dan tinggi dipakai menghitung volume untuk ongkir per m³.', 'Package length per sales unit. With width and height it gives the volume for per-m³ shipping.'),
  'Lebar kemasan (cm)': h('Lebar kemasan per satuan jual (cm).', 'Package width per sales unit (cm).'),
  'Tinggi kemasan (cm)': h('Tinggi kemasan per satuan jual (cm). Bila salah satu dimensi kosong, volume tidak dihitung di ongkir.', 'Package height per sales unit (cm). If any dimension is empty, volume is not charged.'),
  'Minimum order (MOQ)': h('Jumlah minimal yang harus dibeli customer dalam satu pesanan untuk produk ini.', 'The minimum quantity a customer must buy of this product in one order.'),
  'Berat per satuan (gram)': h('Berat satu satuan jual dalam gram, termasuk kemasan. Dipakai menghitung ongkir per kg.', 'Weight of one sales unit in grams, including packaging. Used for per-kg shipping.'),
  'Status stok': h('Otomatis = mengikuti stok tersedia (tersedia/habis). Pre-order = produk tetap bisa dipesan walau stok 0 (dibuat sesuai pesanan).', 'Automatic = follows available stock. Made to order = can be ordered even with zero stock.'),
  'Keunggulan (satu baris per poin)': h('Poin keunggulan produk, satu baris = satu poin bercentang di halaman produk.', 'Product highlights; one line = one ticked point on the product page.'),
  'Aplikasi / penggunaan (satu baris per item)': h('Bidang penggunaan produk, satu baris = satu item, mis. "Perkebunan kelapa sawit".', 'Where the product is used; one line = one item, e.g. "Oil palm plantations".'),
  'Foto & video produk (urutan = urutan geser di halaman produk)': h('Sampai 20 foto/video. Urutan daftar = urutan galeri. Pilih "Jadikan thumbnail" pada foto yang ingin tampil di kartu katalog; video tidak bisa jadi thumbnail.', 'Up to 20 photos/videos. List order = gallery order. Use "Set as thumbnail" on the photo for catalog cards; videos cannot be thumbnails.'),
  'Spesifikasi teknis': h('Pasangan parameter dan nilai yang tampil sebagai tabel di halaman produk, mis. "Softening point" – "125–145 °C". Baris kosong diabaikan.', 'Parameter/value pairs shown as a table on the product page. Empty rows are ignored.'),
  'Kelarutan (solubility)': h('Daftar pelarut dan tingkat kelarutannya (mis. "White spirit" – "Sempurna"), tampil sebagai tabel di halaman produk.', 'Solvents and how well the product dissolves in them, shown as a table on the product page.'),
  'Jenis mutasi': h('Stok masuk = menambah stok dari produksi/pembelian. Penyesuaian = koreksi hasil stock opname (boleh negatif).', 'Stock in = add stock from production/purchase. Adjustment = stock-count correction (may be negative).'),
  'Jumlah': h('Banyaknya stok yang ditambah (stok masuk) atau dikoreksi (penyesuaian, mis. -5 atau 20) dalam satuan produk.', 'Quantity added (stock in) or corrected (adjustment, e.g. -5 or 20) in the product unit.'),
  'Nama kategori': h('Nama kategori produk yang tampil sebagai filter di katalog.', 'Product category name shown as a catalog filter.'),
  'Gambar kategori': h('Gambar kecil yang mewakili kategori (opsional).', 'A small image representing the category (optional).'),
};

// ---------------------------------------------------------------------------------------------
// Pengaturan toko: ongkir, voucher, biaya, metode bayar, rekening, checkout
// ---------------------------------------------------------------------------------------------
const STORE_SETTINGS: Record<string, HelpText> = {
  'Faktor jalan': h('Pengali jarak garis lurus menjadi perkiraan jarak jalan (1–3). Bawaan 1,3; naikkan bila rute ke wilayah tertentu banyak memutar.', 'Multiplier turning straight-line distance into estimated road distance (1–3). Default 1.3; raise it for winding routes.'),
  'Cakupan wilayah': h('Wilayah yang masuk zona ini (provinsi, kabupaten/kota, atau kecamatan). Wilayah paling spesifik menang bila alamat cocok dengan beberapa zona.', 'Regions in this zone (province, regency/city, or district). The most specific region wins when an address matches several zones.'),
  'Prioritas': h('Penentu bila satu alamat cocok dengan dua zona pada tingkat wilayah yang sama: angka lebih besar menang. Selama zona tidak tumpang tindih, angka ini tidak berpengaruh.', 'Tie-breaker when an address matches two zones at the same region level: the higher number wins. Irrelevant if zones do not overlap.'),
  'Nama zona': h('Nama zona untuk admin, mis. "Jawa" atau "Sumatera Utara". Tidak tampil ke customer.', 'Zone name for admins, e.g. "Java". Not shown to customers.'),
  'Nama layanan': h('Nama layanan yang dipilih customer saat checkout, mis. Reguler, Ekspres, Kargo.', 'Service name customers choose at checkout, e.g. Regular, Express, Cargo.'),
  'Jenis tarif': h('Tarif tetap = ongkir sama untuk semua pesanan. Dihitung = tarif dasar + per km jarak + per kg berat + per m³ volume.', 'Flat = same charge for every order. Calculated = base + per km + per kg + per m³.'),
  'Tarif dasar (Rp)': h('Biaya tetap per kiriman (muat, packing, administrasi), dikenakan sekali per pesanan.', 'Fixed cost per shipment (loading, packing, admin), charged once per order.'),
  'Tarif tetap (Rp)': h('Ongkir untuk setiap pesanan di zona ini, berapa pun jarak, berat, dan volumenya.', 'Shipping charge for every order in this zone regardless of distance, weight or volume.'),
  'Ongkir minimum (Rp)': h('Batas bawah ongkir. Bila hasil hitungan lebih kecil, yang ditagih adalah angka minimum ini.', 'Shipping floor. If the calculated amount is lower, this minimum is charged.'),
  'Per km jarak (Rp)': h('Rupiah per kilometer dari titik asal ke titik peta alamat customer (dihitung otomatis, dibulatkan ke atas). 0 = jarak tidak dihitung.', 'Rupiah per km from the origin to the customer map pin (automatic, rounded up). 0 = distance ignored.'),
  'Per kg berat (Rp)': h('Rupiah per kilogram berat total pesanan (berat produk × qty, dibulatkan ke atas). 0 = berat tidak dihitung.', 'Rupiah per kg of total order weight (rounded up). 0 = weight ignored.'),
  'Per m³ volume (Rp)': h('Rupiah per meter kubik volume kemasan pesanan (dimensi produk × qty, dibulatkan ke atas per 0,01 m³). 0 = volume tidak dihitung.', 'Rupiah per cubic metre of package volume (rounded up per 0.01 m³). 0 = volume ignored.'),
  'Gratis ongkir di atas subtotal (Rp)': h('Bila subtotal setelah diskon mencapai angka ini, ongkir layanan ini menjadi Rp 0. Kosong = tidak ada gratis ongkir.', 'When the subtotal after discount reaches this amount, this service ships for free. Empty = never free.'),
  'Estimasi sampai': h('Perkiraan lama pengiriman yang tampil ke customer, mis. "2–4 hari".', 'Delivery time estimate shown to customers, e.g. "2–4 days".'),
  'Simulasi': h('Kalkulator percobaan: isi contoh jarak, berat, dan volume untuk melihat ongkir dari tarif yang sedang diisi. Tidak disimpan dan tidak memengaruhi customer.', 'Trial calculator: enter sample distance, weight and volume to preview the charge. Not saved.'),
  'Persentase (%)': h('Besar potongan dalam persen (1–100) dari subtotal produk yang tercakup voucher. Batasi dengan "Maksimum diskon" bila perlu.', 'Discount percentage (1–100) of the covered subtotal. Cap it with "Maximum discount" if needed.'),
  'Batas waktu pembayaran': h('Berapa jam customer diberi waktu membayar setelah checkout. Lewat batas ini order otomatis kedaluwarsa dan stoknya dikembalikan.', 'Hours a customer has to pay after checkout. Afterwards the order expires and stock is released.'),
  'Pengingat sebelum batas bayar': h('Email/notifikasi pengingat dikirim sekian jam sebelum batas bayar. 0 = tanpa pengingat.', 'A reminder is sent this many hours before the deadline. 0 = no reminder.'),
  'Tarif PPN': h('Persentase PPN untuk produk yang dikenai pajak (mis. 11). Apakah harga sudah termasuk PPN diatur di pilihan di bawahnya.', 'VAT percentage for taxable products (e.g. 11). Whether prices include VAT is set below.'),
  'Selesai otomatis setelah diterima': h('Order berstatus Diterima ditutup otomatis menjadi Selesai setelah sekian hari bila customer tidak menekan "Selesaikan pesanan". 0 = hanya manual.', 'Delivered orders become Completed automatically after this many days. 0 = manual only.'),
  'Kode voucher': h('Kode yang diketik customer saat checkout (huruf besar, tanpa spasi), mis. IKN10. Harus unik.', 'Code customers type at checkout (uppercase, no spaces), e.g. IKN10. Must be unique.'),
  'Jenis diskon': h('Persen = potongan persentase dari subtotal produk yang tercakup. Nominal = potongan rupiah tetap.', 'Percent = percentage off the covered subtotal. Fixed = a fixed rupiah amount off.'),
  'Minimum subtotal (Rp)': h('Voucher hanya berlaku bila subtotal keranjang mencapai angka ini. 0 = tanpa minimum.', 'The voucher only applies when the cart subtotal reaches this amount. 0 = no minimum.'),
  'Maksimum diskon (Rp)': h('Batas atas potongan untuk voucher persen. Kosong = tanpa batas.', 'Maximum discount for percent vouchers. Empty = no cap.'),
  'Kuota total': h('Berapa kali voucher boleh dipakai oleh semua customer. Kosong = tidak terbatas.', 'How many times the voucher may be used in total. Empty = unlimited.'),
  'Batas per customer': h('Berapa kali satu customer boleh memakai voucher ini. Kosong = tidak terbatas.', 'How many times one customer may use it. Empty = unlimited.'),
  'Mulai berlaku': h('Voucher baru bisa dipakai mulai tanggal dan jam ini. Kosong = langsung berlaku.', 'The voucher becomes usable from this date and time. Empty = immediately.'),
  'Berakhir': h('Setelah tanggal dan jam ini voucher tidak bisa dipakai lagi. Kosong = tanpa batas waktu.', 'After this date and time the voucher can no longer be used. Empty = no end.'),
  'Cakupan': h('Semua produk, atau hanya produk di kategori tertentu (diskon dihitung dari subtotal produk kategori itu saja).', 'All products, or only selected categories (discount computed from those products only).'),
  'Berlaku untuk': h('Semua customer, atau hanya customer tertentu yang dipilih. Voucher khusus tampil sebagai pilihan di checkout customer tersebut.', 'All customers, or only selected customers. Targeted vouchers appear as options at their checkout.'),
  'Nama biaya': h('Nama biaya tambahan yang tampil di ringkasan checkout dan invoice, mis. "Biaya administrasi".', 'Name of the extra fee shown in the checkout summary and invoice.'),
  'Nominal (Rp)': h('Besar biaya dalam rupiah, ditambahkan sekali per pesanan.', 'Fee amount in rupiah, added once per order.'),
  'Dibebankan ke': h('Semua customer = biaya masuk ke setiap pesanan. Customer tertentu = hanya untuk customer yang dipilih.', 'All customers = added to every order. Selected customers = only for the chosen customers.'),
  'Nama bank': h('Nama bank tujuan transfer, mis. Bank BCA.', 'Destination bank name, e.g. Bank BCA.'),
  'Nomor rekening': h('Nomor rekening tujuan transfer. Tampil di instruksi bayar customer dan bisa disalin.', 'Destination account number. Shown in the customer payment instructions.'),
  'Atas nama': h('Nama pemilik rekening persis seperti di buku tabungan, agar customer yakin rekening benar.', 'Account holder name exactly as registered, so customers trust the account.'),
  'Nama tampil': h('Nama metode bayar yang dilihat customer saat checkout.', 'Payment method name customers see at checkout.'),
  'Instruksi pembayaran': h('Langkah membayar yang tampil ke customer setelah checkout (mis. transfer sesuai nominal termasuk kode unik).', 'Payment steps shown to customers after checkout.'),
  'Gambar kode QRIS': h('Gambar QRIS statis merchant (PNG/JPG). Customer memindainya lalu mengunggah bukti bayar.', 'The merchant static QRIS image (PNG/JPG). Customers scan it and upload proof.'),
  'Konfigurasi gateway (non-rahasia)': h('Pengaturan non-rahasia untuk payment gateway. Kunci API/rahasia tidak diisi di sini, melainkan di server (.env) oleh tim TI.', 'Non-secret gateway settings. API keys/secrets live on the server (.env), set by IT.'),
  'Biaya gateway (%)': h('Persentase biaya dari penyedia gateway, sebagai catatan (saat ini belum ditagihkan ke customer).', 'Gateway provider percentage fee, for reference (not yet charged to customers).'),
  'Biaya gateway tetap (Rp)': h('Biaya tetap per transaksi dari penyedia gateway, sebagai catatan.', 'Fixed per-transaction gateway fee, for reference.'),
  'Driver': h('Penyedia pemroses pembayaran: Manual = diverifikasi admin; Xendit = otomatis lewat gateway (butuh kunci di server).', 'Payment processor: Manual = admin-verified; Xendit = automatic via gateway (needs server keys).'),
  'Channel code': h('Kode kanal dari penyedia gateway, mis. ID_OVO untuk e-wallet. Lihat dokumentasi gateway.', 'Gateway channel code, e.g. ID_OVO for e-wallets. See the gateway docs.'),
  'Bank code': h('Kode bank virtual account dari penyedia gateway, mis. BCA, BNI, MANDIRI.', 'Virtual account bank code from the gateway, e.g. BCA, BNI.'),
  'Awalan nomor invoice': h('Bagian depan nomor invoice. Nomor lengkap: {awalan}/{urut per bulan}/{bulan Romawi}/{tahun}, mis. PMS/X/INV/RA/77/IV/2026. Invoice yang sudah terbit tidak berubah.', 'Invoice number prefix. Full number: {prefix}/{monthly seq}/{Roman month}/{year}. Issued invoices are not renumbered.'),
  'Nama penanda tangan': h('Nama pejabat yang tercetak di kolom tanda tangan invoice.', 'Name printed in the invoice signature block.'),
  'Jabatan penanda tangan': h('Jabatan pejabat penanda tangan, tercetak di bawah nama, mis. SEVP Operation.', 'Signatory title printed under the name.'),
  'Tembusan (cc)': h('Pihak tembusan yang tercetak di invoice, dipisah koma, mis. "ATU, File".', 'Copy recipients printed on the invoice, comma-separated.'),
};

// ---------------------------------------------------------------------------------------------
// Konten: halaman, berita, galeri, dokumen, menu, pengaturan situs, akun
// ---------------------------------------------------------------------------------------------
const CONTENT: Record<string, HelpText> = {
  'Judul halaman': h('Judul halaman yang tampil di tab browser dan hasil pencarian (bila SEO judul kosong).', 'Page title used in the browser tab and search results (when SEO title is empty).'),
  'SEO: judul': h('Judul khusus untuk Google (sekitar 50–60 karakter). Kosong = memakai judul halaman.', 'Title for Google (about 50–60 characters). Empty = uses the page title.'),
  'SEO: deskripsi': h('Kalimat ringkas di bawah judul pada hasil Google (sekitar 120–160 karakter).', 'Short sentence under the title in Google results (about 120–160 characters).'),
  'Kunci section (key)': h('Nama pengenal section untuk tautan langsung (anchor), mis. "sertifikat" → /keberlanjutan#sertifikat. Huruf kecil dan tanda hubung.', 'Section identifier for direct links (anchor), e.g. "sertifikat" → /keberlanjutan#sertifikat.'),
  'Tanggal terbit': h('Tanggal yang tampil di artikel dan dipakai mengurutkan berita. Tanggal di masa depan = berita baru tampil saat tanggal itu tiba.', 'Date shown on the article and used for sorting. A future date publishes it then.'),
  'Penulis': h('Nama penulis yang tampil di artikel (opsional).', 'Author name shown on the article (optional).'),
  'Ringkasan (excerpt)': h('1–2 kalimat yang tampil di kartu berita dan sebagai deskripsi saat dibagikan. Kosong = diambil dari awal isi.', '1–2 sentences on the news card and when shared. Empty = taken from the body.'),
  'Isi berita': h('Isi artikel. Gunakan judul (H2/H3), daftar, gambar, dan tautan dari bilah format. Tempel teks dari Word akan dibersihkan otomatis.', 'Article body. Use headings, lists, images and links from the toolbar. Pasted Word text is cleaned automatically.'),
  'Tipe': h('Foto = unggah gambar. Video = tempel tautan YouTube.', 'Photo = upload an image. Video = paste a YouTube link.'),
  'URL atau ID video YouTube': h('Tempel tautan video YouTube (mis. https://youtu.be/abc123) atau ID-nya saja. Thumbnail diambil otomatis.', 'Paste a YouTube link or just the video ID. The thumbnail is fetched automatically.'),
  'Judul brosur': h('Nama brosur yang tampil di daftar unduhan.', 'Brochure name shown in the download list.'),
  'Berkas brosur (PDF)': h('Berkas PDF brosur (maks. 10 MB) yang dibuka pengunjung di penampil dokumen situs.', 'The brochure PDF (max 10 MB) visitors open in the site document viewer.'),
  'Nama sertifikat': h('Nama sertifikat, mis. ISO 9001:2015.', 'Certificate name, e.g. ISO 9001:2015.'),
  'Materi / standar': h('Ruang lingkup atau standar yang disertifikasi.', 'The certified scope or standard.'),
  'Logo sertifikat': h('Gambar lencana/logo sertifikat (mis. logo ISO atau lembaga sertifikasi). Tampil di kotak putih di samping nama sertifikat; pakai PNG/SVG berlatar transparan atau putih.', 'Badge/logo image for the certificate (e.g. the ISO mark or certifying body). Shown in a white tile next to the certificate name; use a PNG/SVG with a transparent or white background.'),
  'Berkas sertifikat (PDF)': h('Salinan sertifikat (PDF) yang bisa dibuka pengunjung.', 'A copy of the certificate (PDF) visitors can open.'),
  'Nama pelanggan': h('Nama perusahaan pelanggan yang logonya ditampilkan.', 'Customer company name whose logo is shown.'),
  'Tautan situs (opsional)': h('Situs web pelanggan; logo menjadi tautan bila diisi.', 'Customer website; the logo links to it when filled.'),
  'Logo (opsional)': h('Logo pelanggan (PNG transparan disarankan). Tanpa logo, nama yang ditampilkan.', 'Customer logo (transparent PNG recommended). Without it the name is shown.'),
  'Kategori (menu induk)': h('Menu utama tempat tautan ini muncul sebagai sub-menu.', 'The main menu this link appears under.'),
  'Sumber tautan': h('Berkas dokumen = unggah PDF dari Media Library. Tautan URL = arahkan ke alamat web.', 'Document file = upload a PDF. URL = link to a web address.'),
  'Berkas dokumen': h('Dokumen PDF yang dibuka saat tautan diklik.', 'The PDF opened when the link is clicked.'),
  'Kunci (key)': h('Pengenal tetap item menu. Menu bawaan memakai kunci tertentu; jangan diubah.', 'Fixed identifier of a menu item. Built-in menus rely on it; do not change.'),
  'Sub-menu': h('Daftar tautan yang muncul saat menu utama ini dibuka.', 'Links shown when this main menu is opened.'),
  'Nomor WhatsApp Business': h('Nomor marketing utama, format 62… tanpa + (mis. 6281234567890). Dipakai tombol Chat WhatsApp, footer, dan halaman Kontak. Kosong = tombol tidak tampil.', 'Main marketing number, 62… format without +. Used by the WhatsApp button, footer and Contact page. Empty = button hidden.'),
  'Nomor WhatsApp marketing lainnya (opsional)': h('Nomor tambahan (maks. 10) beserta nama tim. Bila lebih dari satu nomor, tombol WhatsApp menampilkan daftar pilihan.', 'Extra numbers (max 10) with team names. With more than one, the WhatsApp button shows a chooser.'),
  'Nama tim / orang': h('Nama yang tampil di daftar pilihan WhatsApp, mis. "Marketing Resiprene".', 'Name shown in the WhatsApp chooser, e.g. "Resiprene marketing".'),
  'Nomor': h('Nomor telepon/WhatsApp. Awalan 0 otomatis diubah ke 62.', 'Phone/WhatsApp number. A leading 0 becomes 62 automatically.'),
  'Pesan awal WhatsApp': h('Teks yang otomatis terisi saat pengunjung membuka chat WhatsApp, mis. "Halo, saya ingin bertanya tentang produk IKN."', 'Pre-filled text when visitors open the WhatsApp chat.'),
  'ID Google Analytics (GA4)': h('Measurement ID dari Google Analytics 4, format G-XXXXXXX. Kosong = analitik tidak dipasang.', 'Google Analytics 4 measurement ID (G-XXXXXXX). Empty = no analytics.'),
  'Token verifikasi Google Search Console': h('Isi atribut content dari meta tag verifikasi Search Console (bukan seluruh tag).', 'The content value of the Search Console verification meta tag (not the whole tag).'),
  'Nama perusahaan': h('Nama resmi lengkap perusahaan; tampil di footer, kop invoice, dan SEO.', 'Full legal company name; used in the footer, invoice header and SEO.'),
  'Nama singkat': h('Nama pendek perusahaan, mis. PT IKN; dipakai di judul tab browser dan tempat sempit.', 'Short company name, e.g. PT IKN; used in browser tabs and tight spaces.'),
  'Induk perusahaan': h('Nama induk usaha, mis. PT Perkebunan Nusantara III (Persero); tampil di kop invoice dan halaman profil.', 'Parent company name; shown in the invoice header and profile.'),
  'Berdiri sejak': h('Tahun berdiri perusahaan, mis. 1965.', 'Year the company was founded, e.g. 1965.'),
  'Warna utama': h('Warna merek untuk tombol, tautan, label, dan ikon aktif di seluruh situs. Kosong/Bawaan = biru logo.', 'Brand colour for buttons, links, labels and active icons site-wide. Default = logo blue.'),
  'Warna gelap': h('Warna latar footer dan blok berlatar gelap.', 'Background colour of the footer and dark blocks.'),
  'Warna aksen': h('Warna sorotan kecil: nomor bagian, badge promo, garis penanda.', 'Small highlight colour: section numbers, promo badges, markers.'),
  'Tagline': h('Kalimat singkat identitas perusahaan yang tampil di footer dan SEO.', 'Short company tagline shown in the footer and SEO.'),
  'Dokumen profil perusahaan (PDF)': h('PDF company profile yang bisa diunduh dari tombol di situs.', 'Company profile PDF downloadable from site buttons.'),
  'Judul footer': h('Kalimat ajakan besar di footer semua halaman.', 'Large call-to-action headline in every page footer.'),
  'Label tombol ajakan': h('Teks tombol di footer, mis. "Mulai percakapan".', 'Footer button text, e.g. "Start a conversation".'),
  'Teks kolom "Terhubung"': h('Kalimat di kolom "Terhubung dengan kami" pada footer, di atas ikon media sosial.', 'Sentence in the footer "Connect with us" column, above the social icons.'),
  'Teks kolom "Hubungi kami"': h('Kalimat di kolom "Hubungi kami" pada footer, di atas tombol kontak.', 'Sentence in the footer "Contact us" column, above the contact button.'),
  'Catatan anak perusahaan': h('Keterangan induk usaha di footer, mis. "Anak perusahaan PTPN III (Persero)".', 'Parent company note in the footer.'),
  'Judul bawaan': h('Judul Google untuk halaman yang tidak mengatur SEO sendiri.', 'Google title for pages without their own SEO.'),
  'Deskripsi bawaan': h('Deskripsi Google untuk halaman yang tidak mengatur SEO sendiri.', 'Google description for pages without their own SEO.'),
  'Foto / video halaman login': h('Slide panel samping halaman login, daftar, dan lupa password (maks. 6). Kosong = foto bawaan.', 'Side-panel slides on the login, register and forgot-password pages (max 6). Empty = default photos.'),
  'Foto atau video': h('Pilih gambar (JPG/PNG/WebP) atau video MP4/WebM dari Media Library. Video diputar tanpa suara.', 'Pick an image or an MP4/WebM video from the Media Library. Videos play muted.'),
  'Teks di atas foto (opsional)': h('Kalimat pendek yang tampil di bagian bawah foto, mis. "Mutu teruji sejak 1965." Kosong = tanpa teks.', 'Short line shown at the bottom of the photo. Empty = no text.'),
  'Judul petunjuk': h('Nama dokumen/tautan petunjuk penggunaan yang tampil di panel admin.', 'Name of the admin guide document/link.'),
  'Tipe sumber': h('Tautan URL = arahkan ke alamat web. Unggah dokumen = berkas PDF.', 'URL = web address. Upload = PDF file.'),
  'Berkas petunjuk': h('Berkas PDF petunjuk penggunaan admin.', 'Admin guide PDF.'),
  'Nama lengkap': h('Nama pengguna admin yang tampil di panel dan Audit Log.', 'Admin user name shown in the panel and Audit Log.'),
  'Kata sandi': h('Minimal 8 karakter, gabungan huruf dan angka. Saat mengubah akun, kosongkan bila tidak ingin mengganti.', 'At least 8 characters with letters and digits. When editing, leave empty to keep it.'),
  'Hak akses modul': h('Menu yang boleh dibuka admin ini. Super admin otomatis bisa membuka semua menu.', 'Menus this admin may open. Super admins can open everything.'),
  'Role': h('Super admin = semua menu termasuk akun admin dan Audit Log. Admin = hanya modul yang dicentang.', 'Super admin = all menus incl. admin accounts and Audit Log. Admin = only ticked modules.'),
  'Isi laporan': h('Isi laporan WBS dari pelapor (hanya baca).', 'Whistleblowing report body (read-only).'),
  'Catatan admin (internal)': h('Catatan tindak lanjut untuk tim internal; tidak terlihat oleh pelapor.', 'Follow-up notes for the internal team; not visible to the reporter.'),
  'Label tombol': h('Teks pada tombol, mis. "Unduh SOP" atau "Hubungi kami".', 'Button text, e.g. "Download SOP" or "Contact us".'),
  'Berkas PDF baru': h('Unggah PDF baru untuk menggantikan dokumen lama.', 'Upload a new PDF to replace the old document.'),
  'Pesan': h('Isi pesan dari pengunjung (hanya baca).', 'Visitor message (read-only).'),
  'Provinsi': h('Pilih provinsi; daftar kabupaten/kota mengikuti pilihan ini.', 'Choose a province; regencies follow it.'),
  'Kabupaten/Kota': h('Pilih kabupaten/kota (opsional). Kosong = seluruh provinsi masuk zona.', 'Choose a regency/city (optional). Empty = the whole province.'),
  'Kecamatan': h('Pilih kecamatan (opsional) untuk zona yang sangat spesifik.', 'Choose a district (optional) for very specific zones.'),
  'Lat': h('Garis lintang (latitude). Terisi otomatis saat menandai titik di peta.', 'Latitude. Filled automatically when you pin the map.'),
  'Lng': h('Garis bujur (longitude). Terisi otomatis saat menandai titik di peta.', 'Longitude. Filled automatically when you pin the map.'),
};

// ---------------------------------------------------------------------------------------------
// Field section CMS (SectionDefinitions)
// ---------------------------------------------------------------------------------------------
const CMS: Record<string, HelpText> = {
  'Tampilan blok': h('Gaya pembungkus section: Polos = seperti biasa; Kartu timbul = dibungkus kartu bersudut bulat dengan bayangan halus; Pita berwarna = latar warna lembut selebar layar. Pakai kartu/pita secukupnya agar tetap menonjol, mis. selang-seling.', 'Section wrapper: Plain = as usual; Raised card = rounded card with a soft shadow; Tinted band = soft full-width colour. Use sparingly so it stands out.'),
  'Label kecil': h('Teks kecil berhuruf kapital di atas judul bagian, mis. "Tentang Kami". Opsional.', 'Small uppercase text above the section heading. Optional.'),
  'Judul bagian': h('Judul besar section ini. Opsional; kosong = section tampil tanpa judul.', 'Large heading of this section. Optional.'),
  'Teks': h('Teks yang tampil apa adanya.', 'Text shown as typed.'),
  'Paragraf pembuka': h('Kalimat pembuka di bawah judul halaman.', 'Intro paragraph under the page title.'),
  'Tampilkan breadcrumb': h('Tampilkan jejak navigasi (Beranda / Halaman) di atas judul.', 'Show the breadcrumb trail above the title.'),
  'Tata letak': h('Daftar baris = satu sertifikat per baris dengan logo kecil di kiri. Kartu lencana = kartu berjajar dengan logo besar, cocok bila semua sertifikat punya logo.', 'Rows = one certificate per row with a small logo on the left. Badge cards = side-by-side cards with a large logo, best when every certificate has a logo.'),
  'Tata letak media': h('Teks kiri, media kanan atau Media kiri, teks kanan = foto/video di samping teks (di ponsel teks tetap di atas). Media memenuhi latar = foto/video menjadi latar penuh.', 'Split / reversed split = media beside the text (text stays on top on phones). Cover = media fills the background.'),
  'Berkas (gambar atau video MP4/WebM)': h('Gambar atau video pendek dari Media Library. Video diputar tanpa suara dan berulang.', 'Image or short video from the Media Library. Videos play muted.'),
  'Keterangan (opsional)': h('Keterangan singkat di bawah/atas gambar.', 'Short caption for the image.'),
  'Detik per foto (video mengikuti durasinya)': h('Lama tiap foto tampil sebelum berganti (slideshow). Video berganti saat selesai diputar.', 'How long each photo shows before switching. Videos switch when they end.'),
  'Warna teks': h('Warna teks khusus (hex #rrggbb). Kosong = warna tema.', 'Custom text colour (#rrggbb). Empty = theme colour.'),
  'Judul (satu baris per baris judul)': h('Judul hero; setiap baris menjadi baris judul tersendiri.', 'Hero title; each line becomes its own title row.'),
  'Subjudul': h('Kalimat pendukung di bawah judul hero.', 'Supporting sentence under the hero title.'),
  'Gaya': h('Utama = tombol berwarna penuh. Garis = tombol bergaris (outline).', 'Primary = solid button. Outline = bordered button.'),
  'Buka dokumen profil perusahaan (dari Pengaturan Situs) bila tersedia': h('Tombol membuka PDF company profile dari Pengaturan Situs alih-alih tautan.', 'The button opens the company profile PDF instead of a link.'),
  'Buka di tab baru': h('Tautan dibuka di tab browser baru.', 'Open the link in a new browser tab.'),
  'Teks alternatif': h('Deskripsi gambar untuk pembaca layar dan SEO, mis. "Pabrik Resiprene tampak depan".', 'Image description for screen readers and SEO.'),
  'Teks alternatif foto': h('Deskripsi foto untuk pembaca layar dan SEO.', 'Photo description for screen readers and SEO.'),
  'Nilai': h('Angka yang ditonjolkan, mis. 60 atau 1.200. Boleh teks pendek seperti "ISO".', 'The highlighted figure, e.g. 60 or 1,200.'),
  'Keterangan': h('Penjelasan singkat di bawah angka/item.', 'Short description under the figure/item.'),
  'Ikon': h('Pilih ikon dari daftar. Pratinjau tampil di kiri pilihan.', 'Pick an icon from the list. A preview shows on the left.'),
  'Ikon (opsional)': h('Ikon pelengkap; kosongkan bila tidak perlu.', 'Optional icon.'),
  'Uraian': h('Penjelasan item. Pisahkan paragraf dengan baris kosong.', 'Item description. Separate paragraphs with a blank line.'),
  'Label tautan': h('Teks tautan/tombol, mis. "Selengkapnya".', 'Link/button text, e.g. "Read more".'),
  'Foto (opsional)': h('Foto pendukung dari Media Library.', 'Supporting photo from the Media Library.'),
  'Foto': h('Foto dari Media Library; potret untuk tim/testimoni, lanskap untuk kisi.', 'Photo from the Media Library.'),
  'Tautan detail': h('Halaman tujuan saat item diklik, mis. /bisnis#resiprene-35.', 'Destination when the item is clicked.'),
  'ID video YouTube': h('Tempel tautan YouTube atau ID videonya (mis. dQw4w9WgXcQ).', 'Paste a YouTube link or its video ID.'),
  'Teks pendek (opsional)': h('Kalimat pendek di bawah judul ajakan.', 'Short line under the call-to-action heading.'),
  'Tautan tombol': h('Alamat tujuan tombol utama.', 'Main button destination.'),
  'Label tombol kedua (opsional)': h('Teks tombol kedua; kosong = tombol kedua tidak tampil.', 'Second button text; empty = hidden.'),
  'Tautan tombol kedua': h('Alamat tujuan tombol kedua.', 'Second button destination.'),
  'Foto latar (opsional)': h('Foto latar blok; teks otomatis diberi lapisan gelap agar terbaca.', 'Background photo; a dark overlay keeps text readable.'),
  'Isi (pisahkan paragraf dengan baris kosong)': h('Isi teks. Baris kosong memisahkan paragraf.', 'Body text. A blank line separates paragraphs.'),
  'Posisi foto / panel': h('Letak foto atau panel di kiri atau kanan teks.', 'Whether the photo/panel sits left or right of the text.'),
  'Label panel / keterangan foto': h('Teks kecil pada panel atau keterangan foto.', 'Small text on the panel or photo caption.'),
  'Kata besar panel (tanpa foto)': h('Kata besar dekoratif pada panel bila tidak memakai foto, mis. "35".', 'Large decorative word on the panel when there is no photo.'),
  'Tahun (label pin)': h('Teks di dalam pin linimasa, mis. 1965 atau "2006 s.d. Sekarang".', 'Text inside the timeline pin, e.g. 1965.'),
  'Nama entitas / tahap (di atas pin)': h('Nama perusahaan/tahap pada periode itu, tampil sebagai judul kartu.', 'Company/stage name for that period, shown as the card title.'),
  'Periode / judul (baris pertama kotak)': h('Periode atau judul singkat di baris pertama kotak, mis. "1965–1968".', 'Period or short title on the first line of the box.'),
  'Produk': h('Produk yang dihasilkan pada periode tersebut (opsional).', 'Products made in that period (optional).'),
  'Tag visi': h('Label kecil di atas teks visi.', 'Small label above the vision.'),
  'Visi': h('Pernyataan visi perusahaan.', 'The company vision statement.'),
  'Tag misi': h('Label kecil di atas daftar misi.', 'Small label above the missions.'),
  'Nama nilai': h('Nama nilai perusahaan, mis. Amanah.', 'Company value name, e.g. Trustworthy.'),
  'Teks pengantar': h('Paragraf singkat di bawah judul section.', 'Short paragraph under the section heading.'),
  'Pengantar': h('Paragraf singkat di bawah judul section.', 'Short paragraph under the section heading.'),
  'Jumlah tingkat terbuka saat dimuat': h('Berapa tingkat bagan organisasi yang langsung terbuka saat halaman dibuka.', 'How many org-chart levels are expanded on load.'),
  'Kunci unik': h('Kode unik simpul (mis. dirut). Dipakai sebagai acuan "kunci induk" simpul lain.', 'Unique node code, referenced by other nodes as parent.'),
  'Kunci induk (kosong = puncak)': h('Kunci unik atasan langsung jabatan ini. Kosong = puncak bagan.', 'Unique key of the direct superior. Empty = top of the chart.'),
  'Nama pejabat (opsional)': h('Nama orang yang menjabat; kosongkan bila tidak ingin ditampilkan.', 'Holder name; leave empty to hide.'),
  'Tingkat (warna & legenda)': h('Tingkat jabatan yang menentukan warna kotak dan legenda bagan.', 'Level that sets the box colour and legend.'),
  'Titik peta': h('Klik peta atau cari alamat untuk menandai lokasi; dipakai peta di halaman Kontak dan footer.', 'Click the map or search to pin the location for the Contact page and footer maps.'),
  'Foto latar blok kontak (opsional)': h('Foto latar band kontak; kosong = gradasi warna tema.', 'Contact band background; empty = theme gradient.'),
  'Alamat email': h('Alamat email yang tampil dan bisa diklik.', 'Email address shown as a clickable link.'),
  'Platform': h('Nama platform media sosial, mis. Instagram, YouTube, TikTok. Ikon dipilih otomatis dari nama/URL.', 'Social platform name; the icon is chosen from the name/URL.'),
  'Akun': h('Nama akun yang tampil, mis. @ikn.rubber.', 'Displayed handle, e.g. @ikn.rubber.'),
  'Judul sukses': h('Judul yang tampil setelah formulir terkirim.', 'Heading shown after the form is sent.'),
  'Teks sukses': h('Pesan yang tampil setelah formulir terkirim.', 'Message shown after the form is sent.'),
  'Kunci (anchor)': h('Pengenal untuk tautan langsung ke item ini, mis. "lingkungan" → #lingkungan.', 'Identifier for direct links to this item.'),
  'Teks bila kosong': h('Teks yang tampil bila belum ada data.', 'Text shown when there is no data.'),
  'Label foto': h('Nama tab foto pada galeri.', 'Photo tab name in the gallery.'),
  'Label video': h('Nama tab video pada galeri.', 'Video tab name in the gallery.'),
  'Jumlah berita (1-6, bawaan 3)': h('Banyaknya berita terbaru yang ditampilkan.', 'How many latest posts to show.'),
  'Tautan (bawaan /berita)': h('Tujuan tautan "lihat semua"; kosong = /berita.', '"See all" link target; empty = /berita.'),
  'Jumlah kolom (layar lebar)': h('Banyaknya kolom di layar komputer. Di ponsel otomatis 1–2 kolom.', 'Number of columns on wide screens. Phones use 1–2.'),
  'Gaya ikon': h('Lingkaran garis, lingkaran berwarna lembut, lingkaran warna tema, atau ikon tanpa lingkaran.', 'Outlined circle, soft circle, theme-colour circle, or no circle.'),
  'Perataan': h('Teks dan ikon rata tengah atau rata kiri.', 'Centre or left alignment.'),
  'Gambar ikon (opsional, menggantikan ikon)': h('Unggah ikon sendiri (PNG/SVG/JPG, latar transparan) bila ikon yang dibutuhkan tidak ada di daftar.', 'Upload your own icon if the needed one is not in the list.'),
  'Pertanyaan': h('Pertanyaan yang sering ditanyakan.', 'The frequently asked question.'),
  'Jawaban': h('Jawaban yang muncul saat pertanyaan dibuka.', 'Answer shown when the question is opened.'),
  'Parameter': h('Nama parameter spesifikasi, mis. Softening point.', 'Specification parameter name.'),
  'Catatan kaki (opsional)': h('Catatan kecil di bawah tabel, mis. metode uji.', 'Small note under the table.'),
  'Profil singkat': h('2–3 kalimat profil orang tersebut.', 'A 2–3 sentence profile.'),
  'Kutipan': h('Isi testimoni pelanggan.', 'The customer testimonial.'),
  'Perusahaan': h('Nama perusahaan pemberi testimoni.', 'Company of the testimonial author.'),
  'Isi': h('Isi teks section. Gunakan bilah format untuk judul, daftar, dan tautan.', 'Section body. Use the toolbar for headings, lists, links.'),
  'Foto / video': h('Daftar media yang ditampilkan bergantian.', 'Media shown in rotation.'),
  'Label meta': h('Label kecil di atas judul hero, mis. "Sejak 1965".', 'Small labels above the hero title.'),
  'Tombol': h('Tombol ajakan (maksimal 2).', 'Call-to-action buttons (max 2).'),
  'Foto latar': h('Foto latar yang berganti otomatis.', 'Rotating background photos.'),
  'Kata': h('Kata/frasa yang berjalan.', 'Scrolling words/phrases.'),
  'Angka': h('Daftar angka kunci (maks. 8).', 'Key figures (max 8).'),
  'Keunggulan': h('Daftar keunggulan berikon.', 'Icon feature rows.'),
  'Video': h('Daftar video YouTube.', 'YouTube videos.'),
  'Tonggak': h('Peristiwa sejarah berurutan dari yang paling lama.', 'History milestones from oldest.'),
  'Butir misi': h('Satu butir = satu poin misi.', 'One item = one mission point.'),
  'Simpul (jabatan)': h('Daftar jabatan pada bagan organisasi (maks. 300).', 'Positions in the org chart.'),
  'Lokasi': h('Daftar kantor/pabrik beserta alamat dan titik peta.', 'Offices/plants with address and map pin.'),
  'Telepon': h('Nomor telepon yang tampil.', 'Phone numbers shown.'),
  'Media sosial': h('Akun media sosial perusahaan.', 'Company social accounts.'),
  'Kartu': h('Daftar kartu (maks. 8).', 'Cards (max 8).'),
  'Pilar': h('Daftar pilar/kategori.', 'Pillars.'),
  'Poin': h('Satu baris = satu poin.', 'One line = one point.'),
  'Blok': h('Daftar blok informasi.', 'Information blocks.'),
  'Langkah': h('Langkah berurutan (maks. 8).', 'Sequential steps (max 8).'),
  'Fitur': h('Item fitur berikon (maks. 8).', 'Icon features (max 8).'),
  'Baris': h('Baris tabel spesifikasi.', 'Specification rows.'),
  'Orang': h('Daftar orang/tim.', 'People.'),
  'Testimoni': h('Daftar testimoni.', 'Testimonials.'),
};

/** Kamus utama: label ID → penjelasan. */
export const FIELD_HELP: Record<string, HelpText> = { ...COMMON, ...COMMERCE, ...CATALOG, ...STORE_SETTINGS, ...CONTENT, ...CMS };

/** Label yang maknanya berbeda per halaman: awalan path → label ID → penjelasan. */
export const ROUTE_HELP: Record<string, Record<string, HelpText>> = {
  '/admin/additional-fees': {
    'Jenis': h('Biaya admin atau biaya lain; hanya untuk pengelompokan di laporan.', 'Admin fee or other fee; only for grouping in reports.'),
    'Urutan': h('Urutan baris biaya di ringkasan checkout dan invoice.', 'Order of fee lines in checkout and invoice.'),
  },
  '/admin/payment-methods': {
    'Jenis': h('Transfer manual dan QRIS statis diverifikasi admin; QRIS dinamis, virtual account, dan e-wallet lewat payment gateway.', 'Manual transfer and static QRIS are admin-verified; dynamic QRIS, VA and e-wallet go through the gateway.'),
    'Kode': h('Kode teknis metode bayar (huruf kecil), mis. manual_transfer. Jangan diubah setelah dipakai order.', 'Technical method code. Do not change after orders use it.'),
  },
  '/admin/product-categories': {
    'Deskripsi': h('Penjelasan kategori di halaman katalog (opsional).', 'Category description on the catalog (optional).'),
  },
  '/admin/news-categories': {
    'Nama': h('Nama kategori berita yang tampil sebagai chip filter di halaman Berita.', 'News category name shown as a filter chip.'),
  },
  '/admin/news': {
    'Uraian': h('Isi artikel. Gunakan judul (H2/H3), daftar, gambar, dan tautan dari bilah format. Tempel teks dari Word akan dibersihkan otomatis.', 'Article body. Use headings, lists, images and links from the toolbar. Pasted Word text is cleaned automatically.'),
  },
  '/admin/gallery': {
    'Jenis': h('Foto = unggah gambar. Video = tempel tautan YouTube.', 'Photo = upload an image. Video = paste a YouTube link.'),
    'Judul': h('Judul foto/video yang tampil saat diperbesar.', 'Title shown in the lightbox.'),
    'Gambar': h('Foto galeri (lanskap disarankan).', 'Gallery photo (landscape recommended).'),
  },
  '/admin/whistleblowing': {
    'Status': h('Tahap tindak lanjut laporan: baru, diproses, selesai, atau ditolak.', 'Follow-up stage of the report.'),
  },
  '/admin/customers': {
    'Catatan (opsional)': h('Catatan internal yang tersimpan di riwayat akun customer.', 'Internal note stored in the account history.'),
  },
  '/admin/payments': {
    'Alasan penolakan': h('Wajib. Dikirim ke customer (email + notifikasi) dan tampil di pesanannya, mis. "Nominal kurang Rp 50.000". Customer lalu mengunggah ulang bukti.', 'Required. Sent to the customer and shown on the order. The customer then re-uploads the proof.'),
  },
  '/admin/site-settings': {
    'Lokasi': h('Kota dan provinsi perusahaan, mis. "Medan, Sumatera Utara". Tampil di footer dan dipakai sebagai kota pada tanggal invoice.', 'Company city and province, e.g. "Medan, North Sumatra". Shown in the footer and used as the invoice city.'),
  },
  '/admin/shipping': {
    'Urutan tampil': h('Urutan layanan pada pilihan pengiriman di checkout.', 'Service order in the checkout shipping list.'),
  },
};

/** Label versi Inggris → kunci Indonesia (agar penjelasan tetap ditemukan saat admin memakai bahasa EN). */
export const EN_ALIAS: Record<string, string> = {};

const EN_PAIRS: [string, string][] = [
  ['Name', 'Nama'], ['Title', 'Judul'], ['Description', 'Deskripsi'], ['Short description', 'Deskripsi singkat'], ['Order', 'Urutan'],
  ['Display order', 'Urutan tampil'], ['Category', 'Kategori'], ['Image', 'Gambar'], ['Code', 'Kode'], ['Note', 'Catatan'],
  ['Note (optional)', 'Catatan (opsional)'], ['Position', 'Jabatan'], ['Address', 'Alamat'], ['Location name', 'Nama lokasi'],
  ['Summary', 'Ringkasan'], ['Unit', 'Satuan'], ['Rejection reason', 'Alasan penolakan'], ['Type', 'Jenis'],
  ['Add a shipping note', 'Tambah catatan perjalanan'], ['Cancellation reason', 'Alasan pembatalan'], ['Courier', 'Kurir / ekspedisi'],
  ['Tracking number', 'Nomor resi'], ['Attachments for the customer (optional)', 'Lampiran untuk customer (opsional)'],
  ['Extend by', 'Perpanjang selama'], ['New deadline', 'Batas bayar baru'], ['Product code', 'Kode produk'], ['Product name', 'Nama produk'],
  ['Kind / material', 'Jenis / material'], ['Search aliases', 'Kata kunci pencarian (alias)'], ['Pricing mode', 'Mode harga'],
  ['Price (Rp, before promo)', 'Harga (Rp, sebelum promo)'], ['Promo price (Rp)', 'Harga promo (Rp)'], ['Promo starts', 'Promo mulai'],
  ['Promo ends', 'Promo berakhir'], ['Package length (cm)', 'Panjang kemasan (cm)'], ['Package width (cm)', 'Lebar kemasan (cm)'],
  ['Package height (cm)', 'Tinggi kemasan (cm)'], ['Weight per unit (gram)', 'Berat per satuan (gram)'], ['Stock status', 'Status stok'],
  ['Highlights (one per line)', 'Keunggulan (satu baris per poin)'], ['Applications (one per line)', 'Aplikasi / penggunaan (satu baris per item)'],
  ['Product photos & videos (order = swipe order on the product page)', 'Foto & video produk (urutan = urutan geser di halaman produk)'],
  ['Movement type', 'Jenis mutasi'], ['Quantity', 'Jumlah'], ['Category name', 'Nama kategori'], ['Category image', 'Gambar kategori'],
  ['Road factor', 'Faktor jalan'], ['Coverage', 'Cakupan wilayah'], ['Priority', 'Prioritas'], ['Zone name', 'Nama zona'],
  ['Service name', 'Nama layanan'], ['Rate type', 'Jenis tarif'], ['Base amount (Rp)', 'Tarif dasar (Rp)'], ['Flat rate (Rp)', 'Tarif tetap (Rp)'],
  ['Minimum charge (Rp)', 'Ongkir minimum (Rp)'], ['Per km of distance (Rp)', 'Per km jarak (Rp)'], ['Per kg of weight (Rp)', 'Per kg berat (Rp)'],
  ['Per m³ of volume (Rp)', 'Per m³ volume (Rp)'], ['Free shipping above subtotal (Rp)', 'Gratis ongkir di atas subtotal (Rp)'],
  ['Delivery estimate', 'Estimasi sampai'], ['Voucher code', 'Kode voucher'], ['Discount type', 'Jenis diskon'],
  ['Minimum subtotal (Rp)', 'Minimum subtotal (Rp)'], ['Maximum discount (Rp)', 'Maksimum diskon (Rp)'], ['Total quota', 'Kuota total'],
  ['Limit per customer', 'Batas per customer'], ['Starts at', 'Mulai berlaku'], ['Ends at', 'Berakhir'], ['Scope', 'Cakupan'],
  ['Applies to', 'Berlaku untuk'], ['Fee name', 'Nama biaya'], ['Amount (Rp)', 'Nominal (Rp)'], ['Charged to', 'Dibebankan ke'],
  ['Bank name', 'Nama bank'], ['Account number', 'Nomor rekening'], ['Account holder', 'Atas nama'], ['Display name', 'Nama tampil'],
  ['Payment instructions', 'Instruksi pembayaran'], ['QRIS code image', 'Gambar kode QRIS'],
  ['Gateway configuration (non-secret)', 'Konfigurasi gateway (non-rahasia)'], ['Gateway fee (%)', 'Biaya gateway (%)'],
  ['Fixed gateway fee (Rp)', 'Biaya gateway tetap (Rp)'], ['Invoice number prefix', 'Awalan nomor invoice'], ['Signatory name', 'Nama penanda tangan'],
  ['Signatory title', 'Jabatan penanda tangan'], ['Copies (cc)', 'Tembusan (cc)'], ['Page title', 'Judul halaman'], ['SEO title', 'SEO: judul'],
  ['SEO description', 'SEO: deskripsi'], ['Section key', 'Kunci section (key)'], ['Publish date', 'Tanggal terbit'], ['Author', 'Penulis'],
  ['Excerpt', 'Ringkasan (excerpt)'], ['Body', 'Uraian'], ['YouTube URL or video ID', 'URL atau ID video YouTube'],
  ['Brochure title', 'Judul brosur'], ['Brochure file (PDF)', 'Berkas brosur (PDF)'], ['Certificate name', 'Nama sertifikat'],
  ['Scope / standard', 'Materi / standar'], ['Certificate file (PDF)', 'Berkas sertifikat (PDF)'], ['Customer name', 'Nama pelanggan'],
  ['Website link (optional)', 'Tautan situs (opsional)'], ['Logo (optional)', 'Logo (opsional)'], ['Category (parent menu)', 'Kategori (menu induk)'],
  ['Link source', 'Sumber tautan'], ['Document file', 'Berkas dokumen'], ['Key', 'Kunci (key)'],
  ['WhatsApp Business number', 'Nomor WhatsApp Business'], ['Other marketing WhatsApp numbers (optional)', 'Nomor WhatsApp marketing lainnya (opsional)'],
  ['Team / person', 'Nama tim / orang'], ['Number', 'Nomor'], ['WhatsApp opening message', 'Pesan awal WhatsApp'],
  ['Google Analytics ID (GA4)', 'ID Google Analytics (GA4)'], ['Google Search Console verification token', 'Token verifikasi Google Search Console'],
  ['Company profile document (PDF)', 'Dokumen profil perusahaan (PDF)'], ['Footer headline', 'Judul footer'], ['CTA button label', 'Label tombol ajakan'],
  ['Subsidiary note', 'Catatan anak perusahaan'], ['Certificate logo', 'Logo sertifikat'], ['Layout', 'Tata letak'], ['"Connect" column text', 'Teks kolom "Terhubung"'], ['"Contact us" column text', 'Teks kolom "Hubungi kami"'], ['Default title', 'Judul bawaan'], ['Default description', 'Deskripsi bawaan'],
  ['Guide title', 'Judul petunjuk'], ['Source type', 'Tipe sumber'], ['URL link', 'Tautan URL'], ['Guide document', 'Berkas petunjuk'],
  ['Full name', 'Nama lengkap'], ['Password', 'Kata sandi'], ['Module permissions', 'Hak akses modul'], ['Report body', 'Isi laporan'],
  ['Admin notes (internal)', 'Catatan admin (internal)'], ['Button label', 'Label tombol'], ['New PDF file', 'Berkas PDF baru'], ['Message', 'Pesan'],
  ['Province', 'Provinsi'], ['Regency/City', 'Kabupaten/Kota'], ['District', 'Kecamatan'],
  ['Eyebrow label', 'Label kecil'], ['Section heading', 'Judul bagian'], ['Text', 'Teks'], ['Lead paragraph', 'Paragraf pembuka'],
  ['Show breadcrumb', 'Tampilkan breadcrumb'], ['Media layout', 'Tata letak media'], ['File (image or MP4/WebM video)', 'Berkas (gambar atau video MP4/WebM)'],
  ['Caption (optional)', 'Keterangan (opsional)'], ['Seconds per photo (videos run for their length)', 'Detik per foto (video mengikuti durasinya)'],
  ['Text colour', 'Warna teks'], ['Title (one line per title row)', 'Judul (satu baris per baris judul)'], ['Subtitle', 'Subjudul'], ['URL', 'URL'],
  ['Style', 'Gaya'], ['Open in a new tab', 'Buka di tab baru'], ['Alt text', 'Teks alternatif'], ['Value', 'Nilai'], ['Label', 'Keterangan'],
  ['Icon', 'Ikon'], ['Link label', 'Label tautan'], ['Photo (optional)', 'Foto (opsional)'], ['Detail URL', 'Tautan detail'],
  ['YouTube video ID', 'ID video YouTube'], ['Short text (optional)', 'Teks pendek (opsional)'], ['Button URL', 'Tautan tombol'],
  ['Second button label (optional)', 'Label tombol kedua (opsional)'], ['Second button URL', 'Tautan tombol kedua'],
  ['Background photo (optional)', 'Foto latar (opsional)'], ['Body (blank line between paragraphs)', 'Isi (pisahkan paragraf dengan baris kosong)'],
  ['Photo alt text', 'Teks alternatif foto'], ['Photo / panel position', 'Posisi foto / panel'], ['Panel label / photo caption', 'Label panel / keterangan foto'],
  ['Panel big word (no photo)', 'Kata besar panel (tanpa foto)'], ['Year (pin label)', 'Tahun (label pin)'],
  ['Entity / stage name (above the pin)', 'Nama entitas / tahap (di atas pin)'], ['Period / title (first line of the box)', 'Periode / judul (baris pertama kotak)'],
  ['Products', 'Produk'], ['Vision tag', 'Tag visi'], ['Vision', 'Visi'], ['Mission tag', 'Tag misi'], ['Value name', 'Nama nilai'],
  ['Lead text', 'Teks pengantar'], ['Levels expanded on load', 'Jumlah tingkat terbuka saat dimuat'], ['Unique key', 'Kunci unik'],
  ['Parent key (empty = top)', 'Kunci induk (kosong = puncak)'], ['Holder name (optional)', 'Nama pejabat (opsional)'],
  ['Level (colour & legend)', 'Tingkat (warna & legenda)'], ['Map point', 'Titik peta'],
  ['Contact block background photo (optional)', 'Foto latar blok kontak (opsional)'], ['Email address', 'Alamat email'], ['Handle', 'Akun'],
  ['Icon (optional)', 'Ikon (opsional)'], ['Success title', 'Judul sukses'], ['Success text', 'Teks sukses'], ['Key (anchor)', 'Kunci (anchor)'],
  ['Intro', 'Pengantar'], ['Empty text', 'Teks bila kosong'], ['Photos label', 'Label foto'], ['Videos label', 'Label video'],
  ['Number of posts (1-6, default 3)', 'Jumlah berita (1-6, bawaan 3)'], ['Link URL (default /berita)', 'Tautan (bawaan /berita)'],
  ['Columns (wide screens)', 'Jumlah kolom (layar lebar)'], ['Icon style', 'Gaya ikon'], ['Alignment', 'Perataan'],
  ['Icon image (optional, replaces the icon)', 'Gambar ikon (opsional, menggantikan ikon)'], ['Question', 'Pertanyaan'], ['Answer', 'Jawaban'],
  ['Footnote (optional)', 'Catatan kaki (opsional)'], ['Short profile', 'Profil singkat'], ['Quote', 'Kutipan'], ['Company', 'Perusahaan'],
  ['Photo', 'Foto'], ['Photos / videos', 'Foto / video'], ['Meta labels', 'Label meta'], ['Buttons', 'Tombol'], ['Background photos', 'Foto latar'],
  ['Words', 'Kata'], ['Figures', 'Angka'], ['Items', 'Keunggulan'], ['Videos', 'Video'], ['Milestones', 'Tonggak'], ['Mission points', 'Butir misi'],
  ['Nodes (positions)', 'Simpul (jabatan)'], ['Locations', 'Lokasi'], ['Phones', 'Telepon'], ['Social media', 'Media sosial'], ['Cards', 'Kartu'],
  ['Pillars', 'Pilar'], ['Points', 'Poin'], ['Blocks', 'Blok'], ['Steps', 'Langkah'], ['Features', 'Fitur'], ['Rows', 'Baris'], ['People', 'Orang'],
  ['Testimonials', 'Testimoni'], ['Block style', 'Tampilan blok'], ['Login page photos / videos', 'Foto / video halaman login'], ['Photo or video', 'Foto atau video'], ['Caption on the photo (optional)', 'Teks di atas foto (opsional)'], ['Technical specifications', 'Spesifikasi teknis'], ['Solubility', 'Kelarutan (solubility)'],
  ['Simulation', 'Simulasi'], ['Percentage (%)', 'Persentase (%)'], ['Payment deadline', 'Batas waktu pembayaran'],
  ['Reminder before deadline', 'Pengingat sebelum batas bayar'], ['VAT rate', 'Tarif PPN'], ['Auto-complete after delivery', 'Selesai otomatis setelah diterima'],
  ['Company name', 'Nama perusahaan'], ['Short name', 'Nama singkat'], ['Parent company', 'Induk perusahaan'], ['Established', 'Berdiri sejak'],
  ['Primary colour', 'Warna utama'], ['Location', 'Lokasi'], ['Deep colour', 'Warna gelap'], ['Accent colour', 'Warna aksen'],
];
for (const [en, id] of EN_PAIRS) EN_ALIAS[en.toLowerCase()] = id;

const normalize = (label: string) =>
  label
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Cari penjelasan untuk label field pada path admin tertentu. Urutan: penjelasan khusus halaman, kamus umum,
 * lalu tanpa akhiran dalam kurung (mis. "Jumlah (pcs)" → "Jumlah"). Label EN dipetakan ke kunci ID dulu.
 */
export function findFieldHelp(rawLabel: string, pathname: string): HelpText | null {
  const label = normalize(rawLabel);
  if (!label) return null;
  const candidates = [label, EN_ALIAS[label.toLowerCase()]].filter(Boolean) as string[];
  const stripped = label.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (stripped && stripped !== label) candidates.push(stripped, EN_ALIAS[stripped.toLowerCase()] ?? '');
  const routes = Object.keys(ROUTE_HELP)
    .filter((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
    .sort((a, b) => b.length - a.length);
  for (const key of candidates) {
    if (!key) continue;
    for (const prefix of routes) {
      const hit = ROUTE_HELP[prefix]?.[key];
      if (hit) return hit;
    }
    if (FIELD_HELP[key]) return FIELD_HELP[key];
  }
  return null;
}
