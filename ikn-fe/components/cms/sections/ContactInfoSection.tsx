'use client';

import { useLang } from '@/components/LanguageProvider';
import { tr } from '@/lib/cms';
import type { PageSection } from '@/lib/cms';
import { asList, asText, pad2, type ContactInfoContent } from '../utils';

// Locations, phones, emails, social links (left column of /kontak). Rendered inside ContactGrid.
export default function ContactInfoSection({ section }: { section: PageSection }) {
  const { lang } = useLang();
  const c = section.content as ContactInfoContent;
  const locations = asList<ContactInfoContent['locations'][number]>(c.locations);
  const emails = asList<{ address: string }>(c.emails).filter((e) => asText(e.address));
  const social = asList<ContactInfoContent['social'][number]>(c.social).filter((s) => asText(s.url));

  return (
    <>
      {locations.length > 0 && (
        <div className="contact-block">
          <span className="label label-green">{lang === 'en' ? '/ Locations' : '/ Lokasi'}</span>
        </div>
      )}
      {locations.map((loc, i) => {
        const phones = asList<{ number: string }>(loc.phones).filter((p) => asText(p.number));
        return (
          <div key={i} className="contact-block">
            <div className="contact-loc">
              <span className="index">{pad2(i + 1)}</span>
              <div>
                <h3>{tr(loc.name, lang)}</h3>
                <p className="contact-loc-addr">{asText(loc.address)}</p>
                {phones.length > 0 && (
                  <div className="phone-row">
                    {phones.map((p) => (
                      <a key={p.number} href={`tel:${p.number.replace(/\s/g, '')}`}>
                        {p.number}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {emails.length > 0 && (
        <div className="contact-block">
          <span className="label label-green">/ Email</span>
          <ul className="link-list" style={{ marginTop: 12 }}>
            {emails.map((e) => (
              <li key={e.address}>
                <a href={`mailto:${e.address}`}>
                  {e.address}
                  <span className="handle">Email</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {social.length > 0 && (
        <div className="contact-block">
          <span className="label label-green">{lang === 'en' ? '/ Social media' : '/ Media sosial'}</span>
          <ul className="link-list" style={{ marginTop: 12 }}>
            {social.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {asText(s.label)}
                  <span className="handle">{asText(s.handle)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
