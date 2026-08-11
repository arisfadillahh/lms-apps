'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bell,
  BookMarked,
  BookOpen,
  CalendarOff,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  Image as ImageIcon,
  LogOut,
  Menu,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Package,
  Receipt,
  Search,
  Settings,
  UserCheck,
  UserRoundPlus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';

import SignOutButton from '@/components/SignOutButton';
import { isSuperAdmin, type AdminPermissions } from '@/lib/permissions';

type AdminChromeUser = {
  id: string;
  fullName: string;
  role: string;
  username?: string;
  avatarPath?: string | null;
  adminPermissions?: AdminPermissions | null;
};

type AdminChromeProps = {
  children: ReactNode;
  user: AdminChromeUser;
};

type MenuId =
  | 'dashboard'
  | 'users'
  | 'freeTrials'
  | 'trialAssessments'
  | 'classes'
  | 'curriculum'
  | 'lessonReports'
  | 'ekskul'
  | 'evaluations'
  | 'evaluationQuestions'
  | 'reports'
  | 'payments'
  | 'invoices'
  | 'ccr'
  | 'ccrlist'
  | 'whatsapp'
  | 'broadcast'
  | 'software'
  | 'banners'
  | 'leave'
  | 'settings';

type MenuItem = {
  id: MenuId;
  href: string;
  label: string;
  icon: LucideIcon;
};

type RouteTab = {
  href: string;
  label: string;
  menus?: MenuId[] | null;
};

type RouteMeta = {
  key: string;
  section: string;
  title: string;
  description: string;
  tabs?: RouteTab[];
};

const FIXED_SHELL = {
  direction: 'playful',
  theme: 'light',
  density: 'comfortable',
  sidebar: 'wide',
} as const;

