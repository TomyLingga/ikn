<?php

// Rujukan media untuk pengecekan hapus (MediaService::isReferenced). Setiap area menambahkan
// barisnya sendiri; tabel yang belum ada (migrasi belum jalan) dilewati otomatis.
return [
    // [tabel, kolom foreign key ke media.id]
    'columns' => [
        ['posts', 'cover_media_id'],
        ['gallery_items', 'media_id'],
        ['certificates', 'media_id'],
        ['brochures', 'media_id'],
        ['customer_logos', 'media_id'],
        ['doc_links', 'media_id'],
        ['wbs_reports', 'attachment_media_id'],
        // Commerce
        ['categories', 'image_media_id'],
        ['product_images', 'media_id'],
        ['payments', 'proof_media_id'],
        ['order_attachments', 'media_id'],
    ],

    // [tabel, kolom jsonb, kunci] yang menyimpan id media di dalam JSON (mis. gambar QRIS metode bayar).
    'json_id_columns' => [
        ['payment_methods', 'config', 'qrisMediaId'],
        ['settings', 'value', 'mediaId'],
    ],

    // [tabel, kolom jsonb/teks] yang mungkin memuat URL/path media (gambar inline editor, config).
    'text_columns' => [
        ['posts', 'body'],
        ['page_sections', 'content'],
        ['payment_methods', 'config'],
        ['settings', 'value'],
    ],
];
