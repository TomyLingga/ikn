<?php

// Teks notifikasi dalam aplikasi (lonceng portal customer) dan pesan area notifikasi/chat.
return [
    'order' => [
        'placed' => [
            'title' => 'Pesanan dibuat',
            'body' => 'Pesanan :number menunggu pembayaran. Selesaikan sebelum batas waktu.',
        ],
        'payment_accepted' => [
            'title' => 'Pembayaran diterima',
            'body' => 'Pembayaran pesanan :number sudah diverifikasi. Pesanan segera kami proses.',
        ],
        'payment_rejected' => [
            'title' => 'Bukti pembayaran ditolak',
            'body' => 'Bukti pembayaran pesanan :number ditolak: :reason. Silakan unggah ulang.',
        ],
        'payment_reminder' => [
            'title' => 'Segera selesaikan pembayaran',
            'body' => 'Batas waktu pembayaran pesanan :number hampir habis.',
        ],
        'expired' => [
            'title' => 'Pesanan kedaluwarsa',
            'body' => 'Pesanan :number dibatalkan otomatis karena melewati batas waktu pembayaran.',
        ],
        'cancelled' => [
            'title' => 'Pesanan dibatalkan',
            'body' => 'Pesanan :number dibatalkan.',
        ],
        'shipped' => [
            'title' => 'Pesanan dikirim',
            'body' => 'Pesanan :number dikirim via :courier, resi :tracking.',
        ],
        'ready_for_pickup' => [
            'title' => 'Pesanan siap diambil',
            'body' => 'Pesanan :number siap diambil di :label.',
        ],
        'shipped_on_board' => [
            'title' => 'Pesanan dimuat ke kapal',
            'body' => 'Pesanan :number dimuat ke kapal :vessel, B/L :bl.',
        ],
        'proforma_updated' => [
            'title' => 'Proforma invoice diperbarui',
            'body' => 'Proforma invoice :label untuk pesanan :number tersedia di halaman pesanan.',
        ],
        'picked_up' => [
            'title' => 'Pesanan sudah diambil',
            'body' => 'Pesanan :number tercatat sudah diambil. Konfirmasi selesai bila barang sesuai.',
        ],
        'attachment' => [
            'title' => 'Dokumen pesanan baru',
            'body' => 'Admin melampirkan ":label" pada pesanan :number.',
        ],
        'tracking' => [
            'title' => 'Update pengiriman',
            'body' => 'Pesanan :number: :note',
        ],
        'delivered' => [
            'title' => 'Pesanan diterima',
            'body' => 'Pesanan :number sudah sampai. Konfirmasi selesai bila barang sesuai.',
        ],
        'completed' => [
            'title' => 'Pesanan selesai',
            'body' => 'Pesanan :number selesai. Bagikan pengalaman Anda lewat ulasan.',
        ],
        // Penawaran ongkir CIF (ASUMSI A-89).
        'freight_requested' => [
            'title' => 'Pesanan diterima, menunggu ongkir',
            'body' => 'Pesanan :number ke :port menunggu penawaran ongkir dari tim kami.',
        ],
        'freight_quoted' => [
            'title' => 'Penawaran ongkir tersedia',
            'body' => 'Penawaran ongkir :total untuk pesanan :number berlaku sampai :until. Setujui atau ajukan harga balasan.',
        ],
        'freight_quote_extended' => [
            'title' => 'Masa berlaku penawaran diperpanjang',
            'body' => 'Penawaran ongkir :total untuk pesanan :number kini berlaku sampai :until.',
        ],
        'freight_accepted' => [
            'title' => 'Ongkir disepakati',
            'body' => 'Ongkir :total untuk pesanan :number disepakati. Selesaikan pembayaran sebelum batas waktu.',
        ],
        'freight_expired' => [
            'title' => 'Penawaran ongkir kedaluwarsa',
            'body' => 'Penawaran ongkir putaran :round untuk pesanan :number melewati masa berlaku. Tim kami akan memperbaruinya.',
        ],
        'freight_cancelled' => [
            'title' => 'Pesanan dibatalkan',
            'body' => 'Pesanan :number dibatalkan otomatis karena melewati batas tunggu penawaran ongkir.',
        ],
    ],
    'account' => [
        'approved' => [
            'title' => 'Akun disetujui',
            'body' => 'Akun Anda sudah aktif. Anda sekarang dapat membuat pesanan.',
        ],
        'rejected' => [
            'title' => 'Pendaftaran ditolak',
            'body' => 'Pendaftaran akun Anda ditolak: :reason',
        ],
    ],
    'voucher' => [
        'assigned' => [
            'title' => 'Voucher baru untuk Anda',
            'body' => 'Gunakan kode :code saat checkout.',
        ],
    ],

    'tracking_not_allowed' => 'Catatan perjalanan hanya dapat diubah saat pesanan berstatus dikirim.',
    'chat_context_invalid' => 'Produk atau pesanan yang dirujuk tidak ditemukan.',
    'chat_customer_invalid' => 'Customer tidak ditemukan.',

    'attributes' => [
        'note' => 'catatan',
        'body' => 'pesan',
        'customerId' => 'customer',
    ],
];
