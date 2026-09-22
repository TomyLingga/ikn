'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import LangToggle from '@/components/LangToggle';
import SidebarToggle from '@/components/SidebarToggle';
import SessionLoader from '@/components/SessionLoader';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api } from '@/lib/api';
import type { IconName } from '@/lib/types';
import styles from './AdminShell.module.css';

const roleLabels: Record<'super_admin' | 'admin', Record<'id' | 'en', string>> = {
  super_admin: { id: 'Super Admin', en: 'Super Admin' },
  admin: { id: 'Admin', en: 'Admin' },
};

// Peta href menu → modul permission backend.
const moduleByHref: Record<string, string> = {
  '/admin/orders': 'orders',
  '/admin/payments': 'payments',
  '/admin/products': 'products',
  '/admin/product-categories': 'categories',
  '/admin/customers': 'customers',
  '/admin/bank-accounts': 'bank',
  '/admin/additional-fees': 'fees',
  '/admin/reports/sales': 'reports',
  '/admin/navigation': 'menu',
  '/admin/content/media': 'gallery',
  '/admin/gallery': 'gallery',
  '/admin/news': 'news',
  '/admin/certificates': 'content',
  '/admin/history': 'content',
  '/admin/vision-mission': 'content',
  '/admin/contact': 'content',
  '/admin/brochures': 'content',
  '/admin/whistleblowing': 'wbs',
  '/admin/users': 'users',
};

interface NavItem {
  href: string;
  label: string;
  icon: IconName;
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

// Grup menu navigasi admin ID.
const groupsId: NavGroup[] = [
  {
    title: 'Utama',
    items: [{ href: '/admin', label: 'Dashboard', icon: 'target' }],
  },
  {
    title: 'Commerce',
    items: [
      { href: '/admin/orders', label: 'Order', icon: 'drop' },
      { href: '/admin/payments', label: 'Payment', icon: 'check' },
      { href: '/admin/products', label: 'Produk', icon: 'flask' },
      { href: '/admin/product-categories', label: 'Kategori Produk', icon: 'gear' },
      { href: '/admin/customers', label: 'Customer', icon: 'handshake' },
      { href: '/admin/bank-accounts', label: 'Akun Bank', icon: 'target' },
      { href: '/admin/additional-fees', label: 'Pengaturan Checkout', icon: 'gear' },
      { href: '/admin/reports/sales', label: 'Laporan Penjualan', icon: 'compass' },
    ],
  },
  {
    title: 'Konten',
    items: [
      { href: '/admin/navigation', label: 'Hirarki Navigasi', icon: 'compass' },
      { href: '/admin/content/media', label: 'Video & Gambar', icon: 'play' },
      { href: '/admin/news', label: 'Berita', icon: 'quote' },
      { href: '/admin/certificates', label: 'Sertifikat', icon: 'check' },
      { href: '/admin/history', label: 'Sejarah', icon: 'compass' },
      { href: '/admin/vision-mission', label: 'Visi & Misi', icon: 'target' },
      { href: '/admin/contact', label: 'Kontak Kami', icon: 'pin' },
      { href: '/admin/gallery', label: 'Galeri Foto', icon: 'play' },
      { href: '/admin/brochures', label: 'Brosur Unduhan', icon: 'quote' },
      { href: '/admin/whistleblowing', label: 'Pelaporan WBS', icon: 'leaf' },
    ],
  },
  {
    title: 'Sistem',
    items: [{ href: '/admin/users', label: 'Akun Admin', icon: 'handshake' }],
  },
];

// Grup menu navigasi admin EN.
const groupsEn: NavGroup[] = [
  {
    title: 'Main',
    items: [{ href: '/admin', label: 'Dashboard', icon: 'target' }],
  },
  {
    title: 'Commerce',
    items: [
      { href: '/admin/orders', label: 'Orders', icon: 'drop' },
      { href: '/admin/payments', label: 'Payments', icon: 'check' },
      { href: '/admin/products', label: 'Products', icon: 'flask' },
      { href: '/admin/product-categories', label: 'Product Categories', icon: 'gear' },
      { href: '/admin/customers', label: 'Customers', icon: 'handshake' },
      { href: '/admin/bank-accounts', label: 'Bank Accounts', icon: 'target' },
      { href: '/admin/additional-fees', label: 'Checkout Settings', icon: 'gear' },
      { href: '/admin/reports/sales', label: 'Sales Reports', icon: 'compass' },
    ],
  },
  {
    title: 'Content',
    items: [
      { href: '/admin/navigation', label: 'Navigation Hierarchy', icon: 'compass' },
      { href: '/admin/content/media', label: 'Videos & Media', icon: 'play' },
      { href: '/admin/news', label: 'News & Press', icon: 'quote' },
      { href: '/admin/certificates', label: 'Certificates', icon: 'check' },
      { href: '/admin/history', label: 'Company History', icon: 'compass' },
      { href: '/admin/vision-mission', label: 'Vision & Mission', icon: 'target' },
      { href: '/admin/contact', label: 'Contact Details', icon: 'pin' },
      { href: '/admin/gallery', label: 'Photo Gallery', icon: 'play' },
      { href: '/admin/brochures', label: 'Brochure Downloads', icon: 'quote' },
      { href: '/admin/whistleblowing', label: 'WBS Reports', icon: 'leaf' },
    ],
  },
  {
    title: 'System',
    items: [{ href: '/admin/users', label: 'Admin Accounts', icon: 'handshake' }],
  },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpGuideData, setHelpGuideData] = useState<{
    title: string;
    type: 'url' | 'file';
    url: string;
    filePath: string;
    fileName: string;
  } | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { admin, customer, ready, logoutAdmin } = useAuth();
  const { lang } = useLang();

