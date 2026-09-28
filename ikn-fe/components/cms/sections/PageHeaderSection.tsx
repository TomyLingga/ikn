'use client';

import { usePathname } from 'next/navigation';
import Breadcrumb from '@/components/Breadcrumb';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { tr } from '@/lib/cms';
import type { I18n, PageSection } from '@/lib/cms';
import { breadcrumbItems, type PageHeaderContent } from '../utils';

interface Props {
  section: PageSection;
  pageTitle?: I18n | null;
}

// Page header: eyebrow label, display title, lead. With breadcrumb=true it uses the
// compact "commerce-head" variant (sub-pages such as /keberlanjutan/sertifikat).
export default function PageHeaderSection({ section, pageTitle }: Props) {
  const { lang } = useLang();
  const site = useSite();
  const pathname = usePathname();
  const c = section.content as PageHeaderContent;
  const label = tr(c.label, lang);
  const title = tr(c.title, lang);
  const lead = tr(c.lead, lang);

  if (c.breadcrumb) {
    const crumbs = breadcrumbItems(pathname || '/', site.menus.header.items, lang, pageTitle);
    return (
      <section className="pagehead commerce-head">
        <div className="container">
          <Breadcrumb items={crumbs} />
          {label && <span className="label label-amber">{label}</span>}
          <h1 className="display pagehead-title">{title}</h1>
          {lead && (
            <p className="lead" style={{ marginTop: 18 }}>
              {lead}
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="pagehead">
      <div className="container pagehead-row">
        <div>
          {label && <span className="label label-amber">{label}</span>}
          <h1 className="display pagehead-title">{title}</h1>
        </div>
        {lead && <p className="lead">{lead}</p>}
      </div>
    </section>
  );
}
