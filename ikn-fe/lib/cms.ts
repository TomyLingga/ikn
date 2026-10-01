// ============================ TIPE & HELPER CMS ============================
// Bentuk data dari ikn-api (/api/v1/content/*, /api/v1/admin/*). Field translatable
// selalu berbentuk { id, en }; pilih bahasa dengan tr() + useLang().

import type { Lang } from '@/lib/types';

export interface I18n {
  id: string;
  en: string;
}

export interface MediaSummary {
  id: number;
  url: string;
  mime: string;
  size: number;
  originalName: string;
}

export interface MediaItem extends MediaSummary {
  disk: 'public' | 'private';
  collection: string;
  isImage: boolean;
  meta: { width?: number; height?: number } | null;
  createdAt: string | null;
}

export interface PageSeo {
  title: I18n;
  description: I18n;
}

// Konten section bergantung tipe (lihat SectionDefinitions di ikn-api); bentuknya
// ditentukan skema server, jadi sengaja longgar.
// eslint-disable-next-line -- any disengaja: skema per tipe divalidasi server, renderer meng-cast ke tipe konkret.
export type SectionContent = Record<string, any>;

export interface PageSection<T = SectionContent> {
  id: number;
  key: string | null;
  type: string;
  sortOrder: number;
  isVisible: boolean;
  content: T;
  updatedAt: string | null;
}

export interface PageData {
  id: number;
  slug: string;
  title: I18n;
  status: 'draft' | 'published';
  template: string;
  seo: PageSeo;
  sections: PageSection[];
  updatedAt: string | null;
  isProtected?: boolean;
}

export interface PageListItem {
  id: number;
  slug: string;
  title: I18n;
  status: 'draft' | 'published';
  template: string;
  sectionCount: number;
  isProtected: boolean;
  updatedAt: string | null;
}

export interface MenuNode {
  id?: number;
  key: string | null;
  label: I18n;
  description: I18n | null;
  url: string | null;
  isActive: boolean;
  sortOrder?: number;
  children: MenuNode[];
}

export interface MenuData {
  location: 'header' | 'footer';
  items: MenuNode[];
  updatedAt?: string | null;
}

export interface DocLinkData {
  id: number;
  category: string;
  label: I18n;
  description: I18n | null;
  file: MediaSummary | null;
  url: string | null;
  targetUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: string | null;
}

export interface GeoPoint {
  lat: number | null;
  lng: number | null;
}

export interface ContactLocation {
  name: I18n;
  address: string;
  phones: { number: string }[];
  geo?: GeoPoint | null; // pin peta Leaflet/OSM (halaman Kontak, footer); kosong = tanpa pin
}

export interface SocialLink {
  label: string; // nama platform, mis. Instagram
  handle: string;
  url: string;
  icon?: MediaSummary | null; // ikon unggahan admin; kosong = ikon bawaan menurut platform (components/SocialIcon)
}

export interface ContactInfo {
  locations: ContactLocation[];
  emails: { address: string }[];
  social: SocialLink[];
  background?: MediaSummary | null; // foto latar blok kontak; kosong = gradien warna tema
}

export interface WhatsAppContact {
  label: string;
  number: string;
}

export interface SiteSettings {
  company: {
    name: string;
    short: string;
    parent: string;
    since: string;
    location: string;
    tagline: I18n;
    profile_document: MediaSummary | null;
  };
  site: {
    footer_headline: I18n;
    footer_cta_label: I18n;
    subsidiary_note: I18n;
  };
  seo: {
    default_title: I18n;
    default_description: I18n;
  };
  // Kanal chat & analitik (opsional agar fallback lama tetap valid).
  contact?: {
    whatsapp: string; // nomor utama, internasional tanpa +, mis. 6281234567890; kosong = tombol tidak tampil
    whatsapp_message: I18n;
    /** Nomor marketing tambahan (label = nama tim/orang). Bersama nomor utama menjadi daftar pilihan. */
    whatsapp_contacts?: WhatsAppContact[];
  };
  analytics?: {
    ga_measurement_id: string; // G-XXXXXXX; kosong = tanpa GA
    gsc_verification: string; // token meta google-site-verification
  };
  // Tema warna (hex #rrggbb; kosong = bawaan CSS). Disuntik ke --theme-* oleh app/layout.tsx, lihat lib/theme.ts.
  theme?: {
    primary: string;
    primary_deep: string;
    accent: string;
  };
}

export interface SiteData {
  settings: SiteSettings;
  menus: { header: MenuData; footer: MenuData };
  contact: ContactInfo | null;
  docLinks: DocLinkData[];
}

