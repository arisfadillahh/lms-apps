'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Home, BookOpen, FileUp, FileText, User } from 'lucide-react';

import SignOutButton from '@/components/SignOutButton';

const NAV_LINKS = [
    { href: '/coder/dashboard', label: 'Dashboard', icon: Home },
    { href: '/coder/materials', label: 'Materi', icon: BookOpen },
    { href: '/coder/makeup', label: 'Tugas Susulan', icon: FileUp },
    { href: '/coder/reports', label: 'Rapor', icon: FileText },
];

type CoderSidebarProps = {
    session: { user: { fullName: string } } | null;
};

// Edmate Theme Sidebar Styles
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
};

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

// Component update for text colors
export default function CoderSidebar({ session }: CoderSidebarProps) {
    const pathname = usePathname();

    return (
        <aside style={sidebarStyle}>
            <div style={{ paddingLeft: '0.5rem' }}>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>⚡</span> Edmate
                </p>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.25rem' }}>Coder Portal</p>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {NAV_LINKS.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    const Icon = link.icon;
                    return (
                        <Link key={link.href} href={link.href} style={isActive ? activeNavLinkStyle : navLinkStyle} className="hover:bg-slate-50 hover:text-slate-900">
                            <Icon size={20} />
                            <span>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>
            {/* Footer removed as per request */}
        </aside>
    );
}
