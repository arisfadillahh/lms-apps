'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Home, Users, GraduationCap, BookOpen, CalendarOff, FileText, MessageCircle, Package, Image as ImageIcon, Wallet, BookMarked, Megaphone } from 'lucide-react';
import Image from 'next/image';
import { motion } from 'framer-motion';

const NAV_LINKS = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    { href: '/admin/users', label: 'Pengguna', icon: Users },
    { href: '/admin/classes', label: 'Kelas', icon: GraduationCap },
    { href: '/admin/curriculum', label: 'Kurikulum', icon: BookOpen },
    { href: '/admin/ekskul', label: 'Ekskul Plans', icon: BookMarked },
    { href: '/admin/payments', label: 'Pembayaran', icon: Wallet },
    { href: '/admin/software', label: 'Software', icon: Package },
    { href: '/admin/banners', label: 'Banner', icon: ImageIcon },
    { href: '/admin/leave', label: 'Izin Coach', icon: CalendarOff },
    { href: '/admin/reports', label: 'Laporan', icon: FileText },
    { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
];

type AdminSidebarProps = {
    session: { user: { fullName: string } } | null;
};

const sidebarStyle: CSSProperties = {
    width: '240px',
    height: '100vh',
    background: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    color: '#1e293b',
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    position: 'fixed',
    left: 0,
    top: 0,
    overflowY: 'auto',
    zIndex: 50,
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
};

// Add global style for hiding scrollbar in this component (styled-jsx or similar not available, using style tag or just relying on standard)
// Actually, since I can't inject global CSS easily from here without 'style' jsx, I'll just use the properties.
// Note: For Webkit (Chrome/Safari), we need a style tag or className. 
// I'll add a class 'hide-scrollbar' and define it in globals? 
// Or just adding this style tag in the component render?
// Let's rely on standard 'scrollbarWidth' for now, usually enough for modern reqs, but user mentioned 'laptop ukuran kecil', likely Chrome/Windows.
// Windows scrollbars are chunky.
// I will add a <style> block in the return for the specific webkit selector.

const navLinkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    borderRadius: '12px',
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
};

const activeNavLinkStyle: CSSProperties = {
    ...navLinkStyle,
    background: '#eff6ff',
    color: '#2563eb',
    fontWeight: 600,
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
};

export default function AdminSidebar({ session }: AdminSidebarProps) {
    const pathname = usePathname();

    return (
        <aside style={sidebarStyle}>
            <style jsx global>{`
                aside::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div style={{ paddingLeft: '0.5rem', marginBottom: '1.25rem' }}>
                <Image
                    src="/logo/innovator-camp-logo-dark.png"
                    alt="Innovator Camp Logo"
                    width={120}
                    height={40}
                    style={{ width: 'auto', height: 'auto', maxWidth: '100%', objectFit: 'contain' }}
                    priority
                />
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.5rem' }}>Admin Dashboard</p>
            </div>
            <motion.nav
                variants={container}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
            >
                {NAV_LINKS.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    const Icon = link.icon;
                    return (
                        <motion.div key={link.href} variants={item}>
                            <Link key={link.href} href={link.href} style={isActive ? activeNavLinkStyle : navLinkStyle} className="hover:bg-slate-50 hover:text-slate-900">
                                <Icon size={20} />
                                <span>{link.label}</span>
                            </Link>
                        </motion.div>
                    );
                })}
            </motion.nav>
        </aside>
    );
}
