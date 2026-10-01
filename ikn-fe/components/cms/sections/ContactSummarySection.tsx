'use client';

import Reveal from '@/components/Reveal';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import SmartLink from '../SmartLink';
import { ANCHOR_BY_TYPE, asText, type ContactSummaryContent } from '../utils';
import { ContactInfoBlocks } from './ContactInfoSection';

// Ringkasan kontak di halaman lain (Tentang Kami, anchor #hubungi-kami untuk menu). Lokasi/email/media sosial
// diambil dari section contact_info halaman Kontak lewat SiteProvider, jadi admin cukup merawat satu tempat;
// section ini hanya menyimpan teks pengantar dan tombol ke formulir.
export default function ContactSummarySection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const { contact } = useSite();
  const c = section.content as ContactSummaryContent;
  const label = tr(c.label, lang);
  const heading = tr(c.heading, lang);
  const lead = tr(c.lead, lang);
  const button = tr(c.button_label, lang);

  return (
    <section className="section-tight" id={ANCHOR_BY_TYPE.contact_summary}>
      <div className="container">
        <div className="contact-summary">
          <div className="contact-summary-intro">
            {label && <span className="label label-green">{label}</span>}
            {heading && (
              <Reveal as="h2" className="h2">
                {heading}
              </Reveal>
            )}
            {lead && <p className="lead">{lead}</p>}
            {button && (
              <SmartLink href={asText(c.button_url) || '/kontak'} className="btn btn-solid">
                {button} <Icon name="arrow" />
              </SmartLink>
            )}
          </div>
          <div className="contact-summary-info">
            {contact ? (
              <ContactInfoBlocks content={contact} />
            ) : (
              <p className="lead">{lang === 'en' ? 'Contact details are managed on the Contact page.' : 'Data kontak diatur di halaman Kontak.'}</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
