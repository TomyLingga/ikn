'use client';

import { Fragment } from 'react';
import type { ReactNode } from 'react';
import type {
  BrochureData,
  CertificateData,
  CustomerLogoData,
  GalleryItemData,
  I18n,
  PageSection,
  PostCategory,
  PostSummary,
} from '@/lib/cms';
import PageHeaderSection from './sections/PageHeaderSection';
import HeroSection from './sections/HeroSection';
import MarqueeSection from './sections/MarqueeSection';
import StatsSection from './sections/StatsSection';
import CapabilitiesSection from './sections/CapabilitiesSection';
import ProductHighlightsSection from './sections/ProductHighlightsSection';
import VideoGallerySection from './sections/VideoGallerySection';
import CtaSection from './sections/CtaSection';
import TextVisualSection from './sections/TextVisualSection';
import TimelineSection from './sections/TimelineSection';
import VisionMissionSection from './sections/VisionMissionSection';
import ValuesSection from './sections/ValuesSection';
import ContactInfoSection from './sections/ContactInfoSection';
import ContactInfoBand from './sections/ContactInfoBand';
import ContactMap from '@/components/ContactMap';
import ContactSummarySection from './sections/ContactSummarySection';
import LinkCardsSection from './sections/LinkCardsSection';
import OrgChartSection from './sections/OrgChartSection';
import { contactMapPoints, type ContactInfoContent } from './utils';
import ContactFormSection from './sections/ContactFormSection';
import PillarsSection from './sections/PillarsSection';
import InfoBlocksSection from './sections/InfoBlocksSection';
import WbsFormSection from './sections/WbsFormSection';
import CustomerLogosSection from './sections/CustomerLogosSection';
import CertificatesSection from './sections/CertificatesSection';
import BrochuresSection from './sections/BrochuresSection';
import GallerySection from './sections/GallerySection';
import NewsSection from './sections/NewsSection';
import RichTextSection from './sections/RichTextSection';
import ContactGrid from './sections/ContactGrid';
import LatestNewsSection from './sections/LatestNewsSection';
import StepsSection from './sections/StepsSection';
import IconFeaturesSection from './sections/IconFeaturesSection';
import FaqSection from './sections/FaqSection';
import SpecTableSection from './sections/SpecTableSection';
import TeamSection from './sections/TeamSection';
import TestimonialsSection from './sections/TestimonialsSection';
import ImageGridSection from './sections/ImageGridSection';

// Lists for the data-backed sections, fetched by the RSC page (lib/section-data.ts) and handed down here.
export interface SectionExtra {
  news?: PostSummary[];
  latestNews?: PostSummary[]; // berita terbaru tanpa filter, untuk section latest_news
  newsCategories?: PostCategory[]; // filter kategori di /berita
  activeCategory?: string | null; // slug dari ?category=
  gallery?: GalleryItemData[];
  certificates?: CertificateData[];
  brochures?: BrochureData[];
  customerLogos?: CustomerLogoData[];
}

export interface PageMeta {
  slug: string;
  title: I18n;
}

interface SectionRendererProps {
  sections: PageSection[];
  extra?: SectionExtra;
  page?: PageMeta | null;
}

// Section types that share one two-column "contact-grid" block when adjacent (contact_info punya blok sendiri).
const LEFT_COLUMN = new Set(['info_blocks']);
const RIGHT_COLUMN = new Set(['contact_form', 'wbs_form']);

function columnContent(section: PageSection): ReactNode {
  switch (section.type) {
    case 'contact_info':
      return <ContactInfoSection section={section} />;
    case 'info_blocks':
      return <InfoBlocksSection section={section} />;
    case 'contact_form':
      return <ContactFormSection section={section} />;
    case 'wbs_form':
      return <WbsFormSection section={section} />;
    default:
      return null;
  }
}

