'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import LangToggle from '@/components/LangToggle';
import CartButton from '@/components/CartButton';
import { useLang } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import { navTree, t } from '@/lib/i18n';
import Icon from '@/components/Icon';
import styles from './Navbar.module.css';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null); // dropdown terbuka di mobile
  const pathname = usePathname();
  const { lang } = useLang();
  const { customer, admin } = useAuth();
  const isUserLoggedIn = !!(customer || admin);
  const dashboardHref = admin ? '/admin' : '/dashboard';
  const dashboardLabel = admin
    ? lang === 'en'
      ? 'Admin Dashboard'
      : 'Dashboard Admin'
    : 'Dashboard';

  const items = navTree[lang] || navTree.id;
  const ui = t[lang] || t.id;

  const [docLinks, setDocLinks] = useState<Array<{
    id: string;
    title: string;
    description: string;
    targetUrl: string;
    parentCategory: string;
    active: boolean;
  }>>([]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    async function loadDocLinks() {
      try {
        const res = await fetch('/api/navigation/doc-links');
        if (res.ok) {
          const data = await res.json() as Array<{
            id: string;
            title: string;
            description: string;
            targetUrl: string;
            parentCategory: string;
            active: boolean;
          }>;
          setDocLinks(data.filter((d) => d.active));
          return;
        }
      } catch {
        // Fallback default active documents
      }
      setDocLinks([
        {
          id: 'wbs',
          title: 'Whistle Blowing System',
          description: 'Kanal pelaporan resmi PT IKN',
          targetUrl: '/storage/wbs-dokumen.pdf',
          parentCategory: 'Keberlanjutan',
          active: true,
        },
        {
          id: 'reach',
          title: 'REACH Compliance Certificate',
          description: 'Sertifikat kepatuhan pasar Eropa',
          targetUrl: '/storage/reach-compliance.pdf',
          parentCategory: 'Keberlanjutan',
          active: true,
        },
      ]);
    }
    void loadDocLinks();
  }, []);

  useEffect(() => {
    setOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  return (
    <header className={`${styles.nav} ${scrolled ? styles.scrolled : ''} ${open ? styles.open : ''}`}>
      <div className={`${styles.inner} container`}>
        <Link href="/" className={styles.brand} aria-label="PT Industri Karet Nusantara">
          <Image src="/img/rubin-logo.png" alt="Rubin Logo" width={40} height={40} priority />
          <span className={styles.brandMeta}>
            <span>Industri Karet</span>
            <span>Nusantara</span>
          </span>
        </Link>

        <nav id="main-navigation" className={styles.links} aria-label="Navigasi utama">
          {items.map((item) => {
            const itemPath = item.href.split('#')[0] ?? item.href;
            const children = item.children ?? [];
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(itemPath);

            const categoryName = item.label.toLowerCase();
            const matchingDocs = docLinks.filter((doc) => {
              if (!doc.active) return false;
              const p = doc.parentCategory.toLowerCase();
              return (
                p === categoryName ||
                (categoryName === 'sustainability' && p === 'keberlanjutan') ||
                (categoryName === 'keberlanjutan' && p === 'sustainability') ||
                (categoryName === 'about us' && p === 'tentang kami') ||
                (categoryName === 'tentang kami' && p === 'about us') ||
                (categoryName === 'business' && p === 'bisnis') ||
                (categoryName === 'bisnis' && p === 'business') ||
                (categoryName === 'media' && p === 'media')
              );
            });

            const hasChildren = children.length > 0 || matchingDocs.length > 0;

            if (!hasChildren) {
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${styles.link} ${active ? styles.active : ''}`}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <div
                key={item.label}
                className={`${styles.itemDrop} ${openGroup === item.label ? styles.expanded : ''}`}
              >
                <Link
                  href={item.href}
                  className={`${styles.link} ${styles.linkParent} ${active ? styles.active : ''}`}
                  onClick={(e) => {
                    // Di mobile, klik pertama membuka panel alih-alih navigasi.
                    if (
                      window.matchMedia('(max-width: 900px)').matches &&
                      openGroup !== item.label
                    ) {
                      e.preventDefault();
                      setOpenGroup(item.label);
                    }
                  }}
                >
                  {item.label}
                  <Icon name="arrowDown" size={13} className={styles.caret} />
                </Link>

                <div className={styles.dropdown} role="menu">
                  <div className={styles.dropdownInner}>
                    {children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={styles.dropLink}
                        role="menuitem"
                      >
                        <span className={styles.dropLabel}>{child.label}</span>
                        {child.desc && (
                          <span className={styles.dropDescription}>{child.desc}</span>
                        )}
                      </Link>
                    ))}

                    {matchingDocs.map((doc) => (
                      <a
                        key={doc.id}
                        href={doc.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.dropLink}
                        role="menuitem"
                      >
                        <span className={styles.dropLabel}>
                          {doc.title} <span style={{ fontSize: '0.74rem', opacity: 0.75 }}>↗</span>
                        </span>
                        {doc.description && (
                          <span className={styles.dropDescription}>{doc.description}</span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          <div className={styles.actions}>
            <LangToggle />
            <ThemeToggle />
            {customer && <CartButton />}
            <Link
              href={isUserLoggedIn ? dashboardHref : '/login'}
              className={`${styles.cta} ${isUserLoggedIn ? styles.ctaDashboard : ''}`}
            >
              {isUserLoggedIn ? dashboardLabel : ui.login}
            </Link>
          </div>
        </nav>

        <div className={styles.mobileActions}>
          <Link
            href={isUserLoggedIn ? dashboardHref : '/login'}
            className={`${styles.mobileLogin} ${isUserLoggedIn ? styles.mobileDashboard : ''}`}
            onClick={() => setOpen(false)}
          >
            {isUserLoggedIn ? dashboardLabel : ui.login}
          </Link>
          <button
            className={styles.toggle}
            aria-label={open ? 'Tutup menu' : ui.menu}
            aria-expanded={open}
            aria-controls="main-navigation"
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
