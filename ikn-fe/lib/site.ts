// Sumber tunggal data perusahaan — dipakai lintas halaman.
import type { IconName } from '@/lib/types';

export interface Video {
  id: string;
  title: string;
  desc: string;
}

export const company = {
  name: 'PT Industri Karet Nusantara',
  short: 'PT IKN',
  parent: 'PT Perkebunan Nusantara III',
  since: 1965,
  tagline: 'Menghilirkan karet Nusantara jadi produk kelas dunia.',
  location: 'Medan, Sumatera Utara',
};

export const nav = [
  { label: 'Beranda', href: '/' },
  { label: 'Tentang', href: '/tentang' },
  { label: 'Produk', href: '/produk' },
  { label: 'Berita', href: '/berita' },
  { label: 'Kontak', href: '/kontak' },
];

export const stats = [
  { value: '60', unit: 'Thn', label: 'Pengalaman sejak 1965' },
  { value: '02', unit: 'Unit', label: 'Pabrik produksi aktif' },
  { value: '100', unit: '%', label: 'Bahan baku karet lokal' },
  { value: 'III', unit: 'PTPN', label: 'Bagian dari holding' },
];

// Kata berjalan pada marquee
export const marquee = [
  'Sarung Egrek Karet',
  'Sepatu Boots Karet',
  'Resiprene 35',
  'Cyclised Natural Rubber',
  'Rubber Articles',
  'Protective Coatings',
  'Marine Paint',
  'Sejak 1965',
  'Sumatera Utara',
];

export const products = [
  {
    code: 'IKN-PRD-001',
    slug: 'sarung-egrek',
    name: 'Sarung Egrek',
    kind: 'Rubber Articles',
    summary:
      'Sarung pelindung pisau egrek kelapa sawit berbahan karet alam berkualitas tinggi untuk keselamatan kerja panen dan perlindungan mata pisau.',
    specs: [
      ['Bahan', 'Karet Alam Tebal'],
      ['Fungsi', 'Pelindung Pisau Egrek'],
      ['Sistem Kancing', 'Klip Karet Fleksibel'],
      ['Sektor', 'Perkebunan Sawit'],
    ],
  },
  {
    code: 'IKN-PRD-002',
    slug: 'sepatu-boots',
    name: 'Sepatu Boots',
    kind: 'Rubber Articles',
    summary:
      'Sepatu boots karet industri dan perkebunan standar mutu tinggi dengan logo Rubin PTPN. Tahan air, anti-slip, fleksibel, dan kuat di medan berat.',
    specs: [
      ['Bahan', '100% Karet Alam / Lateks'],
      ['Fitur Sol', 'Deep Tread Anti-Slip'],
      ['Standar', 'Perkebunan & Industri'],
      ['Sektor', 'Industri & Perkebunan'],
    ],
  },
  {
    code: 'RSP-35',
    slug: 'resiprene-35',
    name: 'Resiprene 35',
    kind: 'Cyclised Natural Rubber',
    summary:
      'Karet alam tersiklisasi dalam bentuk padatan kristal amber dengan kelarutan sangat baik pada pelarut tak berbau. Bahan andalan untuk cat pelindung, coating perawatan, dan cat marine.',
    specs: [
      ['Bentuk', 'Padatan / serpihan amber'],
      ['Kelarutan', 'Pelarut odourless'],
      ['Aplikasi', 'Kuas · Roller · Semprot'],
      ['Sektor', 'Coating & marine'],
    ],
  },
];

export const capabilities: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'leaf',
    title: 'Bahan baku lokal',
    body: 'Karet alam Sumatera Utara diolah menjadi produk hilir bernilai tambah tinggi, dekat dengan sumber kebun.',
  },
  {
    icon: 'flask',
    title: 'Mutu terkontrol',
    body: 'Setiap tahap produksi melewati kontrol kualitas agar hasil akhir konsisten dan sesuai standar.',
  },
  {
    icon: 'handshake',
    title: 'Kemitraan global',
    body: 'Membangun kerja sama saling menguntungkan dengan pelanggan dan pemangku kepentingan lintas negara.',
  },
];

export const misi = [
  'Memproduksi produk hilir karet bermutu tinggi sesuai standar dan harapan pelanggan.',
  'Membangun lingkungan kerja terukur dan berorientasi tujuan dengan tata kelola yang baik.',
  'Mengembangkan sumber daya manusia berlandaskan nilai AKHLAK.',
  'Membangun kemitraan yang saling menguntungkan dengan seluruh pemangku kepentingan.',
  'Memanfaatkan dan mengembangkan teknologi dalam proses bisnis.',
];

export const akhlak: [string, string][] = [
  ['Amanah', 'Memegang teguh kepercayaan yang diberikan.'],
  ['Kompeten', 'Terus belajar dan mengembangkan kapabilitas.'],
  ['Harmonis', 'Saling peduli dan menghargai perbedaan.'],
  ['Loyal', 'Berdedikasi dan mengutamakan kepentingan bersama.'],
  ['Adaptif', 'Terus berinovasi menghadapi perubahan.'],
  ['Kolaboratif', 'Membangun kerja sama yang sinergis.'],
];