  const isLoginPage = pathname === '/admin/login';
  const groups = lang === 'en' ? groupsEn : groupsId;

  // Auto-close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileOpen]);

  // Ambil daftar modul yang boleh diakses admin ini (sekali per sesi).
  useEffect(() => {
    if (!admin) {
      setAllowed(null);
      return;
    }
    let cancelled = false;
    api<{ role: string; allowed: string[] }>('/admin/permissions/self')
      .then((result) => {
        if (!cancelled) setAllowed(result.allowed);
      })
      .catch(() => {
        if (!cancelled) setAllowed([]);
      });
    return () => {
      cancelled = true;
    };
  }, [admin]);

  // Filter menu berdasarkan permission admin.
  const visibleGroups: NavGroup[] = groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => {
        if (!admin) return false;
        if (admin.role === 'super_admin') return true;
        if (it.href === '/admin') return true;
        const requiredModule = moduleByHref[it.href];
        if (!requiredModule) return true;
        return (allowed ?? []).includes(requiredModule);
      }),
    }))
    .filter((g) => g.items.length > 0);

  // Responsif & keyboard shortcut
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (mobile) setCollapsed(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Shortcut key `[` untuk toggle sidebar (desktop)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '[' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Auto-expand group yang berisi halaman aktif
  useEffect(() => {
    const activeGroup = visibleGroups.find((g) =>
      g.items.some((it) =>
        it.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(it.href)
      )
    );
    if (activeGroup) {
      setExpandedGroups((prev) => ({
        ...prev,
        [activeGroup.title]: true,
      }));
    }
  }, [pathname, allowed]);

  const toggleGroup = (title: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const handleLogout = async () => {
    await logoutAdmin();
    router.replace('/admin/login');
  };

  const openHelpGuide = async () => {
    setProfileOpen(false);
    try {
      const data = await api<{
        title: string;
        type: 'url' | 'file';
        url: string;
        filePath: string;
        fileName: string;
      }>('/admin/help-guide');

      if (data.type === 'url' && data.url) {
        window.open(data.url, '_blank');
      } else if (data.type === 'file' && data.filePath) {
        window.open(data.filePath, '_blank');
      } else {
        setHelpGuideData(data);
        setHelpModalOpen(true);
      }
    } catch {
      setHelpGuideData(null);
      setHelpModalOpen(true);
    }
  };

  // Redirect jika belum login admin (kecuali halaman login)
  useEffect(() => {
    if (ready && !admin && !isLoginPage) {
      router.replace('/admin/login');
    }
  }, [ready, admin, isLoginPage, router]);

  // JIKA sedang di halaman /admin/login
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Jika auth belum siap / sedang loading
  if (!ready || !admin) {
    return (
      <SessionLoader
        message={lang === 'en' ? 'Loading admin session...' : 'Memuat sesi admin...'}
        portalName={lang === 'en' ? 'Admin Backoffice' : 'Back-office Admin'}
      />
    );
  }

  const roleText = roleLabels[admin.role]?.[lang] || roleLabels[admin.role]?.id || admin.role;
  const initials = (admin?.name || 'AD')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AD';

  const toggleSidebar = () => {
    if (isMobile) {
      setOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  };

  return (
    <div
      className={`${styles.shell} ${open ? styles.open : ''} ${
        collapsed ? styles.collapsed : ''
      }`}
    >
      {/* ASIDE / SIDEBAR */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <Link href="/admin" className={styles.brandLink}>
            <Image
              src="/img/rubin-logo.png"
              alt="Logo PT IKN"
              width={34}
              height={34}
              priority
            />
            <div className={styles.brandMeta}>
              <strong>PT Industri Karet Nusantara</strong>
              <small>{lang === 'en' ? 'Admin Portal' : 'Panel Administrasi'}</small>
            </div>
          </Link>
        </div>

        <nav className={styles.nav} aria-label="Navigasi admin">
          {visibleGroups.map((g) => {
            const isGroupOpen = expandedGroups[g.title] !== false; // Default open
            const hasActiveChild = g.items.some((it) =>
              it.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(it.href)
            );

            return (
              <div
                key={g.title}
                className={`${styles.navGroup} ${
                  hasActiveChild ? styles.groupHasActive : ''
                }`}
              >
                <button
                  type="button"
                  className={styles.groupHead}
                  onClick={() => toggleGroup(g.title)}
                  title={collapsed && !isMobile ? g.title : undefined}
                >
                  <span className={styles.groupTitle}>{g.title}</span>
                  {!collapsed && (
                    <Icon
                      name="chevronRight"
                      size={14}
                      className={`${styles.groupChevron} ${
                        isGroupOpen ? styles.chevronOpen : ''
                      }`}
                    />
                  )}
                </button>

                <div
                  className={`${styles.groupItems} ${
                    isGroupOpen ? styles.itemsOpen : styles.itemsClosed
                  }`}
                >
                  {g.items.map((it) => {
                    const active =
                      it.href === '/admin'
                        ? pathname === '/admin'
                        : pathname.startsWith(it.href);
                    return (
                      <Link
                        key={it.href}
                        href={it.href}
                        className={`${styles.navLink} ${active ? styles.active : ''}`}
                        onClick={() => setOpen(false)}
                        title={collapsed && !isMobile ? it.label : undefined}
                      >
                        <Icon name={it.icon} size={17} />
                        <span>{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <button
          type="button"
          className={styles.logout}
          onClick={() => void handleLogout()}
          title={collapsed && !isMobile ? (lang === 'en' ? 'Logout' : 'Keluar') : undefined}
        >
          <Icon name="arrow" size={16} /> <span>{lang === 'en' ? 'Logout' : 'Keluar'}</span>
        </button>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <SidebarToggle
            expanded={isMobile ? open : collapsed}
            onClick={toggleSidebar}
            openLabel={lang === 'en' ? 'Open admin menu' : 'Buka menu admin'}
            closeLabel={
              isMobile
                ? lang === 'en' ? 'Close admin menu' : 'Tutup menu admin'
                : lang === 'en' ? 'Collapse admin sidebar' : 'Ciutkan sidebar admin'
            }
          />
          <div className={styles.topActions}>
            <LangToggle />
            <ThemeToggle />
            <Link href="/" className={styles.siteLink}>
              {lang === 'en' ? 'View site' : 'Lihat situs'}
            </Link>
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className={styles.user}
                onClick={() => setProfileOpen((v) => !v)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0 }}
                title={lang === 'en' ? 'View Admin Profile' : 'Lihat Profil Admin'}
              >
                <span className={styles.avatar}>{initials}</span>
                <span className={styles.userMeta}>
                  <strong>{admin.name}</strong>
                  <small>{roleText}</small>
                </span>
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: 280,
                    background: 'var(--surface)',
                    border: '1px solid var(--line-strong)',
                    borderRadius: 16,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
                    padding: 18,
                    zIndex: 1000,
                    animation: 'modalScaleUp 0.18s ease-out',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--line)' }}>
                    <span className={styles.avatar} style={{ width: 44, height: 44, fontSize: '1.05rem', flexShrink: 0, background: 'var(--green-tint)', color: 'var(--green)', border: '1px solid var(--green)' }}>
                      {initials}
                    </span>
                    <div style={{ overflow: 'hidden' }}>
                      <strong style={{ display: 'block', fontSize: '0.92rem', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {admin.name}
                      </strong>
                      <span className="mono" style={{ display: 'block', fontSize: '0.74rem', color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                        {admin.email}
                      </span>
                      <span className="badge badge-green" style={{ display: 'inline-block', marginTop: 6, fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4 }}>
                        {roleText}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button
                      type="button"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.2s var(--ease)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--green)';
                        e.currentTarget.style.color = 'var(--green)';
                        e.currentTarget.style.background = 'var(--green-tint)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--line)';
                        e.currentTarget.style.color = 'var(--ink)';
                        e.currentTarget.style.background = 'var(--paper)';
                      }}
                      onClick={() => void openHelpGuide()}
                    >
                      <Icon name="compass" size={16} /> {lang === 'en' ? 'Help & User Manual' : 'Petunjuk Penggunaan'}
                    </button>
                    <Link
                      href="/"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid var(--line)',
                        borderRadius: 8,
                        background: 'var(--paper)',
                        color: 'var(--ink)',
                        fontSize: '0.84rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        textDecoration: 'none',
                        transition: 'all 0.2s var(--ease)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--amber)';
                        e.currentTarget.style.color = 'var(--amber)';
                        e.currentTarget.style.background = 'var(--amber-tint)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--line)';
                        e.currentTarget.style.color = 'var(--ink)';
                        e.currentTarget.style.background = 'var(--paper)';
                      }}
                      onClick={() => setProfileOpen(false)}
                    >
                      <Icon name="arrow" size={16} /> {lang === 'en' ? 'View Public Site' : 'Lihat Situs Publik'}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={styles.content}>{children}</div>
      </div>

      {helpModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setHelpModalOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="admin-modal-head">
              <h2>{helpGuideData?.title || (lang === 'en' ? 'Help & User Manual' : 'Petunjuk Penggunaan Aplikasi')}</h2>
              <button type="button" className="admin-modal-close" onClick={() => setHelpModalOpen(false)}>✕</button>
            </div>
            <div style={{ padding: 20 }}>
              <p className="admin-note" style={{ lineHeight: 1.6, marginBottom: 16 }}>
                {lang === 'en'
                  ? 'The user guide or application documentation has not been configured by the Super Admin yet.'
                  : 'Petunjuk penggunaan atau dokumentasi aplikasi belum diatur oleh Super Admin.'}
              </p>
              {admin.role === 'super_admin' && (
                <p className="admin-note" style={{ color: 'var(--green)', fontWeight: 600 }}>
                  {lang === 'en'
                    ? 'As a Super Admin, you can set the URL link or upload PDF/DOCX/PPT manual in "Akun Admin & Pengaturan Sistem".'
                    : 'Sebagai Super Admin, Anda dapat mengatur link URL atau mengunggah manual PDF/DOCX/PPT di menu "Akun Admin & Pengaturan Sistem".'}
                </p>
              )}
              <div className="admin-modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="btn btn-line btn-sm" onClick={() => setHelpModalOpen(false)}>
                  {lang === 'en' ? 'Close' : 'Tutup'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        className={styles.scrim}
        type="button"
        aria-label={lang === 'en' ? 'Close admin menu' : 'Tutup menu admin'}
        aria-hidden={!open}
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
    </div>
  );
}
