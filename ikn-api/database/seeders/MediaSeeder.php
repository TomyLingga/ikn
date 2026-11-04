<?php

namespace Database\Seeders;

use App\Models\Media;
use App\Models\Setting;
use App\Services\Media\MediaService;
use Illuminate\Database\Seeder;

// Aset seed: foto pabrik/produk dari berkas klien + PDF placeholder (diganti admin lewat media library).
class MediaSeeder extends Seeder
{
    public const IMAGES = [
        'karet-1-1-scaled.jpg' => 'hero',
        'produksi-karet-1.webp' => 'hero',
        'pabrik-2-1.png' => 'hero',
        'kantor-direksi.png' => 'gallery',
        'resiprene-35.jpg' => 'gallery',
        'rubin-logo.png' => 'logos',
        // Foto pabrik dan aktivitas dari doc/IKN/BAHAN FOTO IKN (berkas klien, dioptimalkan ke JPEG 1600 px), beranda 2026-11-04.
        'pabrik-udara-1.jpg' => 'gallery',
        'gedung-kantor-udara.jpg' => 'gallery',
        'gedung-rubber-industry.jpg' => 'gallery',
        'papan-pabrik-resiprene.jpg' => 'gallery',
        'produksi-karet-2.jpg' => 'gallery',
        'bahan-baku-gudang.jpg' => 'gallery',
        'pengemasan-muat-1.jpg' => 'gallery',
        'pengemasan-muat-2.jpg' => 'gallery',
        // Perkebunan karet dan foto udara pabrik kedua (halaman Keberlanjutan, Tentang, Media), 2026-11-04.
        'kebun-karet-1.jpg' => 'gallery',
        'kebun-karet-2.jpg' => 'gallery',
        'pohon-karet-sadap.jpg' => 'gallery',
        'pabrik-udara-2.jpg' => 'gallery',
        // Video latar hero: potongan 10 detik footage drone kebun karet klien (DJI_0772, 1600 px, tanpa suara) + poster.
        'hero-perkebunan-drone.mp4' => 'hero',
        'hero-perkebunan-drone.jpg' => 'hero',
        'hero-perkebunan-drone-2.mp4' => 'hero', // potongan 12 detik DJI_0771 (jalan kebun), diputar bergantian
        // Butiran Resiprene 35 berlatar transparan (dipotong dari foto produk klien) untuk kartu sorotan hero.
        'resiprene-35-cutout.png' => 'products',
        // Foto per tonggak sejarah: foto produk klien (doc/IKN/BAHAN FOTO IKN/Foto Produk Kamera IKN) dan dua foto ilustrasi
        // sementara dari Wikimedia Commons (lisensi & atribusi di assets/CREDITS.md), 2026-11-04.
        'sejarah-ban-sepeda.jpg' => 'gallery',
        'sejarah-karet-gelang.jpg' => 'gallery',
        'sejarah-flexible-joint.jpg' => 'gallery',
        'sejarah-conveyor-belt.jpg' => 'gallery',
        // Logo pelanggan Rubber Articles, dipotong dari slide "Our Costumer" klien (our-customer-2).
        'logo-ptpn2.png' => 'logos',
        'logo-ptpn3.png' => 'logos',
        'logo-ptpn4.png' => 'logos',
        'logo-ptpn5.png' => 'logos',
        'logo-socfin.png' => 'logos',
        // Foto produk "Packing Pintu Rebusan Endless" dari berkas klien (kartu Rubber Articles di beranda).
        'rubber-articles-packing-endless.jpg' => 'products',
        // Kop & kaki cetakan invoice (pindaian kop surat klien dari doc/Invoice), ASUMSI A-83.
        'invoice-header.png' => 'invoice',
        'invoice-footer.png' => 'invoice',
    ];

    /** Setting media yang diisi bawaan dari aset di atas bila masih kosong. */
    public const SETTING_DEFAULTS = [
        'invoice.header_image' => 'invoice-header.png',
        'invoice.footer_image' => 'invoice-footer.png',
    ];

    public const DOCUMENTS = [
        'brosur-resiprene-35.pdf' => 'Brosur Produk Resiprene 35',
        'katalog-barang-karet.pdf' => 'Katalog Barang Karet dan Komponen Industri',
        'iso-37001.pdf' => 'Sertifikat ISO 37001:2016',
        'reach-compliance.pdf' => 'REACH Compliance Certificate',
        'sop-wbs.pdf' => 'Dokumen Whistle Blowing System PT IKN',
        'sds-resiprene.pdf' => 'Safety Data Sheet Resiprene 35',
    ];

    // Dokumen asli dari klien (database/seeders/assets/documents): dipakai bila ada, selain itu PDF placeholder.
    public const REAL_DOCUMENTS = [
        'reach-compliance.pdf' => 'reach-registration-certificate.pdf',
        'sop-wbs.pdf' => 'wbs-sop.pdf',
        'sds-resiprene.pdf' => 'safety-data-sheet-resiprene.pdf',
        // Brosur asli klien (doc/IKN/BROSUR & SERTIFIKAT), 2026-11-04.
        'brosur-resiprene-35.pdf' => 'brosur-resiprene-35.pdf',
        'katalog-barang-karet.pdf' => 'brosur-rubber-articles.pdf',
    ];

    public function run(MediaService $service)
    {
        $assets = database_path('seeders/assets');

        foreach (self::REAL_DOCUMENTS as $name => $file) {
            if (self::find($name) || ! is_file("$assets/documents/$file")) {
                continue;
            }
            $service->importFromPath("$assets/documents/$file", 'documents', Media::DISK_PUBLIC, $name);
        }

        foreach (self::IMAGES as $name => $collection) {
            if (self::find($name) || ! is_file("$assets/$name")) {
                continue;
            }
            $service->importFromPath("$assets/$name", $collection, Media::DISK_PUBLIC, $name);
        }

        foreach (self::DOCUMENTS as $name => $title) {
            if (self::find($name)) {
                continue;
            }
            $tmp = tempnam(sys_get_temp_dir(), 'ikn').'.pdf';
            file_put_contents($tmp, self::placeholderPdf($title));
            $service->importFromPath($tmp, 'documents', Media::DISK_PUBLIC, $name);
            @unlink($tmp);
        }

        foreach (self::SETTING_DEFAULTS as $key => $file) {
            if (! Setting::getValue($key) && ($id = self::id($file))) {
                Setting::putValue($key, $id, explode('.', $key)[0], true);
            }
        }
    }

    public static function find(string $originalName): ?Media
    {
        return Media::where('original_name', $originalName)->orderBy('id')->first();
    }

    public static function id(string $originalName): ?int
    {
        return optional(self::find($originalName))->id;
    }

    // PDF satu halaman yang valid (xref dihitung) berisi judul dokumen.
    public static function placeholderPdf(string $title): string
    {
        $escape = fn (string $s) => str_replace(['\\', '(', ')'], ['\\\\', '\(', '\)'], preg_replace('/[^\x20-\x7E]/', '', $s));
        $stream = "BT /F1 20 Tf 72 760 Td (".$escape($title).") Tj ET\n"
            ."BT /F1 11 Tf 72 732 Td (Dokumen contoh. Ganti berkas ini lewat panel admin.) Tj ET";

        $objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
            '<< /Length '.strlen($stream)." >>\nstream\n".$stream."\nendstream",
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [];
        foreach ($objects as $i => $object) {
            $offsets[] = strlen($pdf);
            $pdf .= ($i + 1)." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($offsets as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF\n";

        return $pdf;
    }
}
