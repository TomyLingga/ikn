'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { useLang } from '@/components/LanguageProvider';
import { t, navTree } from '@/lib/i18n';
import { company, contact, locations } from '@/lib/site';
import styles from './Footer.module.css';

export default function Footer() {
  const { lang } = useLang();
  const year = new Date().getFullYear();
  const primaryLocation = locations[0];
  const ui = t[lang] || t.id;
  const navItems = navTree[lang] || navTree.id;

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div>
            <span className="label label-amber">/ {company.location}</span>
            <p className={styles.headline}>
              {ui.footer.headline.split(',').map((part, idx, arr) => (
                <span key={idx}>
                  {part}{idx < arr.length - 1 ? ',' : ''}
                  {idx < arr.length - 1 && <br />}
                </span>
              ))}
            </p>
            <Link href="/kontak" className="btn btn-amber">
              {ui.footer.startConvo} <Icon name="arrow" />
            </Link>
          </div>

          <div className={styles.columns}>
            <div className={styles.column}>
              <span className="label">{ui.footer.nav}</span>
              <ul>
                {navItems.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.column}>
              <span className="label">{ui.footer.contact}</span>
              <ul>
                {contact.emails.map((e) => (
                  <li key={e}>
                    <a href={`mailto:${e}`}>{e}</a>
                  </li>
                ))}
                {(primaryLocation?.phone ?? []).map((p) => (
                  <li key={p}>
                    <a href={`tel:${p.replace(/\s/g, '')}`}>{p}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.column}>
              <span className="label">{ui.footer.follow}</span>
              <ul>
                {contact.social.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noreferrer">
                      {s.label} <span className={styles.handle}>{s.handle}</span>
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
            <span>{ui.footer.subsidiary}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
