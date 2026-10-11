'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, ClipboardCheck, Images, LayoutDashboard, RefreshCw } from 'lucide-react';

const NAV_LINKS = [
    { href: '/coach/dashboard', label: 'Beranda', icon: LayoutDashboard },
    { href: '/coach/rubrics', label: 'Penilaian', icon: ClipboardCheck },
    { href: '/coach/makeup', label: 'Susulan', icon: RefreshCw },
    { href: '/coach/leave', label: 'Izin', icon: CalendarClock },
    { href: '/coach/portfolios', label: 'Portofolio', icon: Images },
];

export default function CoachMobileNav() {
    const pathname = usePathname();

    return (
        <nav className="coach-mobile-nav md:hidden" aria-label="Navigasi Coach mobile">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                    <Link
                        key={href}
                        href={href}
                        prefetch
                        data-coach-nav={href}
                        aria-current={active ? 'page' : undefined}
                        className={`coach-mobile-nav-item ${active ? 'is-active' : ''}`}
                    >
                        <Icon size={21} strokeWidth={active ? 2.7 : 2.2} />
                        <span>{label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
