'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Home, Users, GraduationCap, BookOpen, CalendarOff, FileText, MessageCircle, Package, Image as ImageIcon, Wallet, BookMarked, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { isSuperAdmin, type AdminPermissions } from '@/lib/permissions';

// Map menu IDs to nav link data
const NAV_LINKS = [
    { id: 'dashboard', href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    { id: 'users', href: '/admin/users', label: 'Pengguna', icon: Users },
    { id: 'classes', href: '/admin/classes', label: 'Kelas', icon: GraduationCap },
    { id: 'curriculum', href: '/admin/curriculum', label: 'Kurikulum', icon: BookOpen },
    { id: 'ekskul', href: '/admin/ekskul', label: 'Ekskul Plans', icon: BookMarked },
    { id: 'payments', href: '/admin/payments', label: 'Pembayaran', icon: Wallet },
    { id: 'software', href: '/admin/software', label: 'Software', icon: Package },
    { id: 'banners', href: '/admin/banners', label: 'Banner', icon: ImageIcon },
    { id: 'leave', href: '/admin/leave', label: 'Izin Coach', icon: CalendarOff },
    { id: 'reports', href: '/admin/reports', label: 'Laporan', icon: FileText },
    { id: 'whatsapp', href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    { id: 'broadcast', href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
];

type AdminSidebarProps = {
    session: {
        user: {
            fullName: string;
            username?: string;
            adminPermissions?: AdminPermissions;
        };
    } | null;
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.05 }
    }
};

const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
};

export default function AdminSidebar({ session }: AdminSidebarProps) {
    const pathname = usePathname();

    // Get filtered nav links based on permissions
    const username = session?.user?.username ?? 'admin';
    const permissions = session?.user?.adminPermissions ?? null;

    const filteredLinks = NAV_LINKS.filter((link) => {
        // Dashboard is always accessible
        if (link.id === 'dashboard') return true;

        // Superadmin sees all
        if (isSuperAdmin(username, permissions)) return true;

        // Check if menu is in allowed list
        if (permissions?.menus?.includes(link.id)) return true;

        return false;
    });

    return (
        <aside className="admin-sidebar" style={sidebarStyle}>
            <style>{`aside::-webkit-scrollbar { display: none; }`}</style>

            {/* Logo */}
            <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#3b82f6'
                    }}>
                        <Image src="/favicon.ico" alt="Clevio LMS" width={32} height={32} />
                    </div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.02em' }}>
                        Clevio LMS
                    </span>
                </div>
            </div>

            {/* Navigation */}
            <motion.nav
                variants={container}
                initial="hidden"
                animate="show"
                style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}
            >
                {filteredLinks.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    const Icon = link.icon;
                    return (
                        <motion.div key={link.href} variants={item}>
                            <Link href={link.href} style={isActive ? activeNavLinkStyle : navLinkStyle}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '8px',
                                    background: isActive ? '#3b82f6' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isActive ? '#fff' : '#64748b',
                                    transition: 'all 0.2s ease',
                                }}>
                                    <Icon size={16} />
                                </div>
                                <span>{link.label}</span>
                            </Link>
                        </motion.div>
                    );
                })}
            </motion.nav>

            {/* Responsive: Hide sidebar on mobile */}
            <style>{`
                @media (max-width: 768px) {
                    .admin-sidebar {
                        display: none !important;
                    }
                }
            `}</style>
        </aside>
    );
}

// Styles - Modern Blue Theme
const sidebarStyle: CSSProperties = {
    width: '240px',
    height: '100vh',
    background: '#ffffff',
    color: '#1e293b',
    padding: '1.25rem 0.75rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    position: 'fixed',
    left: 0,
    top: 0,
    overflowY: 'auto',
    zIndex: 50,
    borderRight: 'none',
    boxShadow: '4px 0 20px rgba(0, 0, 0, 0.03)',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
};

const navLinkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.45rem 0.65rem',
    borderRadius: '10px',
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
};

const activeNavLinkStyle: CSSProperties = {
    ...navLinkStyle,
    background: '#eff6ff',
    color: '#1e293b',
    fontWeight: 600,
};
