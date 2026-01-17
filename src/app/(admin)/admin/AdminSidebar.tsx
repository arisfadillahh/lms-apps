'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, type CSSProperties } from 'react';
import {
    Home, Users, GraduationCap, BookOpen, CalendarOff, FileText,
    MessageCircle, Package, Image as ImageIcon, Wallet, BookMarked,
    Megaphone, Receipt, Settings, UserCheck, ChevronRight, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isSuperAdmin, type AdminPermissions } from '@/lib/permissions';

// Define the Leaf Menu Items (Source of Truth for Icons & Links)
const MENU_ITEMS: Record<string, { href: string; label: string; icon: any }> = {
    dashboard: { href: '/admin/dashboard', label: 'Dashboard', icon: Home },
    users: { href: '/admin/users', label: 'Pengguna', icon: Users },
    classes: { href: '/admin/classes', label: 'Kelas', icon: GraduationCap },
    curriculum: { href: '/admin/curriculum', label: 'Kurikulum', icon: BookOpen },
    ekskul: { href: '/admin/ekskul', label: 'Ekskul Plans', icon: BookMarked },
    payments: { href: '/admin/payments', label: 'Paket & Tarif', icon: Wallet },
    invoices: { href: '/admin/payments/invoices', label: 'Invoice', icon: Receipt },
    ccr: { href: '/admin/coders/assign-ccr', label: 'Assign CCR', icon: UserCheck },
    software: { href: '/admin/software', label: 'Software', icon: Package },
    banners: { href: '/admin/banners', label: 'Banner', icon: ImageIcon },
    leave: { href: '/admin/leave', label: 'Izin Coach', icon: CalendarOff },
    reports: { href: '/admin/reports', label: 'Laporan', icon: FileText },
    whatsapp: { href: '/admin/whatsapp', label: 'WhatsApp', icon: MessageCircle },
    broadcast: { href: '/admin/broadcast', label: 'Broadcast', icon: Megaphone },
    settings: { href: '/admin/settings', label: 'Settings', icon: Settings },
};

// Define the Structure (Groups vs Single Items)
type SidebarGroup = {
    type: 'group';
    label: string;
    icon: any;
    children: string[]; // IDs from MENU_ITEMS
};

type SidebarSingle = {
    type: 'single';
    id: string; // ID from MENU_ITEMS
};

