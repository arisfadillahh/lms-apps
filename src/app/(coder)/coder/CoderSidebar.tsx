'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Home, BookOpen, FileUp, FileText, User } from 'lucide-react';

import SignOutButton from '@/components/SignOutButton';

const NAV_LINKS = [
    { href: '/coder/dashboard', label: 'Beranda', icon: Home },
    { href: '/coder/materials', label: 'Materi', icon: BookOpen },
    { href: '/coder/makeup', label: 'Tugas Susulan', icon: FileUp },
    { href: '/coder/reports', label: 'Laporan', icon: FileText },
    { href: '/coder/profile', label: 'Profil & Keamanan', icon: User },
];

type CoderSidebarProps = {
    session: { user: { fullName: string } } | null;
};

export default function CoderSidebar({ session }: CoderSidebarProps) {
    const pathname = usePathname();

    return (
        <aside style={sidebarStyle}>
            <div>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>🎮 Clevio LMS</p>
                <p style={{ fontSize: '0.8rem', color: '#bfdbfe' }}>Coder Portal</p>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {NAV_LINKS.map((link) => {
                    const isActive = pathname.startsWith(link.href);
                    const Icon = link.icon;
                    return (
                        <Link key={link.href} href={link.href} style={isActive ? activeNavLinkStyle : navLinkStyle}>
                            <Icon size={18} />
                            <span>{link.label}</span>
                        </Link>
                    );
                })}
            </nav>
            {session ? (
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#bfdbfe' }}>
                        Halo! 👋
                        <br />
                        <span style={{ color: '#ffffff', fontWeight: 600 }}>{session.user.fullName}</span>
                    </div>
                    <SignOutButton
                        style={{
                            alignSelf: 'flex-start',
                            border: '1px solid rgba(248, 250, 252, 0.45)',
                            color: '#f8fafc',
                        }}
                    />
                </div>
            ) : null}
        </aside>
    );
}

const sidebarStyle: CSSProperties = {
    width: '240px',
    height: '100vh',
    background: 'linear-gradient(180deg, #1d4ed8 0%, #2563eb 100%)',
    color: '#ffffff',
    padding: '1.5rem 1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    position: 'fixed',
    left: 0,
    top: 0,
    overflowY: 'auto',
};

const navLinkStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    padding: '0.65rem 0.85rem',
    borderRadius: '0.5rem',
    color: '#dbeafe',
    textDecoration: 'none',
    fontSize: '0.9rem',
    transition: 'all 0.15s ease',
};

const activeNavLinkStyle: CSSProperties = {
    ...navLinkStyle,
    background: 'rgba(255, 255, 255, 0.2)',
    color: '#ffffff',
    fontWeight: 500,
};
