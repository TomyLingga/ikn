'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import LangToggle from '@/components/LangToggle';
import SidebarToggle from '@/components/SidebarToggle';
import SessionLoader from '@/components/SessionLoader';
import AdminFieldHelp from '@/components/admin/AdminFieldHelp';
import AdminChatDock from '@/components/admin/AdminChatDock';
import { useAuth } from '@/components/AuthProvider';
import { useLang } from '@/components/LanguageProvider';
import { api } from '@/lib/api';
import { ADMIN_BADGES_EVENT } from '@/lib/admin';
import type { IconName } from '@/lib/types';
import styles from './AdminShell.module.css';
import { openFile } from '@/components/FileViewer';

const roleLabels: Record<'super_admin' | 'admin', Record<'id' | 'en', string>> = {
  super_admin: { id: 'Super Admin', en: 'Super Admin' },
  admin: { id: 'Admin', en: 'Admin' },
};

// Menu href → backend module code (GET /admin/permissions/self → modules[]).
const moduleByHref: Record<string, string> = {
  '/admin/orders': 'orders',
  '/admin/payments': 'payments',
  '/admin/products': 'products',
  '/admin/product-categories': 'categories',
  '/admin/reviews': 'products',
  '/admin/customers': 'customers',
  '/admin/chat': 'chat',
  '/admin/shipping': 'shipping',
  '/admin/vouchers': 'vouchers',
  '/admin/payment-methods': 'payment_methods',
  '/admin/bank-accounts': 'bank_accounts',
  '/admin/additional-fees': 'fees',
  '/admin/checkout-settings': 'settings',
  '/admin/reports/sales': 'reports',
  '/admin/audit-logs': 'audit',
  '/admin/pages': 'cms',
  '/admin/navigation': 'cms',
  '/admin/customer-logos': 'cms',
  '/admin/content/media': 'media',
  '/admin/gallery': 'gallery',
  '/admin/news': 'news',
  '/admin/news-categories': 'news',
  '/admin/certificates': 'certificates',
  '/admin/brochures': 'brochures',
  '/admin/whistleblowing': 'wbs',
  '/admin/contact-messages': 'messages',
  '/admin/site-settings': 'settings',
  '/admin/users': 'users',
};

// Halaman yang hanya untuk super_admin (disembunyikan dari admin biasa walau modulnya ada).
const superAdminOnly = new Set(['/admin/audit-logs']);

// GET /admin/help-guide
interface HelpGuide {
  title: string;
  type: 'url' | 'file';
  url: string;
  file: { url: string; originalName: string } | null;
}

type Label = Record<'id' | 'en', string>;

interface NavItem {
  href: string;
  label: Label;
}
// Menu yang bisa dibuka-tutup (akordeon); `items` kosong setelah disaring izin = menu disembunyikan.
interface NavMenu {
  key: string;
  label: Label;
  icon: IconName;
  items: NavItem[];
}
interface NavSection {
  key: string;
  title: Label;
  menus: NavMenu[];
}

const dashboardLink = { href: '/admin', label: { id: 'Dashboard', en: 'Dashboard' }, icon: 'target' as IconName };