function renderSection(section: PageSection, extra: SectionExtra, page: PageMeta | null): ReactNode {
  switch (section.type) {
    case 'page_header':
      return <PageHeaderSection section={section} pageTitle={page?.title ?? null} />;
    case 'hero':
      return <HeroSection section={section} />;
    case 'marquee':
      return <MarqueeSection section={section} />;
    case 'stats':
      return <StatsSection section={section} />;
    case 'capabilities':
      return <CapabilitiesSection section={section} />;
    case 'product_highlights':
      return <ProductHighlightsSection section={section} />;
    case 'video_gallery':
      return <VideoGallerySection section={section} />;
    case 'cta':
      return <CtaSection section={section} />;
    case 'text_visual':
      return <TextVisualSection section={section} />;
    case 'timeline':
      return <TimelineSection section={section} />;
    case 'vision_mission':
      return <VisionMissionSection section={section} />;
    case 'values':
      return <ValuesSection section={section} />;
    case 'pillars':
      return <PillarsSection section={section} />;
    case 'customer_logos':
      return <CustomerLogosSection section={section} items={extra.customerLogos ?? []} />;
    case 'certificates':
      return <CertificatesSection section={section} items={extra.certificates ?? []} />;
    case 'brochures':
      return <BrochuresSection section={section} items={extra.brochures ?? []} />;
    case 'gallery':
      return <GallerySection section={section} items={extra.gallery ?? []} />;
    case 'news':
      return <NewsSection section={section} items={extra.news ?? []} categories={extra.newsCategories ?? []} activeCategory={extra.activeCategory ?? null} />;
    case 'latest_news':
      return <LatestNewsSection section={section} items={extra.latestNews ?? extra.news ?? []} />;
    case 'steps':
      return <StepsSection section={section} />;
    case 'icon_features':
      return <IconFeaturesSection section={section} />;
    case 'faq':
      return <FaqSection section={section} />;
    case 'spec_table':
      return <SpecTableSection section={section} />;
    case 'team':
      return <TeamSection section={section} />;
    case 'testimonials':
      return <TestimonialsSection section={section} />;
    case 'image_grid':
      return <ImageGridSection section={section} />;
    case 'link_cards':
      return <LinkCardsSection section={section} />;
    case 'rich_text':
      return <RichTextSection section={section} />;
    case 'contact_summary':
      return <ContactSummarySection section={section} />;
    case 'org_chart':
      return <OrgChartSection section={section} />;
    case 'contact_info':
      return <ContactInfoBand section={section} />;
    case 'info_blocks':
      return <ContactGrid id={section.key || undefined} left={columnContent(section)} />;
    case 'contact_form':
    case 'wbs_form':
      return <ContactGrid id={section.key || undefined} right={columnContent(section)} />;
    default:
      // Unknown type (e.g. added in the API before the renderer): skip silently.
      return null;
  }
}

// Renders a page's CMS sections in order, reproducing the original page markup.
// Adjacent hero+marquee and info+form pairs are merged into one block, as in the
// hand-written pages they replace.
// "Tampilan blok" per section (field `surface`): polos (bawaan), kartu timbul, atau pita berwarna selebar layar.
// Tipe selebar layar / berlatar sendiri tidak dibungkus (sama dengan SectionDefinitions::NO_SURFACE di API).
const NO_SURFACE = new Set(['page_header', 'hero', 'marquee', 'cta', 'contact_info']);

function withSurface(section: PageSection, node: ReactNode): ReactNode {
  const surface = (section.content as { surface?: unknown } | null)?.surface;
  if (NO_SURFACE.has(section.type) || (surface !== 'card' && surface !== 'band')) return node;
  return (
    <div className={`sec-surface sec-surface-${surface}`} data-section-type={section.type}>
      {node}
    </div>
  );
}

export default function SectionRenderer({ sections, extra = {}, page = null }: SectionRendererProps) {
  const visible = sections
    .filter((s) => s.isVisible !== false)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const nodes: ReactNode[] = [];
  for (let i = 0; i < visible.length; i += 1) {
    const section = visible[i];
    if (!section) continue;
    const next = visible[i + 1];

    if (section.type === 'hero' && next?.type === 'marquee') {
      nodes.push(<HeroSection key={section.id} section={section} marquee={next} />);
      i += 1;
      continue;
    }

    // Halaman Kontak: band kontak, lalu peta pin di kiri dan formulir di kanan.
    if (section.type === 'contact_info' && next?.type === 'contact_form') {
      const points = contactMapPoints(section.content as ContactInfoContent, 'id');
      nodes.push(
        <Fragment key={section.id}>
          <ContactInfoBand section={section} map={false} />
          <ContactGrid
            id={next.key || undefined}
            left={points.length > 0 ? <ContactMap points={points} /> : <ContactInfoSection section={section} />}
            right={columnContent(next)}
          />
        </Fragment>,
      );
      i += 1;
      continue;
    }

    if (LEFT_COLUMN.has(section.type) && next && RIGHT_COLUMN.has(next.type)) {
      nodes.push(<ContactGrid key={section.id} id={section.key || undefined} left={columnContent(section)} right={columnContent(next)} />);
      i += 1;
      continue;
    }

    const node = renderSection(section, extra, page);
    if (node) nodes.push(<Fragment key={section.id}>{withSurface(section, node)}</Fragment>);
  }

  return <>{nodes}</>;
}