const SIDEBAR_STRUCTURE: (SidebarGroup | SidebarSingle)[] = [
    { type: 'single', id: 'dashboard' },
    { type: 'single', id: 'users' },
    {
        type: 'group',
        label: 'Akademik',
        icon: GraduationCap,
        children: ['classes', 'curriculum', 'ekskul']
    },
    {
        type: 'group',
        label: 'Keuangan',
        icon: Wallet,
        children: ['payments', 'invoices', 'ccr']
    },
    {
        type: 'group',
        label: 'Komunikasi',
        icon: MessageCircle,
        children: ['whatsapp', 'broadcast']
    },
    {
        type: 'group',
        label: 'Lainnya',
        icon: Settings,
        children: ['software', 'banners', 'leave', 'reports', 'settings']
    }
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

export default function AdminSidebar({ session }: AdminSidebarProps) {
    const pathname = usePathname();
    const username = session?.user?.username ?? 'admin';
    const permissions = session?.user?.adminPermissions ?? null;
    const isSuper = isSuperAdmin(username, permissions);

    // Permission Check Helper
    const canAccess = (id: string) => {
        if (id === 'dashboard') return true;
        if (isSuper) return true;
        return permissions?.menus?.includes(id) ?? false;
    };

    return (
        <aside className="admin-sidebar" style={sidebarStyle}>
            <style>{`aside::-webkit-scrollbar { display: none; }`}</style>

            {/* Logo */}
            <div style={{ padding: '0 10px 20px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Image src="/favicon.ico" alt="Logo" width={30} height={30} />
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>LMS Clevio</span>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {SIDEBAR_STRUCTURE.map((item, index) => {
                    if (item.type === 'single') {
                        if (!canAccess(item.id)) return null;
                        const menu = MENU_ITEMS[item.id];
                        const isActive = pathname.startsWith(menu.href);

                        return (
                            <Link key={item.id} href={menu.href} style={isActive ? activeLinkStyle : linkStyle}>
                                <div style={isActive ? activeIconStyle : iconStyle}>
                                    <menu.icon size={20} />
                                </div>
                                <span style={{ fontWeight: isActive ? 700 : 500 }}>{menu.label}</span>
                            </Link>
                        );
                    } else {
                        // Check if any child is accessible
                        const visibleChildren = item.children.filter(childId => canAccess(childId));
                        if (visibleChildren.length === 0) return null;

                        // Check if active (keep expanded if child active)
                        const hasActiveChild = visibleChildren.some(childId => pathname.startsWith(MENU_ITEMS[childId].href));

                        return (
                            <SidebarGroupItem
                                key={index}
                                label={item.label}
                                icon={item.icon}
                                childrenIds={visibleChildren}
                                defaultExpanded={hasActiveChild}
                                pathname={pathname}
                            />
                        );
                    }
                })}
            </nav>

            {/* Responsive */}
            <style>{`
                @media (max-width: 768px) {
                    .admin-sidebar { display: none !important; }
                }
            `}</style>
        </aside>
    );
}

function SidebarGroupItem({ label, icon: Icon, childrenIds, defaultExpanded, pathname }: {
    label: string, icon: any, childrenIds: string[], defaultExpanded: boolean, pathname: string
}) {
    // Determine initial expanded state: Expanded if a child is active
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Check if the group itself is effectively active (one of its children is active)
    // We treat the group header as active if expanded, or strictly if child active?
    // Usually groups don't highlight the header unless a child is active.
    // Let's check if any child is active to style the group icon/header.
    const isGroupActive = childrenIds.some(childId => pathname.startsWith(MENU_ITEMS[childId].href));

    // Toggle expand on click
    const toggleExpand = () => setIsExpanded(!isExpanded);

    return (
        <div>
            {/* Group Header - Clickable */}
            <div
                onClick={toggleExpand}
                style={{
                    ...linkStyle,
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: isGroupActive ? '#eff6ff' : 'transparent', // Highlight group if active
                    color: isGroupActive ? '#1e293b' : '#64748b',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={isGroupActive ? activeIconStyle : iconStyle}>
                        <Icon size={20} />
                    </div>
                    <span style={{ fontWeight: isGroupActive ? 700 : 500 }}>{label}</span>
                </div>
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>

            {/* Submenu Items */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '12px' }}>
                            {childrenIds.map(childId => {
                                const menu = MENU_ITEMS[childId];
                                const isActive = pathname.startsWith(menu.href);
                                return (
                                    <Link
                                        key={childId}
                                        href={menu.href}
                                        style={isActive ? activeSubLinkStyle : subLinkStyle}
                                    >
                                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#3b82f6' : '#cbd5e1', marginRight: '10px' }} />
                                        <span style={{ fontWeight: isActive ? 600 : 400 }}>{menu.label}</span>
                                    </Link>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Styles - Restored to Simpler/Original Look
const sidebarStyle: CSSProperties = {
    width: '260px', // Slightly wider for the badges
    height: '100vh',
    background: '#fff',
    borderRight: '1px solid #e2e8f0',
    padding: '24px 16px',
    position: 'fixed',
    left: 0,
    top: 0,
    overflowY: 'auto',
    zIndex: 50
};

const linkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '15px', // Slightly larger font per visual
    borderRadius: '12px',
    transition: 'all 0.2s',
    marginBottom: '4px'
};

const activeLinkStyle: CSSProperties = {
    ...linkStyle,
    background: '#eff6ff',
    color: '#1e293b', // Dark text for active
};

// Icon Styles
const iconStyle: CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '36px', height: '36px',
    color: '#64748b',
    borderRadius: '10px',
    transition: 'all 0.2s'
};

const activeIconStyle: CSSProperties = {
    ...iconStyle,
    background: '#3b82f6', // Blue background
    color: '#ffffff',       // White icon
    boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)' // Subtle glow
};

const subLinkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px 10px 20px',
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '14px',
    borderRadius: '8px',
    transition: 'color 0.2s'
};

const activeSubLinkStyle: CSSProperties = {
    ...subLinkStyle,
    color: '#3b82f6',
    fontWeight: 600,
    background: '#f8fafc'
};