export const timeline = [
  ['1965', 'Titik awal', 'Perusahaan mulai beroperasi di bidang pengolahan karet.'],
  ['—', 'Bergabung PTPN III', 'Menjadi anak perusahaan PT Perkebunan Nusantara III.'],
  ['Kini', 'Hilir karet mapan', 'Memproduksi Resiprene 35 dan aneka barang karet dari dua pabrik.'],
];

export const locations = [
  {
    name: 'Kantor Pusat & Pabrik Barang Karet',
    address: 'Jl. Medan – Tanjung Morawa Km 9,5, Medan 20148, Sumatera Utara, Indonesia',
    phone: ['+62 61 786 7356', '+62 811 648 0083'],
  },
  {
    name: 'Pabrik Resiprene',
    address: 'Sei Bamban Estate, Kec. Sei Bamban, Kab. Serdang Bedagai 20695, Sumatera Utara, Indonesia',
    phone: [],
  },
];

export const news = [
  {
    slug: 'resiprene-pasar-ekspor',
    date: '18.06.2026',
    tag: 'Produk',
    title: 'Resiprene 35 menembus pasar cat marine ekspor',
    excerpt:
      'Permintaan karet siklis untuk cat pelindung kapal terus tumbuh. IKN memperkuat kapasitas produksi Resiprene 35 untuk memenuhi order ekspor.',
  },
  {
    slug: 'nilai-akhlak-sdm',
    date: '02.05.2026',
    tag: 'Perusahaan',
    title: 'Penguatan budaya AKHLAK di lingkungan kerja',
    excerpt:
      'Program pengembangan SDM berlandaskan nilai Amanah, Kompeten, Harmonis, Loyal, Adaptif, dan Kolaboratif digelar sepanjang tahun.',
  },
  {
    slug: 'kemitraan-hilir-karet',
    date: '14.03.2026',
    tag: 'Kemitraan',
    title: 'IKN perkuat kemitraan hilir karet Sumatera Utara',
    excerpt:
      'Sebagai anak perusahaan PTPN III, IKN membangun kolaborasi rantai pasok karet alam yang saling menguntungkan dengan mitra lokal.',
  },
];

export const sustainability: { id: string; icon: IconName; title: string; body: string; points: string[] }[] = [
  {
    id: 'lingkungan',
    icon: 'leaf',
    title: 'Lingkungan',
    body: 'Mengolah karet alam secara bertanggung jawab, menekan limbah proses, dan menjaga efisiensi sumber daya di setiap tahap produksi.',
    points: [
      'Pemanfaatan bahan baku karet lokal Sumatera Utara',
      'Pengelolaan limbah produksi yang terkontrol',
      'Efisiensi energi pada proses hilir',
    ],
  },
  {
    id: 'sosial',
    icon: 'handshake',
    title: 'Sosial',
    body: 'Menciptakan dampak positif bagi masyarakat sekitar dan mengembangkan sumber daya manusia berlandaskan nilai AKHLAK.',
    points: [
      'Pengembangan SDM berkelanjutan',
      'Kemitraan dengan pekebun dan mitra lokal',
      'Lingkungan kerja yang sehat dan aman',
    ],
  },
  {
    id: 'tata-kelola',
    icon: 'gear',
    title: 'Tata Kelola',
    body: 'Menjalankan Good Corporate Governance sebagai anak perusahaan PTPN III dengan transparansi dan akuntabilitas.',
    points: [
      'Prinsip Good Corporate Governance (GCG)',
      'Transparansi dan akuntabilitas',
      'Kepatuhan terhadap standar induk usaha',
    ],
  },
];

// Galeri video (YouTube) — id diambil dari URL youtu.be
export const videos: Video[] = [
  {
    id: 'FGJQW6l2hrk',
    title: 'Company Profile — PT Industri Karet Nusantara',
    desc: 'Gambaran fasilitas produksi, sejarah, visi, misi, dan kontribusi PT IKN dalam rantai pasok hilirisasi karet.',
  },
  {
    id: '-CSAwkNrNzY',
    title: 'Proses Pengolahan & Mutu Produk Hilir',
    desc: 'Liputan pengolahan karet alam menjadi Resiprene 35 dan aneka barang karet bermutu tinggi.',
  },
];

export const contact = {
  emails: ['ikn@ptikn.com', 'gpihk_prpne@ikn.co.id'],
  social: [
    { label: 'Instagram', handle: '@ikn.rubber', href: 'https://instagram.com/ikn.rubber' },
    { label: 'YouTube', handle: '@RubberIkn', href: 'https://youtube.com/@RubberIkn' },
    { label: 'TikTok', handle: '@iknrubber', href: 'https://tiktok.com/@iknrubber' },
  ],
};
