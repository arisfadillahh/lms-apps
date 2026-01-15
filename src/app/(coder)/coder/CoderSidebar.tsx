'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Home, BookOpen, FileUp, FileText, Settings, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';

const NAV_LINKS = [
    { href: '/coder/dashboard', label: 'Dashboard', icon: Home },
    { href: '/coder/materials', label: 'Materi', icon: BookOpen },
    { href: '/coder/makeup', label: 'Tugas Susulan', icon: FileUp },
    { href: '/coder/reports', label: 'Rapor', icon: FileText },
];

type CoderSidebarProps = {
    session: { user: { fullName: string } } | null;
};

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.08
        }
    }
};

const item = {
    hidden: { opacity: 0, x: -20 },
    show: { opacity: 1, x: 0 }
};

export default function CoderSidebar({ session }: CoderSidebarProps) {
    const pathname = usePathname();

    return (
        <aside style={sidebarStyle}>
            {/* Logo */}
            <div style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
                style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: 1 }}
            >
                {NAV_LINKS.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    const Icon = link.icon;
                    return (
                        <motion.div key={link.href} variants={item}>
                            <Link
                                href={link.href}
                                style={isActive ? activeNavLinkStyle : navLinkStyle}
                            >
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: isActive ? '#3b82f6' : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: isActive ? '#fff' : '#64748b',
                                    transition: 'all 0.2s ease',
                                }}>
                                    <Icon size={18} />
                                </div>
                                <span>{link.label}</span>
                            </Link>
                        </motion.div>
                    );
                })}
            </motion.nav>
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
    gap: '1rem',
    position: 'fixed',
    left: 0,
    top: 0,
    overflowY: 'auto',
    zIndex: 50,
    borderRight: 'none',
    boxShadow: '4px 0 20px rgba(0, 0, 0, 0.03)',
};

const navLinkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '12px',
    color: '#64748b',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 500,
    transition: 'all 0.2s ease',
};

const activeNavLinkStyle: CSSProperties = {
    ...navLinkStyle,
    background: '#eff6ff',
    color: '#1e293b',
    fontWeight: 600,
};
