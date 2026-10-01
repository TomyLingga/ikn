'use client';

import Icon from '@/components/Icon';
import SocialIcon from '@/components/SocialIcon';
import ContactMap from '@/components/ContactMap';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { isWhatsAppLink, whatsappContacts, whatsappHref } from '@/lib/whatsapp';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, contactMapPoints, mapsUrl, pad2, type ContactInfoContent } from '../utils';

interface Props {
  section: PageSection;
  /** false = peta dirender oleh pemanggil (mis. di samping formulir). */
  map?: boolean;
}

// Blok kontak halaman Kontak: band berlatar foto/gradien tema dengan kartu lokasi (alamat, telepon, petunjuk arah),
// email, dan baris ikon media sosial; lalu peta pin lokasi (Leaflet/OSM). Data dari section contact_info.
export default function ContactInfoBand({ section, map = true }: Props) {
  const { lang } = useLang();
  const { settings } = useSite();
  const en = lang === 'en';
  const c = section.content as ContactInfoContent;
  // WhatsApp dari Pengaturan Situs: kartu sendiri + tautan sosial "WhatsApp" diarahkan ke wa.me (langsung chat).
  const waMessage = tr(settings.contact?.whatsapp_message ?? { id: '', en: '' }, lang);
  const waContacts = whatsappContacts(settings, waMessage, 'Marketing');
  const waHref = waContacts[0]?.href ?? '';
  const socialHref = (label: string, url: string) => (isWhatsAppLink(label, url) ? waHref || whatsappHref(url, waMessage) || url : url);
  const locations = asList<ContactInfoContent['locations'][number]>(c.locations);
  const emails = asList<{ address: string }>(c.emails).filter((e) => asText(e.address));
  const social = asList<ContactInfoContent['social'][number]>(c.social).filter((s) => asText(s.url));
  const points = contactMapPoints(c, lang);
  const background = c.background?.url;

  return (
    <>
      <section className="contact-band" id={section.key || undefined}>
        {background && <div className="contact-band-bg" style={{ backgroundImage: `url(${background})` }} aria-hidden="true" />}
        <div className="container">
          <div className="contact-band-grid">
            {locations.map((loc, i) => {
              const phones = asList<{ number: string }>(loc.phones).filter((p) => asText(p.number));
              const lat = loc.geo?.lat;
              const lng = loc.geo?.lng;
              const hasPin = typeof lat === 'number' && typeof lng === 'number';
              return (
                <div key={i} className="contact-card">
                  <span className="label">
                    {pad2(i + 1)} / {en ? 'Location' : 'Lokasi'}
                  </span>
                  <h3>{tr(loc.name, lang)}</h3>
                  <div className="contact-card-lines">
                    <p>{asText(loc.address)}</p>
                    {phones.map((p) => (
                      <a key={p.number} href={`tel:${p.number.replace(/\s/g, '')}`}>
                        <Icon name="phone" size={14} /> {p.number}
                      </a>
                    ))}
                  </div>
                  {hasPin && (
                    <a className="contact-dir" href={mapsUrl(lat, lng)} target="_blank" rel="noreferrer">
                      <Icon name="pin" size={14} /> {en ? 'Get directions' : 'Petunjuk arah'}
                    </a>
                  )}
                </div>
              );
            })}
            {waContacts.length > 0 && (
              <div className="contact-card contact-card-wa">
                <span className="label">/ WhatsApp</span>
                <div className="contact-card-lines">
                  {waContacts.map((contact) => (
                    <a key={contact.number} href={contact.href} target="_blank" rel="noopener noreferrer">
                      <SocialIcon label="WhatsApp" url={contact.href} /> {waContacts.length > 1 ? `${contact.label} · ` : ''}
                      {contact.display}
                    </a>
                  ))}
                  <small>{en ? 'Opens a chat with our marketing team' : 'Langsung membuka chat dengan tim marketing'}</small>
                </div>
              </div>
            )}
            {emails.length > 0 && (
              <div className="contact-card">
                <span className="label">/ Email</span>
                <div className="contact-card-lines">
                  {emails.map((e) => (
                    <a key={e.address} href={`mailto:${e.address}`}>
                      <Icon name="mail" size={14} /> {e.address}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {social.length > 0 && (
            <div className="contact-band-social">
              <span className="label">{en ? '/ Follow us' : '/ Ikuti kami'}</span>
              <div className="contact-band-social-row">
                {social.map((s) => (
                  <a key={s.url} href={socialHref(asText(s.label), asText(s.url))} target="_blank" rel="noopener noreferrer" className="contact-band-social-link" title={asText(s.label)}>
                    <SocialIcon label={asText(s.label)} url={asText(s.url)} icon={s.icon} />
                    <span className="handle">{asText(s.handle) || asText(s.label)}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {map && points.length > 0 && (
        <section className="section-tight" id="peta">
          <div className="container">
            <ContactMap points={points} lang={lang} />
          </div>
        </section>
      )}
    </>
  );
}
