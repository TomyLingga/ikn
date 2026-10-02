'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import SocialIcon, { GLYPHS } from '@/components/SocialIcon';
import ContactMap from '@/components/ContactMap';
import { useLang } from '@/components/LanguageProvider';
import { useSite } from '@/components/SiteProvider';
import { t } from '@/lib/i18n';
import { tr } from '@/lib/cms';
import { contactMapPoints } from '@/components/cms/utils';
import { isWhatsAppLink, whatsappContacts, whatsappHref } from '@/lib/whatsapp';
import styles from './Footer.module.css';

const COPY = {
  id: {
    share: 'Bagikan halaman ini',
    connect: 'Terhubung dengan kami',
    connectText: 'Ikuti kabar terbaru produk, sertifikasi, dan kegiatan PT IKN di media sosial kami.',
    contact: 'Hubungi kami',
    contactText: 'Butuh penawaran, sampel, atau spesifikasi teknis? Tim marketing kami siap membantu.',
    location: 'Lokasi kami',
    top: 'Kembali ke atas',
    shareOn: 'Bagikan ke',
    email: 'Email',
  },
  en: {
    share: 'Share this page',
    connect: 'Connect with us',
    connectText: 'Follow the latest on PT IKN products, certifications, and activities on our social channels.',
    contact: 'Contact us',
    contactText: 'Need a quote, a sample, or technical specs? Our sales team is ready to help.',
    location: 'Our location',
    top: 'Back to top',
    shareOn: 'Share on',
    email: 'Email',
  },
};

const mailGlyph = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3.5 6 8.5 7 8.5-7" />
  </svg>
);

const shareGlyph = (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
  </svg>
);