const MENU: MenuItem[] = [
  { id: 'dashboard', href: '/admin/dashboard', label: 'Dashboard', icon: Home },
  { id: 'users', href: '/admin/users', label: 'Pengguna', icon: Users },
  { id: 'freeTrials', href: '/admin/free-trials', label: 'Free Trial', icon: UserRoundPlus },
  { id: 'trialAssessments', href: '/admin/trial-assessments', label: 'Review Trial', icon: ClipboardList },
  { id: 'classes', href: '/admin/classes', label: 'Kelas', icon: GraduationCap },
  { id: 'curriculum', href: '/admin/curriculum', label: 'Kurikulum', icon: BookOpen },
  { id: 'lessonReports', href: '/admin/curriculum/reports', label: 'Laporan Lesson', icon: FileText },
  { id: 'ekskul', href: '/admin/ekskul', label: 'Ekskul Plans', icon: BookMarked },
  { id: 'evaluations', href: '/admin/evaluations', label: 'Kompetensi Rapor', icon: ClipboardList },
  { id: 'evaluationQuestions', href: '/admin/evaluations/questions', label: 'Pertanyaan Refleksi', icon: MessageSquare },
  { id: 'reports', href: '/admin/reports', label: 'Status Rapor', icon: FileText },
  { id: 'payments', href: '/admin/payments', label: 'Paket & Tarif', icon: Wallet },
  { id: 'invoices', href: '/admin/payments/invoices', label: 'Invoice', icon: Receipt },
  { id: 'ccr', href: '/admin/coders/assign-ccr', label: 'Assign ID Invoice', icon: UserCheck },
  { id: 'ccrlist', href: '/admin/coders/list-ccr', label: 'Daftar ID Invoice', icon: FileText },
  { id: 'whatsapp', href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { id: 'broadcast', href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
  { id: 'software', href: '/admin/software', label: 'Software', icon: Package },
  { id: 'banners', href: '/admin/banners', label: 'Banner', icon: ImageIcon },
  { id: 'leave', href: '/admin/leave', label: 'Izin Coach', icon: CalendarOff },
  { id: 'settings', href: '/admin/settings', label: 'Settings', icon: Settings },
];

const MENU_SECTIONS: Array<{ label: string | null; items: MenuId[] }> = [
  { label: null, items: ['dashboard'] },
  {
    label: 'Akademik',
    items: ['users', 'freeTrials', 'trialAssessments', 'classes', 'curriculum', 'ekskul', 'lessonReports', 'evaluations', 'evaluationQuestions', 'reports'],
  },
  { label: 'Keuangan', items: ['payments', 'invoices', 'ccr', 'ccrlist'] },
  { label: 'Komunikasi', items: ['whatsapp', 'broadcast'] },
  { label: 'Sistem', items: ['software', 'banners', 'leave', 'settings'] },
];

const SECTION_TABS = {
  academic: [
    { href: '/admin/users', label: 'Pengguna', menus: ['users'] },
    { href: '/admin/free-trials', label: 'Free Trial', menus: ['freeTrials'] },
    { href: '/admin/trial-assessments', label: 'Review Trial', menus: ['trialAssessments'] },
    { href: '/admin/classes', label: 'Kelas', menus: ['classes'] },
    { href: '/admin/curriculum', label: 'Kurikulum', menus: ['curriculum'] },
    { href: '/admin/ekskul', label: 'Ekskul', menus: ['ekskul'] },
    { href: '/admin/evaluations', label: 'Rapor', menus: ['evaluations'] },
    { href: '/admin/reports', label: 'Status Rapor', menus: ['reports'] },
  ],
  payments: [
    { href: '/admin/payments', label: 'Paket & Tarif', menus: ['payments'] },
    { href: '/admin/payments/invoices', label: 'Invoice', menus: ['invoices'] },
    { href: '/admin/payments/pricing', label: 'Harga Level', menus: ['payments'] },
    { href: '/admin/payments/registration', label: 'Registrasi', menus: ['payments', 'invoices'] },
    { href: '/admin/payments/coders', label: 'Periode Coder', menus: ['payments', 'invoices'] },
    { href: '/admin/payments/expired', label: 'Expired', menus: ['payments', 'invoices'] },
  ],
  whatsapp: [
    { href: '/admin/whatsapp', label: 'Server', menus: ['whatsapp'] },
    { href: '/admin/whatsapp/templates', label: 'Template', menus: ['whatsapp'] },
    { href: '/admin/broadcast', label: 'Broadcast', menus: ['broadcast'] },
  ],
  settings: [
    { href: '/admin/settings', label: 'Overview', menus: ['settings'] },
    { href: '/admin/settings/invoice', label: 'Invoice', menus: ['settings'] },
    { href: '/admin/settings/whatsapp', label: 'WhatsApp', menus: ['settings'] },
  ],
} satisfies Record<string, RouteTab[]>;

const ROUTE_META: Array<{ match: string; meta: RouteMeta }> = [
  {
    match: '/admin/trial-assessments',
    meta: {
      key: 'trial-assessments',
      section: 'Akademik',
      title: 'Review Trial',
      description: 'Review assessment trial coach, publish parent report, dan pantau conversion weekly.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/free-trials',
    meta: {
      key: 'free-trials',
      section: 'Akademik',
      title: 'Free Trial',
      description: 'Pantau pendaftar trial class dan preferensi jadwal yang dikirim orang tua.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/settings/whatsapp',
    meta: {
      key: 'settings-whatsapp',
      section: 'Sistem',
      title: 'Pengaturan WhatsApp',
      description: 'Kelola koneksi gateway, pengiriman pesan, dan template komunikasi otomatis.',
      tabs: SECTION_TABS.settings,
    },
  },
  {
    match: '/admin/settings/invoice',
    meta: {
      key: 'settings-invoice',
      section: 'Sistem',
      title: 'Pengaturan Invoice',
      description: 'Atur rekening, jadwal invoice, reminder pembayaran, dan template konfirmasi.',
      tabs: SECTION_TABS.settings,
    },
  },
  {
    match: '/admin/payments/invoices',
    meta: {
      key: 'payments-invoices',
      section: 'Keuangan',
      title: 'Invoice',
      description: 'Pantau status pembayaran, reminder, dan histori pelunasan per periode belajar.',
      tabs: SECTION_TABS.payments,
    },
  },
  {
    match: '/admin/payments/pricing',
    meta: {
      key: 'payments-pricing',
      section: 'Keuangan',
      title: 'Harga per Level',
      description: 'Sesuaikan base price, diskon, dan struktur biaya untuk semua level belajar.',
      tabs: SECTION_TABS.payments,
    },
  },
  {
    match: '/admin/payments/registration',
    meta: {
      key: 'payments-registration',
      section: 'Keuangan',
      title: 'Registrasi Weekly',
      description: 'Kelola biaya pendaftaran awal dan invoice onboarding untuk siswa baru.',
      tabs: SECTION_TABS.payments,
    },
  },
  {
    match: '/admin/payments/coders',
    meta: {
      key: 'payments-coders',
      section: 'Keuangan',
      title: 'Periode Belajar Coder',
      description: 'Mapping periode pembayaran ke coder aktif untuk kontrol tagihan dan perpanjangan.',
      tabs: SECTION_TABS.payments,
    },
  },
  {
    match: '/admin/payments/expired',
    meta: {
      key: 'payments-expired',
      section: 'Keuangan',
      title: 'Monitoring Expired',
      description: 'Follow up periode belajar yang hampir habis atau sudah lewat jatuh tempo.',
      tabs: SECTION_TABS.payments,
    },
  },
  {
    match: '/admin/payments',
    meta: {
      key: 'payments',
      section: 'Keuangan',
      title: 'Paket & Tarif',
      description: 'Pusat kontrol paket pembayaran, reminder, harga level, dan tagihan coder.',
      tabs: SECTION_TABS.payments,
    },
  },
  {
    match: '/admin/whatsapp/templates',
    meta: {
      key: 'whatsapp-templates',
      section: 'Komunikasi',
      title: 'Template WhatsApp',
      description: 'Atur salinan pesan operasional agar reminder dan notifikasi selalu konsisten.',
      tabs: SECTION_TABS.whatsapp,
    },
  },
  {
    match: '/admin/whatsapp',
    meta: {
      key: 'whatsapp',
      section: 'Komunikasi',
      title: 'WhatsApp Server',
      description: 'Monitor koneksi, log pengiriman, dan reminder otomatis langsung dari satu panel.',
      tabs: SECTION_TABS.whatsapp,
    },
  },
  {
    match: '/admin/broadcast',
    meta: {
      key: 'broadcast',
      section: 'Komunikasi',
      title: 'Broadcast',
      description: 'Kirim pesan massal ke segmen orang tua, coder, atau coach dengan kontrol delivery.',
      tabs: SECTION_TABS.whatsapp,
    },
  },
  {
    match: '/admin/curriculum/reports',
    meta: {
      key: 'curriculum-reports',
      section: 'Akademik',
      title: 'Laporan Lesson',
      description: 'Lacak issue lesson, histori materi, dan tindak lanjut kualitas pembelajaran.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/curriculum',
    meta: {
      key: 'curriculum',
      section: 'Akademik',
      title: 'Perencanaan Kurikulum',
      description: 'Susun level, block, lesson, dan struktur belajar yang dipakai di semua kelas aktif.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/classes',
    meta: {
      key: 'classes',
      section: 'Akademik',
      title: 'Kelas',
      description: 'Kelola roster, jadwal, dan progres kelas weekly maupun ekskul di satu tempat.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/users',
    meta: {
      key: 'users',
      section: 'Akademik',
      title: 'Manajemen Pengguna',
      description: 'Atur akun admin, coach, dan coder beserta status aktif dan hak aksesnya.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/ekskul',
    meta: {
      key: 'ekskul',
      section: 'Akademik',
      title: 'Ekskul Plans',
      description: 'Kelola track ekskul, lesson plan sekolah, dan kebutuhan materi per semester.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/evaluations/questions',
    meta: {
      key: 'evaluations-questions',
      section: 'Akademik',
      title: 'Pertanyaan Refleksi',
      description: 'Kurasi pertanyaan refleksi yang muncul di rapor agar konsisten lintas level.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/evaluations',
    meta: {
      key: 'evaluations',
      section: 'Akademik',
      title: 'Kompetensi Rapor',
      description: 'Definisikan rubrik, indikator, dan template penilaian untuk laporan siswa.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/reports',
    meta: {
      key: 'reports',
      section: 'Akademik',
      title: 'Status Rapor',
      description: 'Kelola inbox rapor, approval admin, dan distribusi laporan ke orang tua.',
      tabs: SECTION_TABS.academic,
    },
  },
  {
    match: '/admin/software',
    meta: {
      key: 'software',
      section: 'Sistem',
      title: 'Software Inventory',
      description: 'Catat software yang dipakai di kurikulum beserta versi, akses, dan distribusinya.',
    },
  },
  {
    match: '/admin/banners',
    meta: {
      key: 'banners',
      section: 'Sistem',
      title: 'Banner',
      description: 'Kelola banner yang tampil di dashboard coder agar informasi penting selalu muncul.',
    },
  },
  {
    match: '/admin/leave',
    meta: {
      key: 'leave',
      section: 'Sistem',
      title: 'Izin Coach',
      description: 'Review permintaan izin, pengganti coach, dan follow up operasional pengajaran.',
    },
  },
  {
    match: '/admin/settings',
    meta: {
      key: 'settings',
      section: 'Sistem',
      title: 'Settings',
      description: 'Pusat konfigurasi invoice, WhatsApp, dan pengaturan penting operasional LMS.',
      tabs: SECTION_TABS.settings,
    },
  },
  {
    match: '/admin/profile',
    meta: {
      key: 'profile',
      section: 'Akun',
      title: 'Profile & Keamanan',
      description: 'Perbarui identitas admin, password, dan preferensi akun.',
    },
  },
  {
    match: '/admin/dashboard',
    meta: {
      key: 'dashboard',
      section: 'Overview',
      title: 'Dashboard',
      description: 'Pantau sesi, rapor, pembayaran, dan komunikasi harian dari satu command center.',
    },
  },
];

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function isActivePath(pathname: string, href: string) {
  if (href === '/admin/curriculum' && pathname.startsWith('/admin/curriculum/reports')) {
    return false;
  }
  if (href === '/admin/payments' && pathname.startsWith('/admin/payments/')) {
    return false;
  }
  if (href === '/admin/evaluations' && pathname.startsWith('/admin/evaluations/')) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRouteMeta(pathname: string): RouteMeta {
  return ROUTE_META.find((entry) => pathname.startsWith(entry.match))?.meta ?? {
    key: 'default',
    section: 'Admin',
    title: 'Admin Workspace',
    description: 'Panel operasional untuk mengelola aktivitas LMS Clevio.',
  };
}

export default function AdminChrome({ children, user }: AdminChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const routeMeta = useMemo(() => getRouteMeta(pathname), [pathname]);

  const permissions = user.adminPermissions ?? null;
  const superAdmin = isSuperAdmin(user.username ?? 'admin', permissions);

  const visibleMenu = useMemo(
    () =>
      MENU.filter((item) => {
        if (item.id === 'dashboard') return true;
        if (superAdmin) return true;
        return permissions?.menus?.includes(item.id) ?? false;
      }),
    [permissions?.menus, superAdmin],
  );

  const visibleMenuIds = new Set(visibleMenu.map((item) => item.id));
  const visibleTabs = (routeMeta.tabs ?? []).filter((tab) => {
    if (superAdmin || tab.menus === null) return true;
    return tab.menus?.some((menu) => visibleMenuIds.has(menu)) ?? false;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((prev) => !prev);
      }

      if (event.key === 'Escape') {
        setCommandOpen(false);
        setMobileNavOpen(false);
        setProfileOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filteredCommandItems = visibleMenu.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const closeTransientUi = () => {
    setCommandOpen(false);
    setMobileNavOpen(false);
    setProfileOpen(false);
    setSearchQuery('');
  };

  const goTo = (href: string) => {
    closeTransientUi();
    router.push(href);
  };

  return (
    <>
      <div
        className="app"
        data-admin-shell="true"
        data-direction={FIXED_SHELL.direction}
        data-theme={FIXED_SHELL.theme}
        data-density={FIXED_SHELL.density}
        data-sidebar={FIXED_SHELL.sidebar}
      >
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">C</div>
            <div className="brand-text">LMS Clevio</div>
          </div>

          <div className="sidebar-scroll">
            {MENU_SECTIONS.map((section) => {
              const items = section.items
                .map((id) => visibleMenu.find((item) => item.id === id))
                .filter((item): item is MenuItem => Boolean(item));

              if (items.length === 0) {
                return null;
              }

              return (
                <div key={section.label ?? 'root'} style={{ marginBottom: 4 }}>
                  {section.label ? <div className="nav-section">{section.label}</div> : null}
                  <nav className="nav">
                    {items.map((item) => {
                      const active = isActivePath(pathname, item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={`nav-item${active ? ' active' : ''}`}
                          onClick={closeTransientUi}
                        >
                          <Icon />
                          <span className="nav-item-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="main">
          <header className="topbar">
            <button
              type="button"
              className="btn btn-icon btn-ghost admin-mobile-toggle"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka navigasi"
            >
              <Menu />
            </button>

            <div
              className="searchbar"
              role="button"
              tabIndex={0}
              onClick={() => setCommandOpen(true)}
              onKeyDown={(e) => e.key === 'Enter' && setCommandOpen(true)}
              style={{ cursor: 'pointer' }}
            >
              <Search />
              <input
                placeholder="Cari kelas, coder, coach, invoice..."
                readOnly
                style={{ cursor: 'pointer', pointerEvents: 'none' }}
              />
              <span className="kbd admin-search-kbd">Ctrl K</span>
            </div>

            <div className="flex1" />

            <button type="button" className="btn btn-icon btn-ghost admin-bell-button" aria-label="Notifikasi">
              <Bell />
              <span className="admin-bell-dot" />
            </button>

            <button type="button" className="admin-profile-chip" onClick={() => setProfileOpen((prev) => !prev)}>
              {user.avatarPath ? (
                <Image
                  src={user.avatarPath}
                  alt={user.fullName}
                  width={36}
                  height={36}
                  unoptimized
                  className="admin-profile-avatar-image"
                />
              ) : (
                <div className="avatar avatar-lg admin-profile-avatar">{getInitials(user.fullName)}</div>
              )}

              <div className="hide-sm" style={{ minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, fontSize: 12.5, lineHeight: 1.1 }} className="truncate">
                  {user.fullName}
                </div>
                <div style={{ fontSize: 10.5 }} className="muted">
                  {superAdmin ? 'Super Admin' : 'Admin'}
                </div>
              </div>

              <ChevronDown size={14} />
            </button>
          </header>

          <div className="page">
            <div className="admin-route-shell" data-admin-route={routeMeta.key}>
              {visibleTabs.length > 1 ? (
                <nav className="tabs" aria-label={`${routeMeta.section} navigation`}>
                  {visibleTabs.map((tab) => (
                    <Link
                      key={tab.href}
                      href={tab.href}
                      className={`tab${isActivePath(pathname, tab.href) ? ' active' : ''}`}
                      onClick={closeTransientUi}
                    >
                      {tab.label}
                    </Link>
                  ))}
                </nav>
              ) : null}

              <div className="admin-route-content">{children}</div>
            </div>
          </div>
        </div>

      {mobileNavOpen ? (
        <div className="modal-backdrop admin-mobile-backdrop" onClick={() => setMobileNavOpen(false)}>
          <div className="admin-mobile-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="admin-mobile-sheet-header">
              <div className="brand" style={{ padding: 0 }}>
                <div className="brand-mark">C</div>
                <div className="brand-text">LMS Clevio</div>
              </div>
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => setMobileNavOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="sidebar-scroll" style={{ padding: 0 }}>
              {MENU_SECTIONS.map((section) => {
                const items = section.items
                  .map((id) => visibleMenu.find((item) => item.id === id))
                  .filter((item): item is MenuItem => Boolean(item));

                if (items.length === 0) {
                  return null;
                }

                return (
                  <div key={`mobile-${section.label ?? 'root'}`} style={{ marginBottom: 4 }}>
                    {section.label ? <div className="nav-section">{section.label}</div> : null}
                    <nav className="nav">
                      {items.map((item) => {
                        const active = isActivePath(pathname, item.href);
                        const Icon = item.icon;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`nav-item${active ? ' active' : ''}`}
                            onClick={() => goTo(item.href)}
                          >
                            <Icon />
                            <span className="nav-item-label">{item.label}</span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {commandOpen ? (
        <div className="modal-backdrop" onClick={() => { setCommandOpen(false); setSearchQuery(''); }}>
          <div className="cmd" onClick={(event) => event.stopPropagation()}>
            <input
              className="cmd-input"
              autoFocus
              placeholder="Cari halaman, tindakan, atau data..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />

            <div className="cmd-list">
              {filteredCommandItems.length === 0 ? <div className="empty">Tidak ada hasil</div> : null}

              {filteredCommandItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="cmd-item"
                    onClick={() => {
                      goTo(item.href);
                      setCommandOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <div className="admin-cmd-icon">
                      <Icon size={16} />
                    </div>
                    <span style={{ flex: 1, fontWeight: 600, textAlign: 'left' }}>{item.label}</span>
                    <span className="kbd">↵</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {profileOpen ? (
        <>
          <div className="admin-overlay-close" onClick={() => setProfileOpen(false)} />
          <div className="admin-profile-menu">
            <Link href="/admin/profile" className="admin-profile-menu-item" onClick={() => setProfileOpen(false)}>
              <Settings size={16} />
              <span>Edit Profile</span>
            </Link>
            {visibleMenuIds.has('settings') ? (
              <Link href="/admin/settings" className="admin-profile-menu-item" onClick={() => setProfileOpen(false)}>
                <ChevronRight size={16} />
                <span>Buka Settings</span>
              </Link>
            ) : null}
            <div className="admin-profile-divider" />
            <SignOutButton
              label="Logout"
              icon={<LogOut size={16} />}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                color: '#b4192e',
                background: 'transparent',
                border: 'none',
                padding: '10px 12px',
                borderRadius: 'var(--radius)',
              }}
            />
          </div>
        </>
      ) : null}
      </div>
    </>
  );
}
