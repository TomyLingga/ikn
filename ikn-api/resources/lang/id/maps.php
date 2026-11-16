<?php

// Penyedia tile peta (ASUMSI A-98): pesan validasi pengaturan grup maps dan hasil tombol "Uji".
return [
    'tile_url_invalid' => ':attribute harus diawali https:// dan memuat {z}, {x}, dan {y}. Placeholder lain yang diterima hanya {s} dan {r}.',
    'google_key_required' => 'API key Google Maps wajib diisi untuk penyedia Google.',
    'custom_required' => 'Isi sedikitnya satu URL tile (peta jalan atau citra satelit).',

    'test_ok' => 'Penyedia peta menjawab dengan benar.',
    'test_failed' => 'Penyedia peta belum bisa dipakai. Lihat rincian per lapisan.',

    'default_ok' => 'Peta bawaan (:name) tidak memerlukan API key.',
    'unreachable' => 'Server tidak bisa menghubungi :host. Periksa koneksi internet server.',
    'not_an_image' => 'Jawaban penyedia bukan gambar tile. Periksa URL atau API key.',

    'google_key_missing' => 'API key Google Maps belum diisi.',
    'google_ok' => 'Token sesi dibuat dan tile contoh diterima. Token berlaku sampai :until dan diperbarui otomatis.',
    'google_rejected' => 'Google menolak permintaan: :reason',
    'google_bad_response' => 'Jawaban Google tidak memuat token sesi.',

    'custom_ok' => 'Tile contoh diterima dari :host.',
    'custom_blank' => 'URL kosong: lapisan ini memakai peta bawaan.',
    'custom_rejected' => ':host menjawab HTTP :status. Periksa URL, API key, atau pembatasan domain pada key.',
];
