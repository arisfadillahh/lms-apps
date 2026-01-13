'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CSSProperties } from 'react';
import { Home, ClipboardCheck, FileUp, CalendarOff } from 'lucide-react';
import Image from 'next/image';

import SignOutButton from '@/components/SignOutButton';

// Edmate Theme Sidebar Styles (Coach)
const NAV_LINKS = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: Home },
    { href: '/coach/rubrics', label: 'Rubrik', icon: ClipboardCheck },
    { href: '/coach/makeup', label: 'Tugas Susulan', icon: FileUp },
    { href: '/coach/leave', label: 'Pengajuan Izin', icon: CalendarOff },
];

type CoachSidebarProps = {
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

// Component update
export default function CoachSidebar({ session }: CoachSidebarProps) {
    const pathname = usePathname();

    return (
        <aside style={sidebarStyle}>
            <div style={{ paddingLeft: '0.5rem', marginBottom: '1.25rem' }}>
                <Image
                    src="/logo/Logo Innovator Camp dark.png"
                    alt="Innovator Camp Logo"
                    width={120}
                    height={40}
                    style={{ width: 'auto', height: 'auto', maxWidth: '100%', objectFit: 'contain' }}
                    priority
                />
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.5rem' }}>Coach Dashboard</p>
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
