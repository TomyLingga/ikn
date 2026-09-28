// Helpers and content shapes shared by the CMS section renderers.
// Pure functions only (no React) so both RSC pages and client components can import them.

import type { Metadata } from 'next';
import type { BreadcrumbItem } from '@/components/Breadcrumb';
import type { I18n, MediaSummary, MenuNode, PageData } from '@/lib/cms';
import { tr } from '@/lib/cms';
import type { IconName, Lang } from '@/lib/types';

// ---------------------------------------------------------------- Section content shapes
// Field names mirror ikn-api/app/Services/Cms/SectionDefinitions.php.

export interface I18nItem {
  text: I18n;
}

export interface PageHeaderContent {
  label: I18n;
  title: I18n;
  lead: I18n;
  breadcrumb: boolean;
}

export interface HeroSlideItem {
  image: MediaSummary | null;
  alt: I18n;
}

export interface HeroMetaItem {
  text: I18n;
  color?: string; // #rrggbb; kosong = warna bawaan tema
  style?: 'plain' | 'green' | string; // konten lama sebelum migrasi
}

export interface HeroButtonItem {
  label: I18n;
  url: string;
  style: 'solid' | 'outline' | string;
  profile_document?: boolean;
  new_tab?: boolean;
}

export interface HeroContent {
  meta: HeroMetaItem[];
  title: I18n;
  subtitle: I18n;
  buttons?: HeroButtonItem[];
  slides: HeroSlideItem[];
  // Konten lama (sebelum migrasi ke daftar tombol).
  primary_label?: I18n;
  primary_url?: string;
  secondary_label?: I18n;
  secondary_url?: string;
}

export interface MarqueeContent {
  items: { text: string }[];
}

export interface StatsContent {
  items: { value: string; unit: string; label: I18n }[];
}

export interface CapabilitiesContent {
  label: I18n;
  heading: I18n;
  items: { icon: string; title: I18n; body: I18n }[];
}

export interface ProductHighlightsContent {
  label: I18n;
  heading: I18n;
  link_label: I18n;
  link_url: string;
  items: { code: string; name: string; kind: string; summary: I18n; url: string }[];
}

export interface VideoGalleryContent {
  label: I18n;
  heading: I18n;
  videos: { youtube_id: string; title: I18n; desc: I18n }[];
}

export interface CtaContent {
  label: I18n;
  title: I18n;
  button_label: I18n;
  button_url: string;
}

export interface TextVisualContent {
  label: I18n;
  heading: I18n;
  body: I18n;
  button_label: I18n;
  button_url: string;
  visual_label: string;
  visual_mark: string;
}

export interface TimelineContent {
  label: I18n;
  heading: I18n;
  items: { year: string; title: I18n; body: I18n }[];
}

export interface VisionMissionContent {
  label: I18n;
  heading: I18n;
  vision_tag: I18n;
  vision: I18n;
  mission_tag: I18n;
  missions: I18nItem[];
}

export interface ValuesContent {
  label: I18n;
  heading: I18n;
  items: { title: I18n; body: I18n }[];
}

export interface ContactInfoContent {
  locations: { name: I18n; address: string; phones: { number: string }[] }[];
  emails: { address: string }[];
  social: { label: string; handle: string; url: string }[];
}

export interface FormContent {
  label: I18n;
  success_title: I18n;
  success_body: I18n;
}

export interface PillarsContent {
  items: { key: string; icon: string; title: I18n; body: I18n; points: I18nItem[] }[];
}

export interface InfoBlocksContent {
  blocks: { label: I18n; body: I18n; points: I18nItem[] }[];
}

export interface CustomerLogosContent {
  lead: I18n;
}

export interface EmptyTextContent {
  empty_text: I18n;
}

export interface GalleryContent extends EmptyTextContent {
  photos_label: I18n;
  videos_label: I18n;
}

export interface RichTextContent {
  label: I18n;
  heading: I18n;
  body: I18n;
}

// ---------------------------------------------------------------- Defensive accessors

export function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const ICON_NAMES: IconName[] = [
  'arrow', 'arrowDown', 'chevronLeft', 'chevronRight', 'play', 'leaf', 'flask', 'handshake', 'target',
  'compass', 'gear', 'pin', 'phone', 'mail', 'bag', 'image', 'trash', 'orders', 'wallet', 'shieldCheck',
  'package', 'truck', 'checkCircle', 'cancelCircle', 'trendUp', 'users', 'paymentCheck', 'drop', 'check',
  'plus', 'close', 'quote', 'sun', 'moon', 'menu', 'panelLeft',
];

/** Coerce an icon name from the CMS; unknown names fall back. */
export function iconName(value: unknown, fallback: IconName = 'drop'): IconName {
  return typeof value === 'string' && (ICON_NAMES as string[]).includes(value) ? (value as IconName) : fallback;
}

/** Absolute http(s) URL (files on the API host, external sites). */
export function isExternal(url: string): boolean {
  return /^(https?:)?\/\//i.test(url);
}

/** mailto:/tel: style links that should not open a new tab. */
export function isProtocolLink(url: string): boolean {
  return /^(mailto|tel):/i.test(url);
}

/** Rich-text fields may contain HTML (editor) or plain text with blank-line paragraphs. */
export function looksLikeHtml(text: string): boolean {
  return /^\s*<[a-z][\s\S]*>/i.test(text);
}

export function formatBytes(size: number | null | undefined): string {
  if (!size || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(media: MediaSummary | null | undefined): string {
  if (!media) return '';
  const mime = media.mime || '';
  if (mime === 'application/pdf') return 'PDF';
  const sub = mime.split('/')[1];
  return sub ? sub.toUpperCase() : 'FILE';
}

// Anchor ids referenced by menu URLs (/tentang#sejarah etc.) — must stay stable.
export const ANCHOR_BY_TYPE: Record<string, string> = {
  timeline: 'sejarah',
  vision_mission: 'visi-misi',
  values: 'nilai',
};

// ---------------------------------------------------------------- Breadcrumb

function findMenuLabel(nodes: MenuNode[], path: string, lang: Lang): string | null {
  for (const node of nodes) {
    const url = (node.url || '').split('#')[0] || '';
    if (url === path) return tr(node.label, lang);
    const child = findMenuLabel(node.children || [], path, lang);
    if (child) return child;
  }
  return null;
}

function titleCase(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Build breadcrumb items from the pathname, labelling segments via the header menu. */
export function breadcrumbItems(
  pathname: string,
  menu: MenuNode[],
  lang: Lang,
  pageTitle?: I18n | null,
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: lang === 'en' ? 'Home' : 'Beranda', href: '/' }];
  const segments = pathname.split('/').filter(Boolean);
  let path = '';
  segments.forEach((segment, i) => {
    path += `/${segment}`;
    const last = i === segments.length - 1;
    const fromTitle = last && pageTitle ? tr(pageTitle, lang) : '';
    const label = fromTitle || findMenuLabel(menu, path, lang) || titleCase(decodeURIComponent(segment));
    items.push(last ? { label } : { label, href: path });
  });
  return items;
}

// ---------------------------------------------------------------- Metadata

/** Page metadata from the CMS SEO block (Indonesian text; an RSC cannot know the visitor's language). */
export function pageMetadata(page: PageData | null, fallbackTitle: string): Metadata {
  if (!page) return { title: fallbackTitle };
  const title = page.seo?.title?.id || page.title?.id || fallbackTitle;
  const description = page.seo?.description?.id || '';
  return description ? { title, description } : { title };
}
