'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import SocialIcon from '@/components/SocialIcon';
import ContactMap from '@/components/ContactMap';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { t } from '@/lib/i18n';
import { tr } from '@/lib/cms';
import { contactMapPoints } from '@/components/cms/utils';
import { isWhatsAppLink, whatsappContacts, whatsappHref } from '@/lib/whatsapp';
import styles from './Footer.module.css';

// Footer: nav from the CMS footer menu, contact from the shared contact block,
// headline/CTA/subsidiary note from site settings. Column labels stay in lib/i18n.
export default function Footer() {
  const { lang } = useLang();
  const site = useSite();
  const year = new Date().getFullYear();
  const ui = t[lang] || t.id;

  const { company, site: siteText } = site.settings;
  const navItems = site.menus.footer.items.filter((item) => item.isActive !== false);
  const emails = site.contact?.emails ?? [];
  const phones = site.contact?.locations[0]?.phones ?? [];
  const social = site.contact?.social ?? [];
  // Nomor WhatsApp dari Pengaturan Situs: tautan langsung membuka percakapan (wa.me + pesan awal).
  const waMessage = tr(site.settings.contact?.whatsapp_message ?? { id: '', en: '' }, lang);
  const waContacts = whatsappContacts(site.settings, waMessage, lang === 'en' ? 'Marketing' : 'Marketing');
  const waHref = waContacts[0]?.href ?? '';
  const socialHref = (label: string, url: string) => (isWhatsAppLink(label, url) ? waHref || whatsappHref(url, waMessage) || url : url);
  // Pin lokasi pertama (kantor pusat) sebagai peta kecil; kosong bila admin belum menempatkan pin.
  const mapPoints = site.contact ? contactMapPoints(site.contact, lang).slice(0, 1) : [];

  const headline = tr(siteText.footer_headline, lang) || ui.footer.headline;
  const ctaLabel = tr(siteText.footer_cta_label, lang) || ui.footer.startConvo;
  const subsidiary = tr(siteText.subsidiary_note, lang) || ui.footer.subsidiary;

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div>
            <span className="label label-amber">/ {company.location}</span>
            <p className={styles.headline}>
              {headline.split(',').map((part, idx, arr) => (
                <span key={idx}>
                  {part}{idx < arr.length - 1 ? ',' : ''}
                  {idx < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
            <Link href="/kontak" className="btn btn-amber">
              {ctaLabel} <Icon name="arrow" />
            </Link>
            {mapPoints.length > 0 && <ContactMap points={mapPoints} compact lang={lang} />}
          </div>

          <div className={styles.columns}>
            <div className={styles.column}>
              <span className="label">{ui.footer.nav}</span>
              <ul>
                {navItems.map((item, idx) => (
                  <li key={String(item.id ?? item.key ?? idx)}>
                    <Link href={item.url || '/'}>{tr(item.label, lang)}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.column}>
              <span className="label">{ui.footer.contact}</span>
              <ul>
                {emails.map((e) => (
                  <li key={e.address}>
                    <a href={`mailto:${e.address}`}>{e.address}</a>
                  </li>
                ))}
                {phones.map((p) => (
                  <li key={p.number}>
                    <a href={`tel:${p.number.replace(/\s/g, '')}`}>{p.number}</a>
                  </li>
                ))}
                {waContacts.map((contact) => (
                  <li key={contact.number}>
                    <a href={contact.href} target="_blank" rel="noopener noreferrer" className={styles.whatsapp} title={`WhatsApp ${contact.label}`}>
                      <SocialIcon label="WhatsApp" url={contact.href} /> {waContacts.length > 1 ? `${contact.label} · ` : 'WhatsApp '}
                      {contact.display}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.column}>
              <span className="label">{ui.footer.follow}</span>
              <ul>
                {social.map((s) => (
                  <li key={s.url || s.label}>
                    <a href={socialHref(s.label, s.url)} target="_blank" rel="noopener noreferrer" className="social-link social-link--footer">
                      <SocialIcon label={s.label} url={s.url} icon={s.icon} />
                      <span>
                        {s.label} <span className={styles.handle}>{s.handle}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={styles.base}>
          <span className={styles.wordmark}>IKN</span>
          <div className={styles.fine}>
            <span>© {year} {company.name}</span>
            <span>{subsidiary}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