// Sidebar admin: tiga bagian, tiap bagian berisi beberapa menu berakordeon (hanya satu menu terbuka).
const navSections: NavSection[] = [
  {
    key: 'commerce',
    title: { id: 'Toko', en: 'Store' },
    menus: [
      {
        key: 'sales',
        label: { id: 'Penjualan', en: 'Sales' },
        icon: 'orders',
        items: [
          { href: '/admin/orders', label: { id: 'Order', en: 'Orders' } },
          { href: '/admin/payments', label: { id: 'Pembayaran', en: 'Payments' } },
          { href: '/admin/customers', label: { id: 'Customer', en: 'Customers' } },
          { href: '/admin/chat', label: { id: 'Live Chat', en: 'Live Chat' } },
          { href: '/admin/reports/sales', label: { id: 'Laporan Penjualan', en: 'Sales Reports' } },
        ],
      },
      {
        key: 'catalog',
        label: { id: 'Katalog', en: 'Catalog' },
        icon: 'package',
        items: [
          { href: '/admin/products', label: { id: 'Produk', en: 'Products' } },
          { href: '/admin/product-categories', label: { id: 'Kategori Produk', en: 'Product Categories' } },
          { href: '/admin/reviews', label: { id: 'Ulasan', en: 'Reviews' } },
        ],
      },
      {
        key: 'store-settings',
        label: { id: 'Pengaturan Toko', en: 'Store Settings' },
        icon: 'wallet',
        items: [
          { href: '/admin/shipping', label: { id: 'Ongkir', en: 'Shipping Rates' } },
          { href: '/admin/vouchers', label: { id: 'Voucher', en: 'Vouchers' } },
          { href: '/admin/additional-fees', label: { id: 'Biaya Tambahan', en: 'Additional Fees' } },
          { href: '/admin/payment-methods', label: { id: 'Metode Bayar', en: 'Payment Methods' } },
          { href: '/admin/bank-accounts', label: { id: 'Rekening Bank', en: 'Bank Accounts' } },
          { href: '/admin/checkout-settings', label: { id: 'Pengaturan Checkout', en: 'Checkout Settings' } },
        ],
      },
    ],
  },
  {
    key: 'content',
    title: { id: 'Konten', en: 'Content' },
    menus: [
      {
        key: 'pages',
        label: { id: 'Halaman & Menu', en: 'Pages & Menus' },
        icon: 'panelLeft',
        items: [
          { href: '/admin/pages', label: { id: 'Halaman', en: 'Pages' } },
          { href: '/admin/navigation', label: { id: 'Menu Navigasi', en: 'Navigation' } },
          { href: '/admin/content/media', label: { id: 'Video & Gambar', en: 'Media Library' } },
        ],
      },
      {
        key: 'news',
        label: { id: 'Berita & Galeri', en: 'News & Gallery' },
        icon: 'image',
        items: [
          { href: '/admin/news', label: { id: 'Berita', en: 'News' } },
          { href: '/admin/news-categories', label: { id: 'Kategori Berita', en: 'News Categories' } },
          { href: '/admin/gallery', label: { id: 'Galeri Foto', en: 'Gallery' } },
        ],
      },
      {
        key: 'documents',
        label: { id: 'Dokumen & Mitra', en: 'Documents & Partners' },
        icon: 'shieldCheck',
        items: [
          { href: '/admin/certificates', label: { id: 'Sertifikat', en: 'Certificates' } },
          { href: '/admin/brochures', label: { id: 'Brosur Unduhan', en: 'Brochures' } },
          { href: '/admin/customer-logos', label: { id: 'Logo Pelanggan', en: 'Customer Logos' } },
        ],
      },
      {
        key: 'inbox',
        label: { id: 'Kotak Masuk', en: 'Inbox' },
        icon: 'mail',
        items: [
          { href: '/admin/contact-messages', label: { id: 'Pesan Kontak', en: 'Contact Messages' } },
          { href: '/admin/whistleblowing', label: { id: 'Pelaporan WBS', en: 'WBS Reports' } },
        ],
      },
    ],
  },
  {
    key: 'system',
    title: { id: 'Sistem', en: 'System' },
    menus: [
      {
        key: 'settings',
        label: { id: 'Pengaturan', en: 'Settings' },
        icon: 'gear',
        items: [
          { href: '/admin/site-settings', label: { id: 'Pengaturan Situs', en: 'Site Settings' } },
          { href: '/admin/users', label: { id: 'Akun Admin', en: 'Admin Accounts' } },
          { href: '/admin/audit-logs', label: { id: 'Audit Log', en: 'Audit Log' } },
        ],
      },
    ],
  },
];

