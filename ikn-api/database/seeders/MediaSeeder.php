<?php

namespace Database\Seeders;

use App\Models\Media;
use App\Services\Media\MediaService;
use Illuminate\Database\Seeder;

// Aset demo: foto dari mockup FE + PDF placeholder (diganti admin lewat media library).
class MediaSeeder extends Seeder
{
    public const IMAGES = [
        'karet-1-1-scaled.jpg' => 'hero',
        'produksi-karet-1.webp' => 'hero',
        'pabrik-2-1.png' => 'hero',
        'kantor-direksi.png' => 'gallery',
        'resiprene-35.jpg' => 'gallery',
        'rubin-logo.png' => 'logos',
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
