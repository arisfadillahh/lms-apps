'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X, Home, Users, GraduationCap, BookOpen, CalendarOff, FileText, MessageCircle, Package, Image as ImageIcon, Wallet, BookMarked, Megaphone, ClipboardCheck, FileUp, LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isSuperAdmin, type AdminPermissions } from '@/lib/permissions';

type NavLink = {
    id?: string;  // Menu ID for permission checking
    href: string;
    label: string;
    icon: LucideIcon;
};

const ADMIN_LINKS: NavLink[] = [
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

const COACH_LINKS: NavLink[] = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: Home },
    { href: '/coach/rubrics', label: 'Rubrik', icon: ClipboardCheck },
    { href: '/coach/makeup', label: 'Tugas Susulan', icon: FileUp },
    { href: '/coach/leave', label: 'Pengajuan Izin', icon: CalendarOff },
];

const CODER_LINKS: NavLink[] = [
    { href: '/coder/dashboard', label: 'Dashboard', icon: Home },
    { href: '/coder/materials', label: 'Materi', icon: BookOpen },
    { href: '/coder/makeup', label: 'Tugas Susulan', icon: FileUp },
    { href: '/coder/reports', label: 'Rapor', icon: FileText },
];

type MobileNavProps = {
    role: 'ADMIN' | 'COACH' | 'CODER';
    username?: string;
    adminPermissions?: AdminPermissions;
};

export default function MobileNav({ role, username = '', adminPermissions = null }: MobileNavProps) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // Get links based on role
    let links: NavLink[] = [];
    if (role === 'ADMIN') {
        // Filter admin links based on permissions
        links = ADMIN_LINKS.filter((link) => {
            // Dashboard always accessible
            if (link.id === 'dashboard') return true;

            // Superadmin sees all
            if (isSuperAdmin(username, adminPermissions)) return true;

            // Check permissions
            if (adminPermissions?.menus?.includes(link.id!)) return true;

            return false;
        });
    } else if (role === 'COACH') {
        links = COACH_LINKS;
    } else {
        links = CODER_LINKS;
    }

    return (
        <>
            {/* Mobile Only Styles */}
            <style>{`
                .mobile-nav-trigger {
                    display: none;
                }
                @media (max-width: 768px) {
                    .mobile-nav-trigger {
                        display: flex !important;
                    }
                }
            `}</style>

            {/* Hamburger Button */}
            <button
                className="mobile-nav-trigger"
                onClick={() => setIsOpen(true)}
                style={{
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
                aria-label="Buka menu navigasi"
            >
                <Menu size={22} color="#1e293b" />
            </button>

            {/* Mobile Sidebar Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsOpen(false)}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0, 0, 0, 0.5)',
                                zIndex: 100,
                            }}
                        />

                        {/* Sidebar Panel */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            style={{
                                position: 'fixed',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: '280px',
                                maxWidth: '85vw',
                                background: '#ffffff',
                                zIndex: 101,
                                display: 'flex',
                                flexDirection: 'column',
                                boxShadow: '4px 0 20px rgba(0, 0, 0, 0.1)',
                            }}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '1rem 1.25rem',
                                borderBottom: '1px solid #f1f5f9',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Image src="/favicon.ico" alt="Clevio LMS" width={28} height={28} />
                                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Clevio LMS</span>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '32px',
                                        height: '32px',
                                        borderRadius: '8px',
                                        background: '#f1f5f9',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                    aria-label="Tutup menu"
                                >
                                    <X size={18} color="#64748b" />
                                </button>
                            </div>

                            {/* Navigation Links */}
                            <nav style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
                                {links.map((link) => {
                                    const isActive = pathname.startsWith(link.href);
                                    const Icon = link.icon;
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setIsOpen(false)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.75rem 1rem',
                                                borderRadius: '10px',
                                                color: isActive ? '#1e293b' : '#64748b',
                                                background: isActive ? '#eff6ff' : 'transparent',
                                                fontWeight: isActive ? 600 : 500,
                                                fontSize: '0.95rem',
                                                textDecoration: 'none',
                                                marginBottom: '0.25rem',
                                            }}
                                        >
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '8px',
                                                background: isActive ? '#3b82f6' : 'transparent',
                                                color: isActive ? '#fff' : '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Icon size={18} />
                                            </div>
                                            <span>{link.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
