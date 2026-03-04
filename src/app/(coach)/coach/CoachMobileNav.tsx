'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ClipboardCheck, FileUp, CalendarOff } from 'lucide-react';

const NAV_LINKS = [
    { href: '/coach/dashboard', label: 'Dashboard', icon: Home },
    { href: '/coach/rubrics', label: 'Rubrik', icon: ClipboardCheck },
    { href: '/coach/makeup', label: 'Susulan', icon: FileUp },
    { href: '/coach/leave', label: 'Izin', icon: CalendarOff },
];

export default function CoachMobileNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex md:hidden shadow-lg">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5"
                        style={{
                            color: active ? '#10b981' : '#94a3b8',
                            textDecoration: 'none',
                            fontSize: '0.7rem',
                            fontWeight: active ? 700 : 500,
                        }}
                    >
                        <Icon size={20} />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