// Kategori berita (post_categories); postCount: publik = berita terbit, admin = semua.
export interface PostCategory {
  id: number;
  slug: string;
  name: I18n;
  sortOrder?: number;
  postCount?: number | null;
}

export interface PostSummary {
  id: number;
  slug: string;
  title: I18n;
  excerpt: I18n;
  category: PostCategory | null;
  author: string | null;
  /** Estimated reading time in minutes, computed server-side from the ID body. */
  readingMinutes: number;
  cover: MediaSummary | null;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PostDetail extends PostSummary {
  body: I18n;
  related?: PostSummary[];
}

export interface GalleryItemData {
  id: number;
  title: I18n;
  type: 'image' | 'video';
  media: MediaSummary | null;
  externalUrl: string | null;
  youtubeId: string | null;
  isPublished: boolean;
  sortOrder: number;
  updatedAt?: string | null;
}

export interface CertificateData {
  id: number;
  name: I18n;
  material: I18n;
  description: I18n;
  file: MediaSummary | null;
  isPublished: boolean;
  sortOrder: number;
  updatedAt?: string | null;
}

export interface BrochureData {
  id: number;
  title: I18n;
  description: I18n;
  file: MediaSummary | null;
  isPublished: boolean;
  sortOrder: number;
  updatedAt?: string | null;
}

export interface CustomerLogoData {
  id: number;
  name: string;
  logo: MediaSummary | null;
  url: string | null;
  isActive: boolean;
  sortOrder: number;
  updatedAt?: string | null;
}

export interface WbsReportData {
  id: number;
  code: string;
  subject: string;
  body: string;
  isAnonymous: boolean;
  reporterName: string | null;
  reporterContact: string | null;
  attachment: MediaSummary | null;
  status: 'new' | 'review' | 'closed';
  adminNotes: string | null;
  handledBy: { id: number; name: string } | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ContactMessageData {
  id: number;
  type: 'contact' | 'quote';
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string | null;
}

export interface AdminUserData {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin';
  active: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  createdAt: string | null;
}

export interface ModuleOption {
  code: string;
  name: I18n;
}

// ---- Skema tipe section (GET /admin/cms/section-types) ----
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'geo'
  | 'url'
  | 'icon'
  | 'select'
  | 'media'
  | 'color'
  | 'i18n_text'
  | 'i18n_textarea'
  | 'i18n_richtext'
  | 'list';

export interface FieldDef {
  type: FieldType;
  name: I18n;
  required?: boolean;
  max?: number;
  options?: Record<string, string>;
  default?: string;
  accept?: 'image' | 'document' | 'video' | 'visual'; // visual = gambar + video
  fields?: Record<string, FieldDef>;
  max_items?: number;
}

export interface SectionTypeDef {
  name: I18n;
  description: I18n;
  pages: string[]; // petunjuk halaman bawaan (bukan pembatas)
  group?: string; // kunci kelompok di SectionTypesResponse.groups
  fields: Record<string, FieldDef>;
}

export interface SectionTypesResponse {
  types: Record<string, SectionTypeDef>;
  groups?: Record<string, I18n>; // kelompok tipe, urutan = urutan tampil di pemilih
  icons: string[];
}

export interface PagedMeta {
  page: number;
  perPage: number;
  total: number;
  lastPage: number;
}

// ---- Helper ----

/** Pilih bahasa dengan fallback id → en → ''. */
export function tr(value: I18n | string | null | undefined, lang: Lang): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  const picked = value[lang];
  if (picked && picked.trim() !== '') return picked;
  return value.id || value.en || '';
}

/** Pecah teks menjadi paragraf pada baris kosong. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Pecah teks menjadi baris (untuk judul hero). */
export function lines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function emptyI18n(): I18n {
  return { id: '', en: '' };
}

/** Cari section berdasarkan tipe (pertama yang cocok). */
export function findSection<T = SectionContent>(page: PageData | null, type: string): PageSection<T> | null {
  if (!page) return null;
  return (page.sections.find((s) => s.type === type) as PageSection<T> | undefined) ?? null;
}

// Enam menu header bawaan (key dari MenuSeeder). Selalu tampil di bilah atas situs dan dikunci
// dari penghapusan di editor menu (baris pertama kisi 6 kolom); item header lain turun ke baris berikutnya.
export const PRIMARY_MENU_KEYS = ['home', 'tentang', 'bisnis', 'media', 'keberlanjutan', 'kontak'];

export function isPrimaryMenuItem(item: Pick<MenuNode, 'key'>): boolean {
  return !!item.key && PRIMARY_MENU_KEYS.includes(item.key);
}
