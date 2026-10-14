<?php

// Daftar kata kasar untuk penyaringan teks dari customer (ulasan produk; lihat App\Support\Profanity).
// Pencocokan per kata utuh setelah normalisasi (huruf kecil, angka/simbol pengganti huruf: 4→a 1→i 0→o 3→e $→s,
// huruf berulang dipadatkan), jadi "B4NGS4T" dan "anjiiing" ikut tertangkap, sedangkan "anjungan" tidak.
// Hindari kata pendek yang juga bermakna wajar (mis. "as", "ass" → "as") agar tidak menolak ulasan sopan.
return [
    'words' => [
        // Bahasa Indonesia / daerah
        'anjing', 'anjir', 'anjrit', 'asu', 'babi', 'bacot', 'bajingan', 'bangke', 'bangsat', 'bego', 'bejat', 'bencong',
        'bodoh', 'brengsek', 'celeng', 'coli', 'cuk', 'dancok', 'dongo', 'entot', 'goblog', 'goblok', 'idiot', 'itil',
        'jablay', 'jancok', 'jancuk', 'jembut', 'kampret', 'kampungan', 'keparat', 'kimak', 'kontol', 'laknat', 'lonte',
        'memek', 'monyet', 'ngentod', 'ngentot', 'ngewe', 'pantek', 'pelacur', 'pepek', 'perek', 'puki', 'pukimak',
        'pukimai', 'setan', 'sialan', 'sinting', 'tai', 'taik', 'tahi', 'tempik', 'titit', 'tolol',
        // Bahasa Inggris
        'asshole', 'bastard', 'bitch', 'bullshit', 'cock', 'cunt', 'dick', 'douche', 'faggot', 'fuck', 'fucker',
        'fucking', 'moron', 'motherfucker', 'nigga', 'nigger', 'pussy', 'retard', 'scumbag', 'shit', 'slut', 'stfu',
        'whore', 'wtf',
    ],
];
