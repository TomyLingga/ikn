<?php

// Teks notifikasi dalam aplikasi (lonceng portal customer dan panel admin) dan pesan area notifikasi/chat.
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
            'body' => 'Bukti pembayaran pesanan :number ditolak: :reason. Unggah ulang bukti yang benar.',
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
        'processing' => [
            'title' => 'Pesanan diproses',
            'body' => 'Pesanan :number sedang kami siapkan.',
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
            'body' => 'Kami melampirkan ":label" pada pesanan :number.',
        ],
        'tracking' => [
            'title' => 'Kabar pengiriman',
            'body' => 'Pesanan :number: :note',
        ],
        'delivered' => [
            'title' => 'Pesanan diterima',
            'body' => 'Pesanan :number sudah sampai. Konfirmasi selesai bila barang sesuai.',
        ],
        // Termin (ASUMSI A-97): pesanan tidak bisa diselesaikan selama ada termin belum lunas.
        'delivered_balance_due' => [
            'title' => 'Pesanan diterima',
            'body' => 'Pesanan :number sudah sampai. Pesanan diselesaikan setelah sisa tagihan :outstanding lunas.',
        ],
        'picked_up_balance_due' => [
            'title' => 'Pesanan sudah diambil',
            'body' => 'Pesanan :number tercatat sudah diambil. Pesanan diselesaikan setelah sisa tagihan :outstanding lunas.',
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
        // Termin pembayaran (ASUMSI A-97).
        'installment_due' => [
            'title' => 'Tagihan termin',
            'body' => ':label sebesar :amount untuk pesanan :number sudah bisa dibayar. Jatuh tempo :due.',
        ],
        'installment_due_changed' => [
            'title' => 'Jatuh tempo termin diubah',
            'body' => 'Jatuh tempo :label pesanan :number kini :due.',
        ],
        'installment_reminder' => [
            'title' => 'Pengingat pembayaran termin',
            'body' => ':label sebesar :amount untuk pesanan :number jatuh tempo :due.',
        ],
        'installment_overdue' => [
            'title' => 'Termin melewati jatuh tempo',
            'body' => ':label sebesar :amount untuk pesanan :number melewati jatuh tempo :due. Mohon segera dibayar.',
        ],
        'installment_paid' => [
            'title' => 'Pembayaran termin diterima',
            'body' => 'Pembayaran :label pesanan :number sudah diverifikasi. Sisa tagihan :outstanding.',
        ],
        'installment_rejected' => [
            'title' => 'Bukti pembayaran ditolak',
            'body' => 'Bukti pembayaran :label pesanan :number ditolak: :reason. Unggah ulang bukti yang benar.',
        ],
        'fully_paid' => [
            'title' => 'Pesanan lunas',
            'body' => 'Pembayaran :label pesanan :number sudah diverifikasi. Seluruh tagihan sudah lunas.',
        ],
    ],
    'account' => [
        'approved' => [
            'title' => 'Akun disetujui',
            'body' => 'Akun Anda sudah aktif. Sekarang Anda bisa membuat pesanan.',
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
    // Lonceng panel admin: penerima = admin aktif yang punya modulnya (InAppNotifier::admins).
    'admin' => [
        'order_placed' => [
            'title' => 'Pesanan baru',
            'body' => ':customer membuat pesanan :number senilai :total.',
        ],
        'freight_requested' => [
            'title' => 'Pesanan baru, perlu penawaran ongkir',
            'body' => 'Pesanan :number dari :customer ke :port menunggu penawaran ongkir.',
        ],
        'payment_proof' => [
            'title' => 'Bukti bayar masuk',
            'body' => ':customer mengunggah bukti bayar pesanan :number. Periksa lalu verifikasi.',
        ],
        'payment_proof_installment' => [
            'title' => 'Bukti bayar termin masuk',
            'body' => ':customer mengunggah bukti bayar :label pesanan :number. Periksa lalu verifikasi.',
        ],
        'freight_countered' => [
            'title' => 'Harga balasan ongkir',
            'body' => ':customer mengajukan ongkir :total untuk pesanan :number.',
        ],
        'freight_accepted' => [
            'title' => 'Penawaran ongkir disetujui',
            'body' => ':customer menyetujui ongkir :total untuk pesanan :number. Pesanan menunggu pembayaran.',
        ],
        'freight_expired' => [
            'title' => 'Penawaran ongkir kedaluwarsa',
            'body' => 'Penawaran ongkir putaran :round untuk pesanan :number belum dijawab :customer. Perpanjang atau kirim penawaran baru.',
        ],
        'order_cancelled' => [
            'title' => 'Pesanan dibatalkan customer',
            'body' => ':customer membatalkan pesanan :number.',
        ],
        'order_received' => [
            'title' => 'Pesanan diterima customer',
            'body' => ':customer mengonfirmasi pesanan :number sudah diterima.',
        ],
        'order_completed' => [
            'title' => 'Pesanan diselesaikan customer',
            'body' => ':customer menyelesaikan pesanan :number.',
        ],
        'customer_registered' => [
            'title' => 'Pendaftaran customer baru',
            'body' => ':who mendaftar dan menunggu persetujuan.',
        ],
    ],

    'tracking_not_allowed' => 'Catatan perjalanan hanya bisa diubah saat order berstatus dikirim.',
    'chat_context_invalid' => 'Produk atau pesanan yang dirujuk tidak ditemukan.',
    'chat_customer_invalid' => 'Customer tidak ditemukan.',
    'chat_edit_window_passed' => 'Pesan hanya bisa diedit atau ditarik dalam :seconds detik setelah dikirim. Batas waktunya sudah lewat.',
    'chat_message_retracted' => 'Pesan ini sudah ditarik.',
    'chat_message_not_yours' => 'Anda hanya bisa mengedit atau menarik pesan yang Anda kirim sendiri.',

    'attributes' => [
        'note' => 'catatan',
        'body' => 'pesan',
        'customerId' => 'customer',
    ],
];
