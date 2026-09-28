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

// Lists for the data-backed sections, fetched by the RSC page and handed down here.
export interface SectionExtra {
  news?: PostSummary[];
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

// Section types that share one two-column "contact-grid" block when adjacent.
const LEFT_COLUMN = new Set(['contact_info', 'info_blocks']);
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
      return <NewsSection section={section} items={extra.news ?? []} />;
    case 'rich_text':
      return <RichTextSection section={section} />;
    case 'contact_info':
    case 'info_blocks':
      return <ContactGrid left={columnContent(section)} />;
    case 'contact_form':
    case 'wbs_form':
      return <ContactGrid right={columnContent(section)} />;
    default:
      // Unknown type (e.g. added in the API before the renderer): skip silently.
      return null;
  }
}

// Renders a page's CMS sections in order, reproducing the original page markup.
// Adjacent hero+marquee and info+form pairs are merged into one block, as in the
// hand-written pages they replace.
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

    if (LEFT_COLUMN.has(section.type) && next && RIGHT_COLUMN.has(next.type)) {
      nodes.push(<ContactGrid key={section.id} left={columnContent(section)} right={columnContent(next)} />);
      i += 1;
      continue;
    }

    const node = renderSection(section, extra, page);
    if (node) nodes.push(<Fragment key={section.id}>{node}</Fragment>);
  }

  return <>{nodes}</>;
}
