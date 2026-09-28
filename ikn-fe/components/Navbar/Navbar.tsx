'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import ThemeToggle from '@/components/ThemeToggle';
import LangToggle from '@/components/LangToggle';
import CartButton from '@/components/CartButton';
import { useLang } from '@/components/LanguageProvider';
import { useAuth } from '@/components/AuthProvider';
import { useSite } from '@/components/SiteProvider';
import { t } from '@/lib/i18n';
import { isPrimaryMenuItem, tr, type MenuNode } from '@/lib/cms';
import Icon from '@/components/Icon';
import styles from './Navbar.module.css';

// Navbar: menu tree from the CMS header menu (site.menus.header). Doc links
// (site.docLinks) are appended to the top-level item whose key equals their category.
// Menu utama ditata dalam kisi 6 kolom (NAV_COLUMNS): enam menu bawaan selalu mengisi baris
// pertama, item tambahan turun ke baris berikutnya tepat di bawah kolom yang sama.
// Tinggi bilah diukur dan ditulis ke --nav-h agar offset halaman ikut menyesuaikan saat 2 baris.
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null); // dropdown terbuka di mobile
  const innerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { lang } = useLang();
  const { customer, admin } = useAuth();
  const site = useSite();
  const isUserLoggedIn = !!(customer || admin);
  const dashboardHref = admin ? '/admin' : '/dashboard';
  const dashboardLabel = admin
    ? lang === 'en'
      ? 'Admin Dashboard'
      : 'Dashboard Admin'
    : 'Dashboard';

  const active = site.menus.header.items.filter((item) => item.isActive !== false);
  const items = [...active.filter(isPrimaryMenuItem), ...active.filter((item) => !isPrimaryMenuItem(item))];
  const ui = t[lang] || t.id;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  // Sinkronkan --nav-h dengan tinggi bilah sebenarnya (baris kedua menu, layar sempit, dsb.).
  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--nav-h', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--nav-h');
    };
  }, []);

  function isActivePath(href: string): boolean {
    const itemPath = href.split('#')[0] || href;
    return href === '/' ? pathname === '/' : pathname.startsWith(itemPath);
  }

  function docLinks(item: MenuNode) {
    if (!item.key) return [];
    return site.docLinks
      .filter((doc) => doc.isActive && doc.category === item.key && !!doc.targetUrl)
      .map((doc) => {
        const desc = tr(doc.description, lang);
        return (
          <a key={`doc-${doc.id}`} href={doc.targetUrl ?? '#'} target="_blank" rel="noopener noreferrer" className={styles.dropLink} role="menuitem">
            <span className={styles.dropLabel}>
              {tr(doc.label, lang)} <span style={{ fontSize: '0.74rem', opacity: 0.75 }}>↗</span>
            </span>
            {desc && <span className={styles.dropDescription}>{desc}</span>}
          </a>
        );
      });
  }

  function renderItem(item: MenuNode, idx: number) {
    const href = item.url || '/';
    const label = tr(item.label, lang);
    const groupKey = String(item.id ?? item.key ?? idx);
    const children = (item.children ?? []).filter((child) => child.isActive !== false);
    const docs = docLinks(item);

    if (children.length === 0 && docs.length === 0) {
      return (
        <Link key={groupKey} href={href} className={`${styles.link} ${isActivePath(href) ? styles.active : ''}`}>
          {label}
        </Link>
      );
    }

    return (
      <div key={groupKey} className={`${styles.itemDrop} ${openGroup === groupKey ? styles.expanded : ''}`}>
        <Link
          href={href}
          className={`${styles.link} ${styles.linkParent} ${isActivePath(href) ? styles.active : ''}`}
          onClick={(e) => {
            // Di mobile, klik pertama membuka panel alih-alih navigasi.
            if (window.matchMedia('(max-width: 900px)').matches && openGroup !== groupKey) {
              e.preventDefault();
              setOpenGroup(groupKey);
            }
          }}
        >
          {label}
          <Icon name="arrowDown" size={13} className={styles.caret} />
        </Link>

        <div className={styles.dropdown} role="menu">
          <div className={styles.dropdownInner}>
            {children.map((child, ci) => {
              const desc = tr(child.description, lang);
              return (
                <Link key={String(child.id ?? `${groupKey}-${ci}`)} href={child.url || href} className={styles.dropLink} role="menuitem">
                  <span className={styles.dropLabel}>{tr(child.label, lang)}</span>
                  {desc && <span className={styles.dropDescription}>{desc}</span>}
                </Link>
              );
            })}
            {docs}
          </div>
        </div>
      </div>
    );
  }

  return (
    <header className={`${styles.nav} ${scrolled ? styles.scrolled : ''} ${open ? styles.open : ''}`}>
      <div ref={innerRef} className={`${styles.inner} container`}>
        <Link href="/" className={styles.brand} aria-label={site.settings.company.name}>
          <Image src="/img/rubin-logo.png" alt="Rubin Logo" width={40} height={40} priority />
          <span className={styles.brandMeta}>
            <span>Industri Karet</span>
            <span>Nusantara</span>
          </span>
        </Link>

        <nav id="main-navigation" className={styles.links} aria-label="Navigasi utama">
          <div className={styles.menuGrid}>{items.map(renderItem)}</div>

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
