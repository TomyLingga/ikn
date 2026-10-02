'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
import { isSiteFile, openFile } from '@/components/FileViewer';

const pathOf = (href: string) => href.split('#')[0] || '/';
const hashOf = (href: string) => href.split('#')[1] || '';
// Halaman aplikasi yang "milik" menu tertentu walau tidak ada di daftar anak (toko = bagian Bisnis).
const RELATED_PATHS: Record<string, string[]> = { '/bisnis': ['/catalog', '/cart', '/checkout'] };

// Navbar: menu tree from the CMS header menu (site.menus.header). Doc links
// (site.docLinks) are appended to the top-level item whose key equals their category.
// Menu utama ditata dalam kisi 6 kolom (NAV_COLUMNS): enam menu bawaan selalu mengisi baris
// pertama, item tambahan turun ke baris berikutnya tepat di bawah kolom yang sama.
// Tinggi bilah diukur dan ditulis ke --nav-h agar offset halaman ikut menyesuaikan saat 2 baris.
// Sorotan aktif: item utama menyala bila halaman saat ini (atau salah satu anaknya) sedang dibuka;
// anak menu ber-anchor (mis. /keberlanjutan#sertifikat) menyala mengikuti section yang sedang terlihat (IntersectionObserver).
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null); // dropdown terbuka di mobile
  const [activeHash, setActiveHash] = useState('');
  const innerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || '/';
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

  const items = useMemo(() => {
    const active = site.menus.header.items.filter((item) => item.isActive !== false);
    return [...active.filter(isPrimaryMenuItem), ...active.filter((item) => !isPrimaryMenuItem(item))];
  }, [site.menus.header.items]);
  const ui = t[lang] || t.id;

  // Id section yang dirujuk anchor menu pada halaman ini (untuk scroll spy).
  const anchorIds = useMemo(() => {
    const urls = items.flatMap((item) => [item.url || '', ...(item.children ?? []).map((child) => child.url || '')]);
    return Array.from(new Set(urls.filter((url) => url.includes('#') && pathOf(url) === pathname).map(hashOf))).filter(Boolean);
  }, [items, pathname]);

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

  // Scroll spy: section paling atas yang terlihat di sepertiga tengah layar menjadi anchor aktif.
  useEffect(() => {
    setActiveHash(window.location.hash.replace('#', ''));
    if (anchorIds.length === 0 || typeof IntersectionObserver === 'undefined') return;

    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top);
          else visible.delete(entry.target.id);
        }
        const top = [...visible.entries()].sort((a, b) => a[1] - b[1])[0];
        if (top) setActiveHash(top[0]);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: 0 },
    );
    const observe = () => anchorIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    observe();
    // Konten halaman bisa dipasang sesaat setelah navigasi (transisi halaman); amati ulang.
    const timer = window.setTimeout(observe, 500);
    const onHash = () => setActiveHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('hashchange', onHash);
      observer.disconnect();
    };
  }, [anchorIds, pathname]);

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

  function isCurrentPage(href: string): boolean {
    const itemPath = pathOf(href);
    if (itemPath === '/') return pathname === '/';
    return pathname === itemPath || pathname.startsWith(itemPath + '/');
  }

  function isActiveChild(child: MenuNode): boolean {
    const href = child.url || '';
    if (!href || !isCurrentPage(href)) return false;
    const hash = hashOf(href);
    return hash ? hash === activeHash : true;
  }

  function docLinks(item: MenuNode) {
    if (!item.key) return [];
    return site.docLinks
      .filter((doc) => doc.isActive && doc.category === item.key && !!doc.targetUrl)
      .map((doc) => {
        const desc = tr(doc.description, lang);
        return (
          <a
            key={`doc-${doc.id}`}
            href={doc.targetUrl ?? '#'}
            {...(doc.file || isSiteFile(doc.targetUrl) ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
            onClick={(event) => {
              if (!doc.targetUrl || !(doc.file || isSiteFile(doc.targetUrl)) || event.ctrlKey || event.metaKey || event.shiftKey) return;
              event.preventDefault();
              openFile(doc.file ? { url: doc.file.url, name: doc.file.originalName, mime: doc.file.mime } : { url: doc.targetUrl });
            }}
            className={styles.dropLink}
            role="menuitem"
          >
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
    const activeTop =
      isCurrentPage(href) ||
      children.some((child) => !!child.url && isCurrentPage(child.url)) ||
      (RELATED_PATHS[pathOf(href)] ?? []).some((path) => pathname === path || pathname.startsWith(path + '/'));

    if (children.length === 0 && docs.length === 0) {
      return (
        <Link key={groupKey} href={href} className={`${styles.link} ${activeTop ? styles.active : ''}`} aria-current={activeTop ? 'page' : undefined}>
          {label}
        </Link>
      );
    }

    return (
      <div key={groupKey} className={`${styles.itemDrop} ${openGroup === groupKey ? styles.expanded : ''}`}>
        <Link
          href={href}
          className={`${styles.link} ${styles.linkParent} ${activeTop ? styles.active : ''}`}
          aria-current={activeTop ? 'page' : undefined}
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
              const activeChild = isActiveChild(child);
              return (
                <Link
                  key={String(child.id ?? `${groupKey}-${ci}`)}
                  href={child.url || href}
                  className={`${styles.dropLink} ${activeChild ? styles.dropActive : ''}`}
                  role="menuitem"
                  aria-current={activeChild ? 'location' : undefined}
                >
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