// Footer: panel "Terhubung" (ikon sosial) + "Hubungi kami" (tombol kontak/WhatsApp) + peta pin lokasi pertama,
// pil "Bagikan halaman ini" di tepi atas panel, lalu baris tautan menu footer dan identitas perusahaan.
// Teks dari Pengaturan Situs (site.footer_*), menu dari CMS (lokasi footer), kontak dari blok kontak bersama.
export default function Footer() {
  const { lang } = useLang();
  const site = useSite();
  const year = new Date().getFullYear();
  const ui = t[lang] || t.id;
  const copy = COPY[lang] ?? COPY.id;
  const [pageUrl, setPageUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    // URL halaman aktif untuk tombol bagikan (diperbarui saat navigasi klien mengganti judul).
    const update = () => {
      setPageUrl(window.location.href);
      setPageTitle(document.title);
    };
    update();
    const observer = new MutationObserver(update);
    const titleEl = document.querySelector('title');
    if (titleEl) observer.observe(titleEl, { childList: true });
    window.addEventListener('popstate', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', update);
    };
  }, []);

  const { company, site: siteText } = site.settings;
  const navItems = site.menus.footer.items.filter((item) => item.isActive !== false);
  const emails = site.contact?.emails ?? [];
  const phones = site.contact?.locations[0]?.phones ?? [];
  const social = site.contact?.social ?? [];
  const waMessage = tr(site.settings.contact?.whatsapp_message ?? { id: '', en: '' }, lang);
  const waContacts = whatsappContacts(site.settings, waMessage, 'Marketing');
  const waHref = waContacts[0]?.href ?? '';
  const socialHref = (label: string, url: string) => (isWhatsAppLink(label, url) ? waHref || whatsappHref(url, waMessage) || url : url);
  const mapPoints = site.contact ? contactMapPoints(site.contact, lang).slice(0, 1) : [];
  const firstLocation = site.contact?.locations[0];

  const headline = tr(siteText.footer_headline, lang) || ui.footer.headline;
  const ctaLabel = tr(siteText.footer_cta_label, lang) || ui.footer.startConvo;
  const subsidiary = tr(siteText.subsidiary_note, lang) || ui.footer.subsidiary;
  const connectText = tr(siteText.footer_connect_text ?? { id: '', en: '' }, lang) || copy.connectText;
  const contactText = tr(siteText.footer_contact_text ?? { id: '', en: '' }, lang) || copy.contactText;

  const url = encodeURIComponent(pageUrl);
  const shareTargets = [
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${url}`, icon: GLYPHS.facebook },
    { key: 'x', label: 'X', href: `https://twitter.com/intent/tweet?url=${url}&text=${encodeURIComponent(pageTitle)}`, icon: GLYPHS.x },
    { key: 'linkedin', label: 'LinkedIn', href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`, icon: GLYPHS.linkedin },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${encodeURIComponent(`${pageTitle} ${pageUrl}`)}`, icon: GLYPHS.whatsapp },
    { key: 'email', label: copy.email, href: `mailto:?subject=${encodeURIComponent(pageTitle)}&body=${url}`, icon: mailGlyph },
  ];

  return (
    <footer className={styles.footer}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={`container ${styles.inner}`}>
        <div className={styles.panel}>
          <div className={styles.share}>
            <span className={styles.shareLabel}>
              <span className={styles.shareIcon}>{shareGlyph}</span>
              {copy.share}
            </span>
            {shareTargets.map((s) => (
              <a
                key={s.key}
                href={pageUrl ? s.href : '#'}
                target={s.key === 'email' ? undefined : '_blank'}
                rel="noopener noreferrer"
                className={styles.shareBtn}
                title={s.label}
                aria-label={`${copy.shareOn} ${s.label}`}
              >
                {s.icon}
              </a>
            ))}
          </div>

          <div className={styles.panelGrid}>
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>{copy.connect}</h2>
              <p className={styles.blockText}>{connectText}</p>
              {social.length > 0 && (
                <ul className={styles.socials}>
                  {social.map((s) => (
                    <li key={s.url || s.label}>
                      <a href={socialHref(s.label, s.url)} target="_blank" rel="noopener noreferrer" className={styles.socialBtn} title={s.handle ? `${s.label} · ${s.handle}` : s.label} aria-label={s.label}>
                        <SocialIcon label={s.label} url={s.url} icon={s.icon} />
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.block}>
              <h2 className={styles.blockTitle}>{copy.contact}</h2>
              <p className={styles.blockText}>{contactText}</p>
              <div className={styles.ctaRow}>
                <Link href="/kontak" className={styles.ctaPrimary}>
                  {ctaLabel} <Icon name="arrow" size={16} />
                </Link>
                {waContacts[0] && (
                  <a href={waContacts[0].href} target="_blank" rel="noopener noreferrer" className={styles.ctaGhost}>
                    <SocialIcon label="WhatsApp" url={waContacts[0].href} /> WhatsApp
                  </a>
                )}
              </div>
              <ul className={styles.contactList}>
                {emails.map((e) => (
                  <li key={e.address}>
                    <Icon name="mail" size={15} />
                    <a href={`mailto:${e.address}`}>{e.address}</a>
                  </li>
                ))}
                {phones.map((p) => (
                  <li key={p.number}>
                    <Icon name="phone" size={15} />
                    <a href={`tel:${p.number.replace(/\s/g, '')}`}>{p.number}</a>
                  </li>
                ))}
                {waContacts.length > 1 &&
                  waContacts.map((contact) => (
                    <li key={contact.number}>
                      <Icon name="chat" size={15} />
                      <a href={contact.href} target="_blank" rel="noopener noreferrer" title={`WhatsApp ${contact.label}`}>
                        {contact.label} · {contact.display}
                      </a>
                    </li>
                  ))}
              </ul>
            </section>

            {mapPoints.length > 0 && (
              <section className={`${styles.block} ${styles.mapBlock}`}>
                <h2 className={styles.blockTitle}>{copy.location}</h2>
                {firstLocation?.address && (
                  <p className={styles.address}>
                    <Icon name="pin" size={15} /> <span>{firstLocation.address}</span>
                  </p>
                )}
                <div className={styles.mapCard}>
                  <ContactMap points={mapPoints} compact lang={lang} />
                </div>
              </section>
            )}
          </div>
        </div>

        {navItems.length > 0 && (
          <nav className={styles.links} aria-label={ui.footer.nav}>
            {navItems.map((item, idx) => (
              <Link key={String(item.id ?? item.key ?? idx)} href={item.url || '/'}>
                {tr(item.label, lang)}
              </Link>
            ))}
          </nav>
        )}

        <div className={styles.base}>
          <div className={styles.brand}>
            <Image src="/img/rubin-logo.png" alt="" width={44} height={44} className={styles.logo} />
            <div>
              <p className={styles.tagline}>{headline}</p>
              <p className={styles.fine}>
                © {year} {company.name} <span aria-hidden="true">·</span> {subsidiary}
              </p>
            </div>
          </div>
          <button type="button" className={styles.toTop} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Icon name="arrow" size={16} style={{ transform: 'rotate(-90deg)' }} />
            {copy.top}
          </button>
        </div>
      </div>
    </footer>
  );
}