// Aktif bila persis sama atau berada di bawahnya ("/admin/news" tidak ikut aktif di "/admin/news-categories").
function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  // Badge jumlah per href menu: pembayaran menunggu verifikasi, customer menunggu persetujuan, chat belum dibaca.
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [helpGuideData, setHelpGuideData] = useState<HelpGuide | null>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const { admin, ready, logoutAdmin } = useAuth();
  const { lang } = useLang();

  const isLoginPage = pathname === '/admin/login';

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
    api<{ role: string; modules: string[] }>('/admin/permissions/self')
      .then((result) => {
        if (!cancelled) setAllowed(result.modules);
      })
      .catch(() => {
        if (!cancelled) setAllowed([]);
      });
    return () => {
      cancelled = true;
    };
  }, [admin]);

  // Badge sidebar dari GET /admin/badges: order dibayar yang masih berjalan, bukti bayar menunggu verifikasi, customer menunggu persetujuan, dan
  // percakapan chat yang belum dibaca (null = admin tidak punya modulnya). Dihitung ulang saat pindah halaman,
  // tiap 30 detik, saat jendela kembali aktif, dan ketika halaman lain memanggil refreshAdminBadges().
  const loadBadges = useCallback(async () => {
    if (!admin) {
      setBadges({});
      return;
    }
    try {
      const result = await api<{ orders?: number | null; payments: number | null; customers: number | null; chat: number | null }>('/admin/badges');
      setBadges({
        '/admin/orders': result.orders ?? 0,
        '/admin/payments': result.payments ?? 0,
        '/admin/customers': result.customers ?? 0,
        '/admin/chat': result.chat ?? 0,
      });
    } catch {
      // Badge bukan fitur kritis: biarkan nilai terakhir bila API sedang gagal.
    }
  }, [admin]);

  useEffect(() => {
    void loadBadges();
  }, [loadBadges, pathname]);

  useEffect(() => {
    const refresh = () => void loadBadges();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener(ADMIN_BADGES_EVENT, refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ADMIN_BADGES_EVENT, refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [loadBadges]);

  // Saring item menurut izin admin; menu dan bagian yang kosong ikut hilang.
  const visibleSections: NavSection[] = useMemo(() => {
    const allowedItem = (it: NavItem) => {
      if (!admin) return false;
      if (admin.role === 'super_admin') return true;
      if (superAdminOnly.has(it.href)) return false;
      const requiredModule = moduleByHref[it.href];
      if (!requiredModule) return true;
      return (allowed ?? []).includes(requiredModule);
    };
    return navSections
      .map((section) => ({
        ...section,
        menus: section.menus.map((menu) => ({ ...menu, items: menu.items.filter(allowedItem) })).filter((menu) => menu.items.length > 0),
      }))
      .filter((section) => section.menus.length > 0);
  }, [admin, allowed]);

  // Responsif & keyboard shortcut
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 1000; // sama dengan breakpoint drawer di AdminShell.module.css
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

  // Menu yang memuat halaman aktif terbuka otomatis saat rute berganti (akordeon: yang lain tertutup).
  useEffect(() => {
    const active = visibleSections.flatMap((section) => section.menus).find((menu) => menu.items.some((it) => isActivePath(pathname, it.href)));
    if (active) setOpenMenu(active.key);
  }, [pathname, visibleSections]);

  const toggleMenu = (key: string) => {
    // Sidebar ciut hanya menampilkan ikon: klik ikon melebarkan sidebar dan membuka menunya.
    if (collapsed && !isMobile) {
      setCollapsed(false);
      setOpenMenu(key);
      return;
    }
    setOpenMenu((current) => (current === key ? null : key));
  };

  const handleLogout = async () => {
    await logoutAdmin();
    router.replace('/admin/login');
  };

  const openHelpGuide = async () => {
    setProfileOpen(false);
    try {
      const data = await api<HelpGuide>('/admin/help-guide');

      if (data.type === 'url' && data.url) {
        window.open(data.url, '_blank', 'noopener');
      } else if (data.type === 'file' && data.file?.url) {
        openFile({ url: data.file.url, name: data.file.originalName });
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
      className={`${styles.shell} admin-app ${open ? styles.open : ''} ${
        collapsed ? styles.collapsed : ''
      }`}
    >
      <AdminFieldHelp />
      {/* Messaging dock: admins with the chat module, hidden on the full inbox page itself. */}
      {(admin.role === 'super_admin' || (allowed ?? []).includes('chat')) && !isActivePath(pathname, '/admin/chat') && (
        <AdminChatDock unread={badges['/admin/chat'] || 0} adminName={admin.name} />
      )}
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

        <nav className={styles.nav} aria-label={lang === 'en' ? 'Admin navigation' : 'Navigasi admin'}>
          <Link
            href={dashboardLink.href}
            className={`${styles.menuHead} ${pathname === dashboardLink.href ? styles.active : ''}`}
            onClick={() => setOpen(false)}
            title={collapsed && !isMobile ? dashboardLink.label[lang] : undefined}
          >
            <Icon name={dashboardLink.icon} size={17} />
            <span className={styles.menuLabel}>{dashboardLink.label[lang]}</span>
          </Link>

          {visibleSections.map((section) => (
            <div key={section.key} className={styles.navSection}>
              <span className={styles.sectionTitle}>{section.title[lang]}</span>
              {section.menus.map((menu) => {
                const isOpen = openMenu === menu.key;
                const hasActive = menu.items.some((it) => isActivePath(pathname, it.href));
                const menuBadge = menu.items.reduce((sum, it) => sum + (badges[it.href] || 0), 0);
                const panelId = `admin-menu-${menu.key}`;
                return (
                  <div key={menu.key} className={`${styles.menu} ${isOpen ? styles.menuOpen : ''}`}>
                    <button
                      type="button"
                      className={`${styles.menuHead} ${hasActive ? styles.menuHasActive : ''}`}
                      onClick={() => toggleMenu(menu.key)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      title={collapsed && !isMobile ? menu.label[lang] : undefined}
                    >
                      <Icon name={menu.icon} size={17} />
                      <span className={styles.menuLabel}>{menu.label[lang]}</span>
                      {/* Menu tertutup (atau sidebar ciut) tetap memperlihatkan jumlah yang menunggu di dalamnya. */}
                      {menuBadge > 0 && (!isOpen || collapsed) && (
                        <span className={`${styles.badge} ${styles.menuBadge}`} aria-label={`${menuBadge} ${lang === 'en' ? 'waiting' : 'menunggu'}`}>
                          {menuBadge > 99 ? '99+' : menuBadge}
                        </span>
                      )}
                      <Icon name="chevronRight" size={14} className={styles.menuChevron} />
                    </button>
                    <div id={panelId} className={styles.menuPanel}>
                      <div className={styles.menuItems}>
                        {menu.items.map((it) => (
                          <Link
                            key={it.href}
                            href={it.href}
                            className={`${styles.navLink} ${isActivePath(pathname, it.href) ? styles.active : ''}`}
                            onClick={() => setOpen(false)}
                            tabIndex={isOpen ? undefined : -1}
                          >
                            <span>{it.label[lang]}</span>
                            {(badges[it.href] || 0) > 0 && (
                              <span className={styles.badge} aria-label={`${badges[it.href]} ${lang === 'en' ? 'waiting' : 'menunggu'}`}>
                                {(badges[it.href] || 0) > 99 ? '99+' : badges[it.href]}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
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
                    ? 'As a Super Admin, you can set the URL link or upload a PDF manual under "Admin Accounts" > "Help guide".'
                    : 'Sebagai Super Admin, Anda dapat mengatur tautan URL atau mengunggah manual PDF di menu "Akun Admin" > "Petunjuk penggunaan".'}
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
