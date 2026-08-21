'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BookOpen, RefreshCw, PanelsTopLeft } from 'lucide-react';
import IssueReportButton from '@/components/issue-reports/IssueReportButton';

const NAV_LINKS = [
    { href: '/coder/dashboard', label: 'Dashboard', icon: LayoutDashboard, activeBg: 'bg-pastel-pink', activeText: 'text-coral', hoverBg: 'hover:bg-pastel-pink', hoverText: 'hover:text-coral' },
    { href: '/coder/materials', label: 'Materi', icon: BookOpen, activeBg: 'bg-pastel-blue', activeText: 'text-sky', hoverBg: 'hover:bg-pastel-blue', hoverText: 'hover:text-sky' },
    { href: '/coder/makeup', label: 'Tugas Susulan', icon: RefreshCw, activeBg: 'bg-pastel-yellow', activeText: 'text-amber-600', hoverBg: 'hover:bg-pastel-yellow', hoverText: 'hover:text-amber-600' },
    { href: '/coder/reports', label: 'Rapor & Portofolio', icon: PanelsTopLeft, activeBg: 'bg-pastel-green', activeText: 'text-clevio-green', hoverBg: 'hover:bg-pastel-green', hoverText: 'hover:text-clevio-green' },
];

type CoderSidebarProps = {
    session: { user: { fullName: string } } | null;
};

export default function CoderSidebar({ session }: CoderSidebarProps) {
    const pathname = usePathname();

    return (
        <aside className="coder-sidebar w-72 flex-shrink-0 border-r-4 border-dashed border-pastel-pink/50 bg-white flex-col justify-between hidden md:flex sticky top-0 h-screen">
            <div className="p-8">
                {/* Logo */}
                <div className="flex items-center gap-4 mb-12">
                    <div className="bg-clevio-navy aspect-square rounded-2xl size-12 flex items-center justify-center text-clevio-green font-black text-2xl shadow-lg rotate-3">
                        C
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-clevio-navy text-xl font-black leading-none tracking-tight">Clevio</h1>
                        <p className="text-clevio-green text-xs font-bold mt-1 uppercase tracking-widest">Coder Journey</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex flex-col gap-3">
                    {NAV_LINKS.map((link) => {
                        const isActive = pathname.startsWith(link.href);
                        const Icon = link.icon;

                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                data-coder-nav={link.href}
                                prefetch={true}
                                className={`flex items-center gap-4 px-6 py-4 rounded-2xl font-bold transition-all hover:scale-105 ${isActive
                                    ? `${link.activeBg} ${link.activeText}`
                                    : `text-slate-500 ${link.hoverBg} ${link.hoverText}`
                                    }`}
                            >
                                <Icon size={22} strokeWidth={2.5} />
                                <span className="text-base font-bold">{link.label}</span>
                            </Link>
                        );
                    })}
                </nav>
            </div>
            <div className="px-8 pb-8">
                <IssueReportButton role="CODER" placement="sidebar" />
            </div>
        </aside>
    );
}
